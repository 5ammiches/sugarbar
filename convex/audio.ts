import { PythonProvider } from "./providers/audio_lyrics/python";
import { v } from "convex/values";
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  query,
} from "./_generated/server";
import { api } from "./_generated/api";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { stripFeaturingCredits } from "./utils/helpers";

const AudioMeta = v.object({
  contentType: v.string(),
  durationSec: v.number(),
  bitrateKbps: v.number(),
  codec: v.string(),
  sourceUrl: v.optional(v.string()),
});

function makeAudio(endpoint?: string) {
  endpoint = endpoint ?? process.env.PYTHON_LYRICS_URL;
  return new PythonProvider(endpoint);
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
    candidateUrls: v.array(v.string()),
    bitrateKbps: v.optional(v.number()),
    previewStartSec: v.optional(v.number()),
    previewLenSec: v.optional(v.number()),
  },
  handler: async (ctx, { trackId, candidateUrls, bitrateKbps, previewStartSec, previewLenSec }) => {
    const client = makeAudio();

    try {
      const preview = await client.downloadYTAudioPreview(
        trackId,
        candidateUrls,
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

    const candidateUrls = await ctx.runAction(internal.audio.searchYT, {
      artist: artist.name_normalized,
      title: title,
      durationSec: dur_sec,
    });

    if (!candidateUrls || !candidateUrls.items || candidateUrls.items.length === 0) {
      throw new Error(`No candidate URLs found for track ${trackId}`);
    }

    // Try downloading preview with all candidate URLs
    let result = null;
    try {
      result = await ctx.runAction(internal.audio.downloadYTAudioPreview, {
        candidateUrls: candidateUrls.items.map((item: any) => item.url),
        trackId: trackId,
      });
    } catch (error) {
      // If batch download fails, try individual URLs
      for (const item of candidateUrls.items.slice(0, 3)) {
        try {
          result = await ctx.runAction(internal.audio.downloadYTAudioPreview, {
            candidateUrls: [item.url],
            trackId: trackId,
          });
          if (result) break;
        } catch (e) {
          // Continue to next URL
          continue;
        }
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

    // Insert new preview
    await ctx.db.insert("audio_preview", { storageId, trackId, meta });
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

export const fetchTrackPreviewWithCustomQuery = internalAction({
  args: {
    trackId: v.id("track"),
    customTitle: v.string(),
    customArtist: v.string(),
  },
  handler: async (ctx, { trackId, customTitle, customArtist }) => {
    const track = await ctx.runQuery(internal.db.getTrack, { trackId });
    if (!track) return false;

    const title = stripFeaturingCredits(customTitle.trim());
    const artist = customArtist.trim();
    const dur_sec = Math.ceil(track.duration_ms / 1000);

    const candidateUrls = await ctx.runAction(internal.audio.searchYT, {
      artist: artist,
      title: title,
      durationSec: dur_sec,
    });

    if (!candidateUrls || !candidateUrls.items || candidateUrls.items.length === 0) {
      throw new Error(`No candidate URLs found for custom query: ${title} - ${artist}`);
    }

    // Try downloading preview with all candidate URLs
    let result = null;
    try {
      result = await ctx.runAction(internal.audio.downloadYTAudioPreview, {
        candidateUrls: candidateUrls.items.map((item) => item.url),
        trackId: trackId,
      });
    } catch (error) {
      // If batch download fails, try individual URLs
      for (const item of candidateUrls.items.slice(0, 3)) {
        try {
          result = await ctx.runAction(internal.audio.downloadYTAudioPreview, {
            candidateUrls: [item.url],
            trackId: trackId,
          });
          if (result) break;
        } catch (e) {
          // Continue to next URL
          continue;
        }
      }
    }

    if (!result) {
      throw new Error(`No preview found for custom query: ${title} - ${artist}`);
    }

    await ctx.runMutation(internal.audio.storeResult, {
      storageId: result.storageId,
      trackId,
      meta: result.meta,
    });

    return true;
  },
});

// Public action for custom audio preview fetch
export const fetchAudioPreviewWithCustomQuery = action({
  args: {
    trackId: v.id("track"),
    customTitle: v.string(),
    customArtist: v.string(),
  },
  returns: v.boolean(),
  handler: async (ctx, { trackId, customTitle, customArtist }): Promise<boolean> => {
    const result = await ctx.runAction(internal.audio.fetchTrackPreviewWithCustomQuery, {
      trackId,
      customTitle,
      customArtist,
    });
    return result;
  },
});

// Public action for direct audio download from YouTube URL
// This function downloads audio from a specific YouTube URL without performing a search
export const fetchAudioPreviewFromUrl = action({
  args: {
    trackId: v.id("track"),
    youtubeUrl: v.string(),
    previewStartSec: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, { trackId, youtubeUrl, previewStartSec }): Promise<boolean> => {
    try {
      const result = await ctx.runAction(internal.audio.downloadYTAudioPreview, {
        trackId,
        candidateUrls: [youtubeUrl],
        previewStartSec: previewStartSec,
      });

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
