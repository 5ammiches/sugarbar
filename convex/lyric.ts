import { LYRIC_SOURCES } from "@/lib/constants";
import * as Lyrics from "./model/lyric";
import { v } from "convex/values";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { PythonLyricProvider } from "./providers/lyrics/python_lyrics";
import { internal } from "./_generated/api";
import { LyricSource } from "./utils/typings";
import {
  normalizeText,
  normalizeTitleForLyrics,
  generateTitleVariantsForLyrics,
} from "./utils/helpers";

function makeLyrics(endpoint?: string) {
  endpoint = endpoint ?? process.env.PYTHON_LYRICS_URL;
  return new PythonLyricProvider(endpoint);
}

const vLyricsSource = v.union(...LYRIC_SOURCES.map((s) => v.literal(s)));

// TODO: possibly update the client and this function for tracks that have multiple artists
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

export const fetchLyrics = internalAction({
  args: {
    trackId: v.id("track"),
  },
  handler: async (ctx, { trackId }) => {
    const track = await ctx.runQuery(internal.db.getTrack, { trackId });
    if (!track) return;

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

        if (!lyric.lyrics) continue;

        await ctx.runMutation(internal.db.upsertLyricVariant, {
          trackId: trackId,
          lyric: lyric,
        });

        await ctx.runMutation(internal.db.updateTrackLyricStatus, {
          trackId,
          status: "fetched",
        });

        gotLyrics = true;
        break;
      } catch (e) {}
    }

    if (!gotLyrics) {
      await ctx.runMutation(internal.db.updateTrackLyricStatus, {
        trackId,
        status: "failed",
      });
    }
  },
});
