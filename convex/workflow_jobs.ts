import { v } from "convex/values";
import { api, components, internal } from "./_generated/api";
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

import type { Doc, Id } from "./_generated/dataModel";

async function updateAlbumLatest(
  ctx: any,
  albumId: Id<"album">,
  workflowId: string,
  status: JobStatus,
  updatedAt: number
) {
  const album = await ctx.db.get(albumId);
  const prev = album?.latest_workflow_updated_at ?? 0;
  if (!album || updatedAt >= prev) {
    await ctx.db.patch(albumId, {
      latest_workflow_id: workflowId,
      latest_workflow_status: status,
      latest_workflow_updated_at: updatedAt,
    });
  }
}

/**
 * Public: listJobs
 */
export const listJobs = internalQuery({
  args: {
    status: v.optional(
      v.union(
        v.literal("queued"),
        v.literal("in_progress"),
        v.literal("success"),
        v.literal("failed"),
        v.literal("canceled"),
        v.literal("pending_review")
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

type QueueBundle = {
  jobs: Doc<"workflow_job">[];
  albums: Doc<"album">[];
  artists: Doc<"artist">[];
};

export const getQueueBundle = query({
  args: v.object({}),
  handler: async (ctx): Promise<QueueBundle> => {
    const jobs = await ctx.runQuery(internal.workflow_jobs.listJobs, {});

    const albumIds: Id<"album">[] = Array.from(
      new Set(
        jobs
          .map((j) => j.context?.albumId as Id<"album"> | undefined)
          .filter((x): x is Id<"album"> => Boolean(x))
      )
    );

    const albums =
      albumIds.length > 0
        ? await ctx.runQuery(internal.db.getAlbumsByIds, { albumIds })
        : [];

    const artistIds: Id<"artist">[] = Array.from(
      new Set(
        albums
          .map((a) => a.primary_artist_id as Id<"artist"> | undefined)
          .filter((x): x is Id<"artist"> => Boolean(x))
      )
    );

    const artists =
      artistIds.length > 0
        ? await ctx.runQuery(api.db.getArtistsByIds, { artistIds })
        : [];

    return { jobs, albums, artists };
  },
});

/**
 * Public: getJob by workflowId
 */
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

/**
 * Public: cancelJob
 */
export const cancelJob = mutation({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    try {
      await ctx.runMutation(components.workflow.workflow.cancel, {
        workflowId,
      });
    } catch (e) {}

    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();

    const now = Date.now();
    if (job) {
      await ctx.db.patch(job._id, {
        status: "canceled",
        updated_at: now,
      });

      const albumId = job.context?.albumId as Id<"album"> | undefined;
      if (albumId) {
        await updateAlbumLatest(ctx, albumId, workflowId, "canceled", now);
      }
    }
    return true;
  },
});

export const patchJobContext = internalMutation({
  args: {
    workflowId: v.string(),
    context: v.any(),
  },
  handler: async (ctx, { workflowId, context }) => {
    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();
    if (!job) return;

    const mergedContext = { ...(job.context ?? {}), ...(context ?? {}) };
    const now = Date.now();

    await ctx.db.patch(job._id, {
      context: mergedContext,
      updated_at: now,
    });

    const albumId = mergedContext?.albumId as Id<"album"> | undefined;
    if (albumId) {
      await updateAlbumLatest(
        ctx,
        albumId,
        workflowId,
        (job.status as JobStatus) ?? "queued",
        now
      );
    }
  },
});

/**
 * Sync a single workflow's status and ensure a job row exists/updated.
 */
// TODO simplify this later by showing the status badge instead of computing the progress
export const syncJob = mutation({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }) => {
    const now = Date.now();

    let statusResp: any = null;
    try {
      statusResp = await ctx.runQuery(components.workflow.workflow.getStatus, {
        workflowId,
      });
    } catch (e) {
      const existing = await ctx.db
        .query("workflow_job")
        .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
        .first();

      if (existing) {
        await ctx.db.patch(existing._id, {
          status: "canceled",
          updated_at: now,
          error: "Workflow not found",
        });

        const albumId = existing.context?.albumId as Id<"album"> | undefined;
        if (albumId) {
          await updateAlbumLatest(ctx, albumId, workflowId, "canceled", now);
        }
        return existing;
      }

      throw e;
    }

    let status: JobStatus = "queued";
    if (statusResp.workflow.runResult) {
      const rr = statusResp.workflow.runResult;
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
        progress = status === "success" ? 100 : 0;
      }

      if (status === "failed" || status === "canceled") {
        progress = Math.max(0, Math.min(100, progress));
      }
    } catch {
      progress = status === "success" ? 100 : 0;
    }

    const startedAt =
      (statusResp.workflow.startedAt as number | undefined) ?? undefined;

    // Find existing job by workflow_id
    let existing = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();

    if (!existing) {
      try {
        const rows = await ctx.db
          .query("workflow_job")
          .withIndex("by_started_at")
          .collect();
        const candidateAlbumId =
          statusResp.workflow.onComplete?.context?.albumId;
        if (typeof candidateAlbumId === "string") {
          existing = rows.find((r: any) => {
            return r.context && r.context.albumId === candidateAlbumId;
          }) as any;
        }
      } catch {
        // ignore
      }
    }

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

    const job = await ctx.db
      .query("workflow_job")
      .withIndex("by_workflow_id", (q) => q.eq("workflow_id", workflowId))
      .first();

    if (job) {
      const albumId = job.context?.albumId as Id<"album"> | undefined;
      if (albumId) {
        const latestUpdated = job.updated_at ?? now;
        await updateAlbumLatest(
          ctx,
          albumId,
          workflowId,
          job.status as JobStatus,
          latestUpdated
        );
      }
    }
    return job ?? null;
  },
});

/**
 * Sync multiple jobs (batch).
 */
export const syncJobs = mutation({
  args: { workflowIds: v.array(v.string()) },
  handler: async (ctx, { workflowIds }) => {
    const results: Array<Doc<"workflow_job"> | null> = [];
    for (const workflowId of workflowIds) {
      try {
        const job = await ctx.runMutation(
          (internal.workflow_jobs as any).syncJob,
          {
            workflowId,
          }
        );
        if (!job) continue;
        results.push(job);
      } catch (e) {
        continue;
      }
    }
    return results;
  },
});

/**
 * Retry a job by starting a new workflow instance (supported workflows only).
 * Supports albumWorkflow retries; if the job or workflow cannot be found by id, falls back to starting a new run with spotifyAlbumId from args/context or derived from albumId.
 */
export const retryJob = action({
  args: { workflowId: v.string() },
  handler: async (ctx, { workflowId }): Promise<{ newWorkflowId: string }> => {
    let job = await ctx.runQuery(internal.workflow_jobs.getWorkflowJobById, {
      workflowId,
    });

    let workflowName: string | undefined =
      (job?.workflow_name as any) ?? undefined;

    let fallbackContext: any = undefined;
    let fallbackArgs: any = undefined;
    if (!job) {
      try {
        const statusResp = await ctx.runQuery(
          components.workflow.workflow.getStatus,
          { workflowId }
        );
        workflowName = statusResp.workflow?.name ?? workflowName;
        fallbackArgs = statusResp.workflow?.args ?? undefined;
        fallbackContext = statusResp.workflow?.onComplete?.context ?? undefined;
      } catch {}
    }

    const name = workflowName ?? "unknown";
    if (name.startsWith("albumWorkflow")) {
      const context = (job?.context ?? fallbackContext ?? {}) as Record<
        string,
        any
      >;
      const args = (job?.args ?? fallbackArgs ?? {}) as Record<string, any>;

      const albumId = (context.albumId ?? args.albumId) as string | undefined;
      let spotifyAlbumId = (context.spotifyAlbumId ?? args.spotifyAlbumId) as
        | string
        | undefined;

      if (!spotifyAlbumId && albumId) {
        try {
          const album = await ctx.runQuery(internal.db.getAlbum, {
            albumId: albumId as Id<"album">,
          });
          spotifyAlbumId =
            (album?.metadata as any)?.provider_ids?.spotify ?? undefined;
        } catch (e) {
          throw e;
        }
      }

      if (!spotifyAlbumId) {
        throw new Error("Missing Spotify album id to retry albumWorkflow");
      }

      const newWorkflowId = await ctx.runAction(
        api.album_workflow.startAlbumWorkflow,
        { albumId: spotifyAlbumId }
      );

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
  v.literal("canceled"),
  v.literal("pending_review"),
  v.literal("rejected"),
  v.literal("approved")
);

type JobStatus =
  | "queued"
  | "in_progress"
  | "success"
  | "failed"
  | "canceled"
  | "pending_review"
  | "rejected"
  | "approved";

export const createWorkflowJob = internalMutation({
  args: {
    workflowId: v.string(),
    workflowName: v.string(),
    args: v.optional(v.any()),
    context: v.optional(v.any()),
    status: v.optional(vJobStatus),
    startedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const status: JobStatus = args.status ?? "queued";
    const startedAt = args.startedAt ?? now;

    const candidateAlbumId =
      (args.context && (args.context as any).albumId) ??
      (args.args && (args.args as any).albumId);

    let existing: any = null;
    if (candidateAlbumId) {
      try {
        const rows = await ctx.db
          .query("workflow_job")
          .withIndex("by_started_at")
          .collect();
        existing = rows.find((r: any) => {
          return r.context && r.context.albumId === candidateAlbumId;
        }) as any;
      } catch {
        existing = null;
      }
    }

    if (!existing) {
      existing = await ctx.db
        .query("workflow_job")
        .withIndex("by_workflow_id", (q) =>
          q.eq("workflow_id", args.workflowId)
        )
        .first();
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        workflow_id: args.workflowId,
        workflow_name: args.workflowName,
        args: { ...(existing.args ?? {}), ...(args.args ?? {}) },
        context: { ...(existing.context ?? {}), ...(args.context ?? {}) },
        status,
        progress: 0,
        started_at: startedAt,
        updated_at: now,
        error: undefined,
      });

      if (candidateAlbumId) {
        await updateAlbumLatest(
          ctx,
          candidateAlbumId as Id<"album">,
          args.workflowId,
          status,
          now
        );
      }
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

    if (candidateAlbumId) {
      await updateAlbumLatest(
        ctx,
        candidateAlbumId as Id<"album">,
        args.workflowId,
        status,
        now
      );
    }
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

      const albumId = (args.context as any)?.albumId as Id<"album"> | undefined;
      if (albumId) {
        await updateAlbumLatest(
          ctx,
          albumId,
          args.workflowId,
          (args.status as JobStatus) ?? "queued",
          args.updatedAt ?? Date.now()
        );
      }
      return id;
    }

    const nextUpdated = args.updatedAt ?? Date.now();
    const nextStatus = (args.status as JobStatus) ?? (job.status as JobStatus);

    await ctx.db.patch(job._id, {
      ...(args.status ? { status: args.status } : {}),
      ...(typeof args.progress === "number" ? { progress: args.progress } : {}),
      ...(typeof args.startedAt === "number"
        ? { started_at: args.startedAt }
        : {}),
      ...(typeof args.updatedAt === "number"
        ? { updated_at: args.updatedAt }
        : { updated_at: nextUpdated }),
      ...(typeof args.error === "string" ? { error: args.error } : {}),
      ...(args.context !== undefined ? { context: args.context } : {}),
    });

    const albumId =
      (args.context as any)?.albumId ??
      ((job.context as any)?.albumId as Id<"album"> | undefined);

    if (albumId) {
      await updateAlbumLatest(
        ctx,
        albumId as Id<"album">,
        args.workflowId,
        nextStatus,
        nextUpdated
      );
    }

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
    try {
      await ctx.runMutation(components.workflow.workflow.cancel, {
        workflowId,
      });
    } catch (e) {}

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
