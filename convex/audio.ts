import { stripFeaturingCredits } from "@/shared/helpers";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  action,
  internalAction,
  internalMutation,
  query,
} from "./_generated/server";
import { PythonMusicProvider } from "./providers/audio_lyrics/pythonMusic";

const AudioMeta = v.object({
  contentType: v.string(),
  durationSec: v.number(),
  bitrateKbps: v.float64(),
  codec: v.string(),
  sourceUrl: v.optional(v.string()),
});

function makeAudio(endpoint?: string) {
  endpoint = endpoint ?? process.env.PYTHON_LYRICS_URL;
  return new PythonMusicProvider(endpoint);
}

export const searchYT = internalAction({
  args: {
    title: v.string(),
    artist: v.string(),
    durationSec: v.number(),
  },
  returns: v.union(
    v.object({
      items: v.array(
        v.object({
          videoId: v.string(),
          title: v.string(),
          durationSec: v.number(),
          url: v.string(),
          category: v.optional(v.string()),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, { title, artist, durationSec }) => {
    const client = makeAudio();

    try {
      const searchResult = await client.searchYT(title, artist, durationSec);

      if (searchResult && searchResult.items) {
        return searchResult;
      }
      return null;
    } catch (e) {
      throw new Error(`Error searching YouTube: ${e}`);
    }
  },
});

// Public action for YouTube search
export const searchYouTube = action({
  args: {
    title: v.string(),
    artist: v.string(),
    durationSec: v.number(),
  },
  returns: v.union(
    v.object({
      items: v.array(
        v.object({
          videoId: v.string(),
          title: v.string(),
          durationSec: v.number(),
          url: v.string(),
          category: v.optional(v.string()),
        })
      ),
    }),
    v.null()
  ),
  handler: async (
    ctx,
    { title, artist, durationSec }
  ): Promise<{
    items: Array<{
      videoId: string;
      title: string;
      durationSec: number;
      url: string;
      category?: string;
    }>;
  } | null> => {
    return await ctx.runAction(internal.audio.searchYT, {
      title,
      artist,
      durationSec,
    });
  },
});

export const downloadYTAudioPreview = internalAction({
  args: {
    trackId: v.string(),
    candidates: v.array(
      v.object({
        videoId: v.string(),
        title: v.string(),
        durationSec: v.number(),
        url: v.string(),
        category: v.string(),
      })
    ),
    bitrateKbps: v.optional(v.number()),
    previewStartSec: v.optional(v.number()),
    previewLenSec: v.optional(v.number()),
  },
  handler: async (
    ctx,
    { trackId, candidates, bitrateKbps, previewStartSec, previewLenSec }
  ) => {
    const client = makeAudio();

    try {
      const preview = await client.downloadYTAudioPreview(
        trackId,
        candidates,
        bitrateKbps,
        previewStartSec,
        previewLenSec
      );

      if (!preview) return undefined;

      const storageId: Id<"_storage"> = await ctx.storage.store(preview.blob);

      return { storageId, meta: preview.meta };
    } catch (e) {
      throw new Error(`Error downloading YouTube audio preview: ${e}`);
    }
  },
});

export const fetchTrackPreviewInternal = internalAction({
  args: {
    trackId: v.id("track"),
  },
  handler: async (ctx, { trackId }) => {
    const existing = await ctx.runQuery(api.audio.getTrackPreview, {
      trackId,
    });
    if (existing) return;

    const track = await ctx.runQuery(internal.db.getTrack, { trackId });
    if (!track) return false;

    const artist = await ctx.runQuery(internal.db.getArtist, {
      artistId: track.primary_artist_id,
    });
    if (!artist) {
      throw new Error(`Artist not found for track ${trackId}`);
    }

    const title = stripFeaturingCredits(track.title_normalized);
    const dur_sec = Math.round(track.duration_ms / 1000);

    const candidates = await ctx.runAction(internal.audio.searchYT, {
      artist: artist.name_normalized,
      title: title,
      durationSec: dur_sec,
    });

    if (!candidates || !candidates.items || candidates.items.length === 0) {
      throw new Error(`No candidate URLs found for track ${trackId}`);
    }

    // Try downloading preview with all candidate objects
    let result = null;
    try {
      result = await ctx.runAction(internal.audio.downloadYTAudioPreview, {
        candidates: candidates.items,
        trackId: trackId,
      });
    } catch (error) {
      // If batch download fails, try individual candidates
      try {
        for (const item of candidates.items.slice(0, 3)) {
          result = await ctx.runAction(internal.audio.downloadYTAudioPreview, {
            candidates: [item],
            trackId: trackId,
          });
          if (result) break;
        }
      } catch (error) {
        throw new Error(
          `Failed to download preview for track ${trackId}: ${error}`
        );
      }
    }

    if (!result) {
      throw new Error(`No preview found for track ${trackId}`);
    }

    await ctx.runMutation(internal.audio.storeResult, {
      storageId: result.storageId,
      trackId,
      meta: result.meta,
    });
  },
});

export const storeResult = internalMutation({
  args: {
    storageId: v.id("_storage"),
    trackId: v.id("track"),
    meta: AudioMeta,
  },
  handler: async (ctx, { storageId, trackId, meta }) => {
    // Delete existing audio previews for this track to avoid duplicates
    const existingPreviews = await ctx.db
      .query("audio_preview")
      .withIndex("by_track_id", (q) => q.eq("trackId", trackId))
      .collect();

    for (const preview of existingPreviews) {
      await ctx.storage.delete(preview.storageId);
      await ctx.db.delete(preview._id);
    }

    await ctx.db.insert("audio_preview", {
      storageId: storageId,
      trackId: trackId,
      meta,
    });
  },
});

export const getTrackPreview = query({
  args: {
    trackId: v.id("track"),
  },
  handler: async (ctx, { trackId }) => {
    const preview = await ctx.db
      .query("audio_preview")
      .withIndex("by_track_id", (q) => q.eq("trackId", trackId))
      .first();

    if (!preview) return null;

    const url = await ctx.storage.getUrl(preview.storageId);
    if (!url) return null;

    return {
      url,
      meta: preview.meta,
    };
  },
});

export const getPreviewTrackIdsForAlbum = query({
  args: {
    albumId: v.id("album"),
  },
  returns: v.array(v.id("track")),
  handler: async (ctx, { albumId }) => {
    // Fetch all track IDs for the given album
    const albumTracks = await ctx.db
      .query("album_track")
      .withIndex("by_album_id", (q) => q.eq("album_id", albumId))
      .collect();

    if (albumTracks.length === 0) {
      return [];
    }

    const trackIds = albumTracks.map((at) => at.track_id);

    // For each track, check if an audio preview exists.
    // This runs the checks in parallel.
    const previewChecks = await Promise.all(
      trackIds.map(async (trackId) => {
        const preview = await ctx.db
          .query("audio_preview")
          .withIndex("by_track_id", (q) => q.eq("trackId", trackId))
          .first();
        return preview ? trackId : null;
      })
    );

    // Filter out nulls and return the list of track IDs that have previews.
    return previewChecks.filter((id): id is Id<"track"> => id !== null);
  },
});

// Public action for direct audio download from YouTube URL
export const fetchAudioPreviewFromUrl = action({
  args: {
    trackId: v.id("track"),
    youtubeUrl: v.string(),
    previewStartSec: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (
    ctx,
    { trackId, youtubeUrl, previewStartSec }
  ): Promise<boolean> => {
    try {
      const result = await ctx.runAction(
        internal.audio.downloadYTAudioPreview,
        {
          trackId,
          candidates: [
            {
              videoId: "",
              title: "",
              durationSec: 0,
              url: youtubeUrl,
              category: "",
            },
          ],
          previewStartSec: previewStartSec,
        }
      );

      if (!result) {
        return false;
      }

      await ctx.runMutation(internal.audio.storeResult, {
        storageId: result.storageId,
        trackId,
        meta: result.meta,
      });

      return true;
    } catch (error) {
      console.error(`Failed to download audio from URL ${youtubeUrl}:`, error);
      return false;
    }
  },
});
