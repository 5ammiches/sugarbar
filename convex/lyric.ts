import { LYRIC_SOURCES } from "@/shared/constants";
import {
  generateTitleVariantsForLyrics,
  normalizeText,
} from "@/shared/helpers";
import { LyricSource } from "@/shared/typings";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { PythonMusicProvider } from "./providers/audio_lyrics/pythonMusic";

// TODO make the REST calls here with Convex Http instead of having them in the pythonMusic.ts client
function makeLyrics(endpoint?: string) {
  endpoint = endpoint ?? process.env.PYTHON_LYRICS_URL;
  return new PythonMusicProvider(endpoint);
}

const vLyricsSource = v.union(...LYRIC_SOURCES.map((s) => v.literal(s)));

export const getLyricsByTrack = internalAction({
  args: {
    source: vLyricsSource,
    title: v.string(),
    artist: v.string(),
  },
  handler: async (ctx, args) => {
    const client = makeLyrics();

    // Generate title variants to handle apostrophe sensitivity (preserve, remove, fallback)
    const titleVariants = generateTitleVariantsForLyrics(args.title);
    const artist = normalizeText(args.artist);

    let lastError: any = null;

    for (const titleVariant of titleVariants) {
      try {
        const lyric = await client.getLyricsByTrack(
          args.source,
          titleVariant,
          artist
        );

        if (lyric && lyric.lyrics && lyric.lyrics.length > 0) {
          return lyric;
        }
      } catch (e) {
        // Record error and try next variant
        lastError = e;
      }
    }

    // If no variant returned lyrics, surface the last error if present, otherwise a generic error
    if (lastError) {
      throw lastError;
    }

    throw new Error("Lyrics not found");
  },
});

export const fetchLyricsInternal = internalAction({
  args: {
    trackId: v.id("track"),
    forceOverwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, { trackId, forceOverwrite }) => {
    const track = await ctx.runQuery(internal.db.getTrack, { trackId });
    if (!track) return false;

    const primaryArtist = await ctx.runQuery(internal.db.getArtist, {
      artistId: track.primary_artist_id,
    });

    if (!primaryArtist) {
      throw new Error("Primary artist not found");
    }

    if (track.lyrics_fetched_status !== "fetching") {
      await ctx.runMutation(internal.db.updateTrackLyricStatus, {
        trackId,
        status: "fetching",
      });
    }

    const sources: LyricSource[] = ["genius", "musixmatch"];
    let gotLyrics = false;

    for (const source of sources) {
      try {
        const lyric = await ctx.runAction(internal.lyric.getLyricsByTrack, {
          source,
          title: track.title_normalized,
          artist: primaryArtist.name_normalized,
        });

        if (!lyric || !lyric.lyrics) continue;

        try {
          await ctx.runMutation(internal.db.upsertLyricVariant, {
            trackId: trackId,
            lyric: lyric,
            forceOverwrite: !!forceOverwrite,
          });
        } catch (e) {
          console.error("upsertLyricVariant failed", e);
        }

        await ctx.runMutation(internal.db.updateTrackLyricStatus, {
          trackId,
          status: "fetched",
        });

        gotLyrics = true;
        break;
      } catch (e) {
        // Try next source
      }
    }

    if (!gotLyrics) {
      await ctx.runMutation(internal.db.updateTrackLyricStatus, {
        trackId,
        status: "failed",
      });
    }

    return gotLyrics;
  },
});

export const fetchLyrics = action({
  args: { trackId: v.id("track"), forceOverwrite: v.optional(v.boolean()) },
  handler: async (ctx, { trackId, forceOverwrite }): Promise<boolean> => {
    const result = await ctx.runAction(internal.lyric.fetchLyricsInternal, {
      trackId,
      forceOverwrite,
    });
    return result;
  },
});

export const fetchLyricsWithCustomQuery = action({
  args: {
    trackId: v.id("track"),
    customTitle: v.string(),
    customArtist: v.string(),
    forceOverwrite: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { trackId, customTitle, customArtist, forceOverwrite }
  ): Promise<boolean> => {
    const result = await ctx.runAction(
      internal.lyric.fetchLyricsInternalWithCustomQuery,
      {
        trackId,
        customTitle,
        customArtist,
        forceOverwrite,
      }
    );
    return result;
  },
});

export const fetchLyricsInternalWithCustomQuery = internalAction({
  args: {
    trackId: v.id("track"),
    customTitle: v.string(),
    customArtist: v.string(),
    forceOverwrite: v.optional(v.boolean()),
  },
  handler: async (
    ctx,
    { trackId, customTitle, customArtist, forceOverwrite }
  ) => {
    const track = await ctx.runQuery(internal.db.getTrack, { trackId });
    if (!track) return false;

    if (track.lyrics_fetched_status !== "fetching") {
      await ctx.runMutation(internal.db.updateTrackLyricStatus, {
        trackId,
        status: "fetching",
      });
    }

    const sources: LyricSource[] = ["genius", "musixmatch"];
    let gotLyrics = false;

    for (const source of sources) {
      try {
        const lyric = await ctx.runAction(internal.lyric.getLyricsByTrack, {
          source,
          title: customTitle.trim(),
          artist: customArtist.trim(),
        });

        if (!lyric || !lyric.lyrics) continue;

        try {
          await ctx.runMutation(internal.db.upsertLyricVariant, {
            trackId: trackId,
            lyric: lyric,
            forceOverwrite: !!forceOverwrite,
          });
        } catch (e) {
          console.error("upsertLyricVariant failed", e);
        }

        await ctx.runMutation(internal.db.updateTrackLyricStatus, {
          trackId,
          status: "fetched",
        });

        gotLyrics = true;
        break;
      } catch (e) {
        // Try next source
      }
    }

    if (!gotLyrics) {
      await ctx.runMutation(internal.db.updateTrackLyricStatus, {
        trackId,
        status: "failed",
      });
    }

    return gotLyrics;
  },
});
