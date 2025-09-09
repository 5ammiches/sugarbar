import { vWorkflowId, WorkflowManager } from "@convex-dev/workflow";
import { v } from "convex/values";
import { components, internal } from "./_generated/api";
import { action, internalMutation, mutation } from "./_generated/server";
import { vResultValidator } from "@convex-dev/workpool";

export const workflow = new WorkflowManager(components.workflow, {
  workpoolOptions: {
    defaultRetryBehavior: {
      maxAttempts: 3,
      initialBackoffMs: 200,
      base: 2,
    },
    maxParallelism: 5,
  },
});

const lyric = internal.lyric;
const db = internal.db;
const spot = internal.spotify;

export const albumWorkflow = workflow.define({
  args: { albumId: v.string() },
  handler: async (step, { albumId }): Promise<void> => {
    const spotifyRetry = { maxAttempts: 5, initialBackoffMs: 300, base: 2 };
    const lyricRetry = { maxAttempts: 6, initialBackoffMs: 300, base: 2 };

    // TODO fix artists that are not supposed to be in Album artist_ids field (e.g. Jay-Z is an artist on GKMC)
    // 1) Fetch album and upsert
    const album = await step.runAction(
      spot.getAlbumById,
      { albumId },
      { retry: spotifyRetry, name: "spotify.getAlbumById" }
    );

    const albumDbId = await step.runMutation(
      db.upsertAlbum,
      { album },
      { name: "db.upsertAlbum" }
    );

    // 2) Derive artist and track IDs
    const spotifyArtistIds = Array.from(
      new Set(
        (album.artists ?? [])
          .map((a) => a.metadata?.provider_ids?.spotify)
          .filter((x): x is string => !!x)
      )
    );

    const spotifyTrackIds = Array.from(
      new Set(
        (album.tracks ?? [])
          .map((t) => t.metadata?.provider_ids?.spotify)
          .filter((x): x is string => !!x)
      )
    );

    // 3) Parallelize artist upserts
    const artistPromises = spotifyArtistIds.map((spId) =>
      (async () => {
        const artist = await step.runAction(
          spot.getArtistById,
          { artistId: spId },
          { retry: spotifyRetry, name: "spotify.getArtistById" }
        );
        const artistId = await step.runMutation(
          db.upsertArtist,
          { artist },
          { name: "db.upsertArtist" }
        );
        return artistId;
      })()
    );

    const upsertedArtistIds = await Promise.all(artistPromises);

    // 4) Parallelize track pipeline: fetch track -> upsert -> link -> fetch lyrics
    const trackPromises = spotifyTrackIds.map((spId) =>
      (async () => {
        const track = await step.runAction(
          spot.getTrackById,
          { trackId: spId },
          { retry: spotifyRetry, name: "spotify.getTrackById" }
        );

        const trackId = await step.runMutation(
          db.upsertTrack,
          { track },
          { name: "db.upsertTrack" }
        );

        await step.runMutation(
          db.upsertAlbumTrack,
          { albumId: albumDbId, trackId },
          { name: "db.upsertAlbumTrack" }
        );

        await step.runAction(
          lyric.fetchLyrics,
          { trackId },
          { retry: lyricRetry, name: "lyric.fetchLyrics" }
        );

        return trackId;
      })()
    );

    const upsertedTrackIds = await Promise.all(trackPromises);

    // Optionally return something typed; or keep Promise<void>.
    // return { artists: upsertedArtistIds, tracks: upsertedTrackIds };
  },
});

export const startAlbumWorkflow = action({
  args: { albumId: v.string() },
  handler: async (ctx, { albumId }): Promise<string> => {
    const workflowId = await workflow.start(
      ctx,
      internal.album_workflow.albumWorkflow,
      {
        albumId,
      },
      {
        onComplete: internal.album_workflow.handleOnComplete,
        context: { albumId },
      }
    );

    // Create a job record (best-effort; optional module)
    try {
      await ctx.runMutation(internal.workflow_jobs.createWorkflowJob, {
        workflowId,
        workflowName: "albumWorkflow",
        args: { albumId },
        context: { albumId },
        status: "queued",
        startedAt: Date.now(),
      });
    } catch (e) {
      // ignore if workflow_jobs module isn't installed
    }

    return workflowId;
  },
});

export const handleOnComplete = internalMutation({
  args: {
    workflowId: vWorkflowId,
    result: vResultValidator,
    context: v.object({ albumId: v.string() }),
  },
  handler: async (ctx, { workflowId, result, context }) => {
    const albumId = (context as { albumId: string }).albumId;
    if (result.kind === "success") {
      const text = result.returnValue;
      console.log(`${albumId} result: ${text}`);
    } else if (result.kind === "failed") {
      console.error("Workflow failed", result.error);
    } else if (result.kind === "canceled") {
      console.log("Workflow canceled", context);
    }
    // Update job record (best-effort; optional module)
    try {
      const payload: any = { workflowId, updatedAt: Date.now() };
      if (result.kind === "success") {
        payload.status = "success";
        payload.progress = 100;
      } else if (result.kind === "failed") {
        payload.status = "failed";
        payload.error = String((result as any).error ?? "Unknown error");
      } else if (result.kind === "canceled") {
        payload.status = "canceled";
      }
      await ctx.runMutation(internal.workflow_jobs.updateWorkflowJob, payload);
    } catch (e) {
      // ignore if workflow_jobs module isn't installed
    }

    await workflow.cleanup(ctx, workflowId);
  },
});
