import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  action,
} from "./_generated/server";
import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";

import type { Doc } from "./_generated/dataModel";
/**
 * Public wrappers for listing, getting, canceling, syncing, and retrying jobs.
 * These call into the internal functions defined below and the workflow manager.
 */
export const listJobs = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("in_progress"),
        v.literal("success"),
        v.literal("failed"),
        v.literal("canceled")
      )
    ),
    workflowName: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, workflowName, limit }) => {
    const max = Math.min(Math.max(limit ?? 50, 1), 200);

    let rows;
    if (workflowName) {
      rows = await ctx.db
        .query("workflow_job")
        .withIndex("by_workflow_name", (idx) =>
          idx.eq("workflow_name", workflowName)
        )
        .collect();
    } else if (status) {
      rows = await ctx.db
        .query("workflow_job")
        .withIndex("by_status", (idx) => idx.eq("status", status))
        .collect();
    } else {
      rows = await ctx.db
        .query("workflow_job")
        .withIndex("by_started_at")
        .collect();
    }
    // Sort by started_at desc best-effort
    rows.sort((a, b) => (b.started_at ?? 0) - (a.started_at ?? 0));

    return rows.slice(0, max);
  },
});

export const getJob = query({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();
    return job ?? null;
  },
});

export const cancelJob = mutation({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    // Best-effort cancel via workflow component
    try {
      await ctx.runMutation(components.workflow.workflow.cancel, {
        workflowId,
      });
    } catch (e) {
      // ignore if already finished
    }

    // Update job record locally
    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();

    if (job) {
      await ctx.db.patch(job._id, {
        status: "canceled",
        updated_at: Date.now(),
      });
    }
    return true;
  },
});

export const syncJob = mutation({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const now = Date.now();

    // Fetch workflow status
    const statusResp = await ctx.runQuery(
      components.workflow.workflow.getStatus,
      { workflowId }
    );

    // Derive status from component payload
    let status: JobStatus = "queued";
    if (statusResp.workflow.runResult) {
      const rr = statusResp.workflow.runResult;
      if (rr.kind === "success") status = "success";
      else if (rr.kind === "failed") status = "failed";
      else if (rr.kind === "canceled") status = "canceled";
    } else {
      // If there are steps in progress or a startedAt we treat as in_progress
      if (
        (statusResp.inProgress && statusResp.inProgress.length > 0) ||
        statusResp.workflow.startedAt
      ) {
        status = "in_progress";
      } else {
        status = "queued";
      }
    }

    // Compute progress via journal
    let progress = 0;
    try {
      const journalResp = await ctx.runQuery(components.workflow.journal.load, {
        workflowId,
      });
      const entries = journalResp.journalEntries ?? [];
      const total = entries.length;

      const completed = entries.filter((e) => {
        const rr = e.step.runResult;
        return (
          (rr && rr.kind === "success") ||
          (!!e.step.completedAt && !e.step.inProgress)
        );
      }).length;

      if (total > 0) {
        progress = Math.round((completed / total) * 100);
      } else {
        // If finished and no steps, mark 100; else 0
        progress = status === "success" ? 100 : 0;
      }

      // Clamp for failed/canceled
      if (status === "failed" || status === "canceled") {
        progress = Math.max(0, Math.min(100, progress));
      }
    } catch {
      // If we can't load the journal, leave progress best-effort
      progress = status === "success" ? 100 : 0;
    }

    // Determine started_at best-effort
    const startedAt =
      (statusResp.workflow.startedAt as number | undefined) ?? undefined;

    // Patch or create job row
    const existing = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();

    if (!existing) {
      await ctx.db.insert("workflow_job", {
        workflow_id: workflowId,
        workflow_name: statusResp.workflow.name ?? "unknown",
        args: statusResp.workflow.args,
        context: statusResp.workflow.onComplete?.context,
        status,
        progress,
        started_at: startedAt ?? now,
        updated_at: now,
        error:
          statusResp.workflow.runResult &&
          "error" in statusResp.workflow.runResult
            ? String(statusResp.workflow.runResult.error)
            : undefined,
      });
    } else {
      await ctx.db.patch(existing._id, {
        status,
        progress,
        started_at: existing.started_at ?? startedAt ?? now,
        updated_at: now,
        workflow_name: statusResp.workflow.name ?? existing.workflow_name,
        args: existing.args ?? statusResp.workflow.args,
        context: existing.context ?? statusResp.workflow.onComplete?.context,
        error:
          statusResp.workflow.runResult &&
          "error" in statusResp.workflow.runResult
            ? String(statusResp.workflow.runResult.error)
            : undefined,
      });
    }

    // Return latest
    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();
    return job ?? null;
  },
});

