import { LYRIC_SOURCES } from "@/lib/constants";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { PythonLyricProvider } from "./providers/lyrics/python_lyrics";
import { generateTitleVariantsForLyrics, normalizeText } from "./utils/helpers";
import { LyricSource } from "./utils/typings";

/**
 * Small helper to build the external lyrics provider client.
 * The endpoint defaults to PYTHON_LYRICS_URL env var.
 */
function makeLyrics(endpoint?: string) {
  endpoint = endpoint ?? process.env.PYTHON_LYRICS_URL;
  return new PythonLyricProvider(endpoint);
}

const vLyricsSource = v.union(...LYRIC_SOURCES.map((s) => v.literal(s)));

/**
 * Try to fetch lyrics from the configured external providers for a given
 * normalized title/artist. We attempt a small set of normalized title variants
 * so we can handle punctuation/apostrophe variations.
 *
 * Returns the provider response (LyricResponse) on success or throws.
 */
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

/**
 * Internal action that attempts to fetch lyrics for a track and persist them.
 *
 * New behavior: accepts an optional `forceOverwrite` boolean. When true, the
 * underlying model upsert will force writing provider lyrics into the existing
 * variant record even if the normalized text hash matches. This is useful for
 * reviewer-initiated retries where the reviewer expects the fetch attempt to
 * refresh/overwrite DB content.
 *
 * Returns `true` if any lyrics were obtained from providers and persisted,
 * otherwise `false`.
 */
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

/**
 * Public action to trigger a lyric fetch for a track.
 *
 * Accepts optional `forceOverwrite` boolean which is forwarded to the internal
 * handler and to the model upsert operation. Returns a boolean indicating
 * whether lyrics were found/persisted.
 */
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