export const syncJobs = mutation({
  args: { workflowIds: v.array(v.string()) },
  handler: async (
    ctx,
    { workflowIds }
  ): Promise<Array<Doc<"workflow_job"> | null>> => {
    const results: Array<Doc<"workflow_job"> | null> = [];
    for (const workflowId of workflowIds) {
      const now = Date.now();
      const statusResp = await ctx.runQuery(
        components.workflow.workflow.getStatus,
        { workflowId }
      );
      let status: "queued" | "in_progress" | "success" | "failed" | "canceled" =
        "queued";
      if (statusResp.workflow.runResult) {
        const rr = statusResp.workflow.runResult as any;
        if (rr.kind === "success") status = "success";
        else if (rr.kind === "failed") status = "failed";
        else if (rr.kind === "canceled") status = "canceled";
      } else {
        if (
          (statusResp.inProgress && statusResp.inProgress.length > 0) ||
          statusResp.workflow.startedAt
        ) {
          status = "in_progress";
        } else {
          status = "queued";
        }
      }
      let progress = 0;
      try {
        const journalResp = await ctx.runQuery(
          components.workflow.journal.load,
          { workflowId }
        );
        const entries = journalResp.journalEntries ?? [];
        const total = entries.length;
        const completed = entries.filter((e: any) => {
          const rr = e.step.runResult;
          return (
            (rr && rr.kind === "success") ||
            (!!e.step.completedAt && !e.step.inProgress)
          );
        }).length;
        progress =
          total > 0
            ? Math.round((completed / total) * 100)
            : status === "success"
            ? 100
            : 0;
        if (status === "failed" || status === "canceled") {
          progress = Math.max(0, Math.min(100, progress));
        }
      } catch {
        progress = status === "success" ? 100 : 0;
      }
      const startedAt =
        (statusResp.workflow.startedAt as number | undefined) ?? undefined;
      const existing = await ctx.db
        .query("workflow_job")
        .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
        .first();
      if (!existing) {
        await ctx.db.insert("workflow_job", {
          workflow_id: workflowId,
          workflow_name:
            (statusResp.workflow.name as string | undefined) ?? "unknown",
          args: statusResp.workflow.args,
          context: statusResp.workflow.onComplete?.context,
          status,
          progress,
          started_at: startedAt ?? now,
          updated_at: now,
          error:
            statusResp.workflow.runResult &&
            "error" in (statusResp.workflow.runResult as any)
              ? String((statusResp.workflow.runResult as any).error)
              : undefined,
        });
      } else {
        await ctx.db.patch(existing._id, {
          status,
          progress,
          started_at: existing.started_at ?? startedAt ?? now,
          updated_at: now,
          workflow_name:
            (statusResp.workflow.name as string | undefined) ??
            existing.workflow_name,
          args: existing.args ?? statusResp.workflow.args,
          context: existing.context ?? statusResp.workflow.onComplete?.context,
          error:
            statusResp.workflow.runResult &&
            "error" in (statusResp.workflow.runResult as any)
              ? String((statusResp.workflow.runResult as any).error)
              : undefined,
        });
      }
      const job = await ctx.db
        .query("workflow_job")
        .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
        .first();
      results.push(job ?? null);
    }
    return results;
  },
});

/**
 * Retry a job by starting a new workflow instance (supported workflows only).
 * Currently supports "albumWorkflow".
 */
export const retryJob = action({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }): Promise<{ newWorkflowId: string }> => {
    const job = await ctx.runQuery(internal.workflow_jobs.getWorkflowJobById, {
      workflowId,
    });
    if (!job) {
      throw new Error("Job not found");
    }

    const name = job.workflow_name;
    if (name === "albumWorkflow") {
      const albumId = (job.args && (job.args as any).albumId) as
        | string
        | undefined;
      if (!albumId) {
        throw new Error("Missing albumId to retry albumWorkflow");
      }

      const newWorkflowId = await ctx.runAction(
        api.album_workflow.startAlbumWorkflow,
        { albumId }
      );

      await ctx.runMutation(internal.workflow_jobs.createWorkflowJob, {
        workflowId: newWorkflowId,
        workflowName: "albumWorkflow",
        args: { albumId },
        context: job.context,
        status: "queued",
        startedAt: Date.now(),
      });

      return { newWorkflowId };
    }

    throw new Error(`Retry not supported for workflow: ${name}`);
  },
});

/**
 * Workflow job status enum
 */
export const vJobStatus = v.union(
  v.literal("queued"),
  v.literal("in_progress"),
  v.literal("success"),
  v.literal("failed"),
  v.literal("canceled")
);

type JobStatus = "queued" | "in_progress" | "success" | "failed" | "canceled";

/**
 * Create a new workflow job record.
 * Typically called right after starting a workflow.
 */
export const createWorkflowJob = internalMutation({
  args: {
    workflowId: v.string(),
    workflowName: v.string(),
    args: v.optional(v.any()),
    context: v.optional(v.any()),
    status: v.optional(vJobStatus), // default "queued"
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const status: JobStatus = args.status ?? "queued";
    const startedAt = args.startedAt ?? now;

    // Idempotent: if a job with this workflowId already exists, do nothing and return it
    const existing = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", args.workflowId))
      .first();

    if (existing) {
      return existing._id;
    }

    const id = await ctx.db.insert("workflow_job", {
      workflow_id: args.workflowId,
      workflow_name: args.workflowName,
      args: args.args,
      context: args.context,
      status,
      progress: 0,
      started_at: startedAt,
      updated_at: now,
      error: undefined,
    });

    return id;
  },
});

/**
 * Update fields on a workflow job record.
 */
export const updateWorkflowJob = internalMutation({
  args: {
    workflowId: v.string(),
    status: v.optional(vJobStatus),
    progress: v.optional(v.number()),
    error: v.optional(v.string()),
    context: v.optional(v.any()),
    startedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", args.workflowId))
      .first();

    if (!job) {
      // No job yet, create a minimal one
      const id = await ctx.db.insert("workflow_job", {
        workflow_id: args.workflowId,
        workflow_name: "unknown",
        args: undefined,
        context: args.context,
        status: args.status ?? "queued",
        progress: args.progress ?? 0,
        started_at: args.startedAt ?? Date.now(),
        updated_at: args.updatedAt ?? Date.now(),
        error: args.error,
      });
      return id;
    }

    await ctx.db.patch(job._id, {
      ...(args.status ? { status: args.status } : {}),
      ...(typeof args.progress === "number" ? { progress: args.progress } : {}),
      ...(typeof args.startedAt === "number"
        ? { started_at: args.startedAt }
        : {}),
      ...(typeof args.updatedAt === "number"
        ? { updated_at: args.updatedAt }
        : { updated_at: Date.now() }),
      ...(typeof args.error === "string" ? { error: args.error } : {}),
      ...(args.context !== undefined ? { context: args.context } : {}),
    });

    return job._id;
  },
});

/**
 * Fetch a job by its workflowId.
 */
export const getWorkflowJobById = internalQuery({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();
    return job ?? null;
  },
});

/**
 * Cancel a running workflow and update the job record.
 */
export const cancelWorkflowJob = internalMutation({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    // Try to cancel via workflow component
    try {
      await ctx.runMutation(components.workflow.workflow.cancel, {
        workflowId,
      });
    } catch (e) {
      // Continue; maybe it was already done/failed
    }

    // Update job record
    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();

    if (job) {
      await ctx.db.patch(job._id, {
        status: "canceled",
        updated_at: Date.now(),
      });
    }

    return true;
  },
});

/**
 * Pull latest status/progress from the workflow component and
 * persist it to the workflow_job table.
 */
export const syncWorkflowJobFromManager = internalMutation({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const now = Date.now();

    // Fetch workflow status
    const statusResp = await ctx.runQuery(
      components.workflow.workflow.getStatus,
      { workflowId }
    );

    // Derive status from component payload
    let status: JobStatus = "queued";
    if (statusResp.workflow.runResult) {
      const rr = statusResp.workflow.runResult;
      if (rr.kind === "success") status = "success";
      else if (rr.kind === "failed") status = "failed";
      else if (rr.kind === "canceled") status = "canceled";
    } else {
      // If there are steps in progress or a startedAt we treat as in_progress
      if (
        (statusResp.inProgress && statusResp.inProgress.length > 0) ||
        statusResp.workflow.startedAt
      ) {
        status = "in_progress";
      } else {
        status = "queued";
      }
    }

    // Compute progress via journal
    let progress = 0;
    try {
      const journalResp = await ctx.runQuery(components.workflow.journal.load, {
        workflowId,
      });
      const entries = journalResp.journalEntries ?? [];
      const total = entries.length;

      const completed = entries.filter((e) => {
        const rr = e.step.runResult;
        return (
          (rr && rr.kind === "success") ||
          (!!e.step.completedAt && !e.step.inProgress)
        );
      }).length;

      if (total > 0) {
        progress = Math.round((completed / total) * 100);
      } else {
        // If finished and no steps, mark 100; else 0
        progress = status === "success" ? 100 : 0;
      }

      // Clamp for failed/canceled
      if (status === "failed" || status === "canceled") {
        // Leave computed progress, but ensure range
        progress = Math.max(0, Math.min(100, progress));
      }
    } catch {
      // If we can't load the journal, leave progress best-effort
      progress = status === "success" ? 100 : 0;
    }

    // Determine started_at best-effort
    const startedAt =
      (statusResp.workflow.startedAt as number | undefined) ?? undefined;

    // Patch or create job row
    const existing = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();

    if (!existing) {
      await ctx.db.insert("workflow_job", {
        workflow_id: workflowId,
        workflow_name: statusResp.workflow.name ?? "unknown",
        args: statusResp.workflow.args,
        context: statusResp.workflow.onComplete?.context,
        status,
        progress,
        started_at: startedAt ?? now,
        updated_at: now,
        error:
          statusResp.workflow.runResult &&
          "error" in statusResp.workflow.runResult
            ? String(statusResp.workflow.runResult.error)
            : undefined,
      });
      return true;
    }

    await ctx.db.patch(existing._id, {
      status,
      progress,
      started_at: existing.started_at ?? startedAt ?? now,
      updated_at: now,
      workflow_name: statusResp.workflow.name ?? existing.workflow_name,
      args: existing.args ?? statusResp.workflow.args,
      context: existing.context ?? statusResp.workflow.onComplete?.context,
      error:
        statusResp.workflow.runResult &&
        "error" in statusResp.workflow.runResult
          ? String(statusResp.workflow.runResult.error)
          : undefined,
    });

    return true;
  },
});
