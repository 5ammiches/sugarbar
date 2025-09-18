import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Doc, Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";
import * as Album from "./model/album";
import * as Artist from "./model/artist";
import * as Lyric from "./model/lyric";
import * as Track from "./model/track";
import { computeCanonicalKey } from "./model/track";
import { LyricsStatus } from "./schema";
import { hashLyrics, normalizeAlbumTitle } from "./utils/helpers";
import {
  AlbumSchema,
  ArtistSchema,
  LyricResponseSchema,
  TrackSchema,
} from "./utils/typings";

export const upsertAlbum = internalMutation({
  args: {
    album: v.any(),
  },
  handler: async (ctx, { album }) => {
    const al = AlbumSchema.parse(album);
    const id = await Album.upsertAlbum(ctx, { album: al });

    try {
      const existing = await ctx.db.get(id);
      if (!existing) {
        await ctx.db.patch(id, { approved: false });
      } else {
        if (existing.approved !== true) {
          await ctx.db.patch(id, { approved: false });
        }
      }
    } catch (e) {}

    return id;
  },
});

export const rejectAlbum = mutation({
  args: {
    albumId: v.id("album"),
    workflowId: v.optional(v.string()),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { albumId, workflowId, reason }) => {
    const album = await ctx.db.get(albumId);
    if (!album) {
      throw new Error("Album not found");
    }

    if (album.rejected !== true) {
      await ctx.db.patch(albumId, {
        rejected: true,
        approved: false,
        rejected_at: Date.now(),
      });
    }

    if (workflowId) {
      try {
        await ctx.runMutation(internal.workflow_jobs.updateWorkflowJob, {
          workflowId,
          status: "rejected",
          progress: 0,
          updatedAt: Date.now(),
          error: reason ?? undefined,
        });
      } catch {
        // best-effort; swallow if workflow_jobs module / update isn't available
      }
    }

    return albumId;
  },
});

export const approveAlbum = mutation({
  args: {
    albumId: v.id("album"),
    workflowId: v.optional(v.string()),
  },
  handler: async (ctx, { albumId, workflowId }) => {
    const album = await ctx.db.get(albumId);
    if (!album) {
      throw new Error("Album not found");
    }

    if (album.approved !== true) {
      await ctx.db.patch(albumId, {
        approved: true,
        rejected: false,
        approved_at: Date.now(),
      });
    }

    if (workflowId) {
      try {
        await ctx.runMutation(internal.workflow_jobs.updateWorkflowJob, {
          workflowId,
          status: "approved",
          progress: 100,
          updatedAt: Date.now(),
        });
      } catch {
        // swallow if workflow_jobs module isn't installed
      }
    }

    return albumId;
  },
});

export const getAlbum = internalQuery({
  args: { albumId: v.id("album") },
  handler: async (ctx, { albumId }) => {
    return await ctx.db.get(albumId);
  },
});

export const getAlbumDetails = query({
  args: { albumId: v.id("album") },
  handler: async (ctx, { albumId }) => {
    const album = await ctx.db.get(albumId);
    if (!album) return null;

    let primaryArtist: Doc<"artist"> | null = null;
    if (album.primary_artist_id) {
      primaryArtist = (await ctx.db.get(
        album.primary_artist_id
      )) as Doc<"artist"> | null;
    }

    const albumTracks = await ctx.db
      .query("album_track")
      .withIndex("by_album_id", (q) => q.eq("album_id", albumId))
      .collect();

    const trackIds = albumTracks.map((at) => at.track_id);
    const tracks = await Promise.all(trackIds.map((id) => ctx.db.get(id)));

    const tracksWithLyrics: Array<{
      artist: Doc<"artist"> | null;
      track: Doc<"track">;
      lyric_variants: Array<Doc<"lyric_variant">>;
    }> = [];
    for (const tr of tracks) {
      if (!tr) continue;
      const artist = await ctx.db.get(tr.primary_artist_id);
      const variants = await ctx.db
        .query("lyric_variant")
        .withIndex("by_track_id", (q) => q.eq("track_id", tr._id))
        .collect();
      tracksWithLyrics.push({
        artist: artist ?? null,
        track: tr,
        lyric_variants: variants ?? [],
      });
    }

    const albumGenreLinks = await ctx.db
      .query("album_genre")
      .withIndex("by_album_id", (q) => q.eq("album_id", albumId))
      .collect();

    const genres = await Promise.all(
      albumGenreLinks.map(async (link) => {
        const genre = await ctx.db.get(link.genre_id);
        return genre;
      })
    );

    const validGenres = genres.filter((g): g is Doc<"genre"> => g !== null);

    return {
      album,
      primaryArtist,
      tracks: tracksWithLyrics,
      genres: validGenres,
    };
  },
});

export const upsertArtist = internalMutation({
  args: { artist: v.any() },
  handler: async (ctx, { artist }) => {
    const ar = ArtistSchema.parse(artist);
    const id = await Artist.upsertArtist(ctx, { artist: ar });
    return id;
  },
});

export const getArtist = internalQuery({
  args: { artistId: v.id("artist") },
  handler: async (ctx, { artistId }) => {
    return await ctx.db.get(artistId);
  },
});

export const getArtistsByIds = query({
  args: { artistIds: v.array(v.id("artist")) },
  handler: async (ctx, { artistIds }) => {
    const artists = await Promise.all(artistIds.map((id) => ctx.db.get(id)));
    return artists.filter((a): a is Doc<"artist"> => a !== null);
  },
});

export const upsertTrack = internalMutation({
  args: {
    track: v.any(),
  },
  handler: async (ctx, { track }) => {
    const tr = TrackSchema.parse(track);
    const id = await Track.upsertTrack(ctx, { track: tr });
    return id;
  },
});

export const getTrack = internalQuery({
  args: { trackId: v.id("track") },
  handler: async (ctx, { trackId }) => {
    return await ctx.db.get(trackId);
  },
});

export const updateTrackLyricStatus = internalMutation({
  args: {
    trackId: v.id("track"),
    status: LyricsStatus,
  },
  handler: async (ctx, { trackId, status }) => {
    return await ctx.db.patch(trackId, { lyrics_fetched_status: status });
  },
});

// TODO maybe add an operation for deleting a lyric variant then updating the track's lyrics_fetched_status
export const upsertLyricVariant = internalMutation({
  args: {
    trackId: v.id("track"),
    lyric: v.any(),
    forceOverwrite: v.optional(v.boolean()),
  },
  handler: async (ctx, { trackId, lyric, forceOverwrite }) => {
    const ly = LyricResponseSchema.parse(lyric);
    const id = await Lyric.upsertLyricVariant(ctx, {
      trackId: trackId,
      lyric: ly,
      forceOverwrite: !!forceOverwrite,
    });
    return id;
  },
});

export const upsertAlbumTrack = internalMutation({
  args: {
    albumId: v.id("album"),
    trackId: v.id("track"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("album_track")
      .withIndex("by_album_track", (q) =>
        q.eq("album_id", args.albumId).eq("track_id", args.trackId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const newId = await ctx.db.insert("album_track", {
      album_id: args.albumId,
      track_id: args.trackId,
    });
    return newId;
  },
});

export const getAlbumsByIds = internalQuery({
  args: { albumIds: v.array(v.id("album")) },
  handler: async (ctx, { albumIds }) => {
    const albums = await Promise.all(albumIds.map((id) => ctx.db.get(id)));
    return albums.filter((album) => album !== null);
  },
});

/**
 * Public mutation to update editable track fields used by the review UI.
 * Accepts a partial patch with allowed fields and applies them to the track doc.
 */
export const updateTrackDetails = mutation({
  args: {
    trackId: v.id("track"),
    patch: v.record(v.string(), v.any()),
  },
  handler: async (ctx, { trackId, patch }) => {
    const allowedKeys = new Set([
      "title",
      "track_number",
      "disc_number",
      "duration_ms",
      "explicit_flag",
      "isrc",
      "edition_tag",
      "release_date",
      "metadata",
      "genre_tags",
    ]);

    const safePatch: Record<string, any> = {};
    for (const [k, vVal] of Object.entries(patch)) {
      if (allowedKeys.has(k)) {
        safePatch[k] = vVal;
      }
    }

    if ("title" in safePatch || "duration_ms" in safePatch) {
      const track = await ctx.db.get(trackId);
      if (!track) {
        throw new Error(`Track with ID ${trackId} not found`);
      }

      const titleToNormalize =
        typeof safePatch.title === "string" && safePatch.title.length > 0
          ? safePatch.title
          : track.title ?? "";

      const { base_title, edition_tag } = normalizeAlbumTitle(titleToNormalize);
      safePatch.title_normalized = base_title;
      if (edition_tag && !("edition_tag" in safePatch)) {
        safePatch.edition_tag = edition_tag;
      }

      // Determine the duration to use for canonical key: prefer patched duration if valid.
      const desiredDurationMs =
        typeof safePatch.duration_ms === "number" && safePatch.duration_ms > 0
          ? safePatch.duration_ms
          : typeof track.duration_ms === "number"
          ? track.duration_ms
          : 0;

      const primaryArtistId = track.primary_artist_id;
      if (!primaryArtistId) {
        throw new Error(
          "Track missing primary artist id; cannot compute canonical key"
        );
      }

      const canonicalKey = computeCanonicalKey(
        safePatch.title_normalized,
        primaryArtistId,
        desiredDurationMs
      );

      safePatch.canonical_key = canonicalKey;
    }

    if (Object.keys(safePatch).length === 0) {
      throw new Error("No valid fields to update");
    }

    await ctx.db.patch(trackId, safePatch);
    const updated = await ctx.db.get(trackId);
    return updated;
  },
});

/**
 * Public mutation to update lyric variant fields (not including confidence).
 */
export const updateLyricVariant = mutation({
  args: {
    lyricVariantId: v.id("lyric_variant"),
    patch: v.record(v.string(), v.any()),
  },
  handler: async (ctx, { lyricVariantId, patch }) => {
    const allowedKeys = new Set([
      "lyrics",
      "url",
      "text_hash",
      "version",
      "last_crawled_at",
      "source",
    ]);
    const safePatch: Record<string, any> = {};
    for (const [k, vVal] of Object.entries(patch)) {
      if (allowedKeys.has(k)) {
        safePatch[k] = vVal;
      }
    }

    if (Object.keys(safePatch).length === 0) {
      throw new Error("No valid fields to update");
    }

    // If lyrics were included in the patch, compute a new text_hash and update metadata.
    // Preserve or increment version based on whether the hash changed.
    try {
      const existing = await ctx.db.get(lyricVariantId);
      if (!existing) {
        throw new Error("Lyric variant not found");
      }

      if (typeof safePatch.lyrics === "string") {
        try {
          const text_hash = await hashLyrics(safePatch.lyrics);
          // If the text hash differs from existing, increment version; otherwise keep existing version
          if (existing.text_hash !== text_hash) {
            safePatch.version = (existing.version ?? 1) + 1;
          } else {
            safePatch.version = existing.version ?? 1;
          }
          safePatch.text_hash = text_hash;
          safePatch.last_crawled_at = Date.now();
          // mark as needing re-processing (NLP/alignment)
          safePatch.processed_status = false;
        } catch (e) {
          // If hashing fails for any reason, proceed without blocking the update but surface in logs
          // (best-effort behavior)
          console.error(
            "Failed to compute text_hash for lyric variant update",
            e
          );
        }
      }
    } catch (e) {
      // If we couldn't load the existing variant, still attempt the patch (will likely fail),
      // but surface the error in logs.
      console.error("Failed to load existing lyric variant for update", e);
    }

    await ctx.db.patch(lyricVariantId, safePatch);
    const updated = await ctx.db.get(lyricVariantId);
    return updated;
  },
});

export const deleteLyricVariant = mutation({
  args: {
    lyricVariantId: v.id("lyric_variant"),
  },
  handler: async (ctx, { lyricVariantId }) => {
    const variant = await ctx.db.get(lyricVariantId);
    if (!variant) {
      throw new Error("Lyric variant not found");
    }

    const trackId = variant.track_id;

    await ctx.db.delete(lyricVariantId);

    const remainingVariants = await ctx.db
      .query("lyric_variant")
      .withIndex("by_track_id", (q) => q.eq("track_id", trackId))
      .collect();

    if (remainingVariants.length === 0) {
      await ctx.db.patch(trackId, {
        lyrics_fetched_status: "not_fetched",
      });
    }

    return { success: true, remainingVariants: remainingVariants.length };
  },
});

export const getApprovedAlbums = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("album")
      .withIndex("by_approved", (q) => q.eq("approved", true))
      .collect();
    return rows.filter((a) => a.rejected !== true);
  },
});

export const getAlbumContentFlags = query({
  args: { albumIds: v.array(v.id("album")) },
  handler: async (ctx, { albumIds }) => {
    const results: {
      albumId: Id<"album">;
      hasExplicit: boolean;
      hasLyrics: boolean;
      hasAudio: boolean;
    }[] = [];

    for (const albumId of albumIds) {
      let hasExplicit = false;
      let hasLyrics = false;
      let hasAudio = false;

      const links = await ctx.db
        .query("album_track")
        .withIndex("by_album_id", (q) => q.eq("album_id", albumId))
        .collect();

      for (const link of links) {
        const track = await ctx.db.get(link.track_id);
        if (!track) continue;

        if (track.explicit_flag) hasExplicit = true;

        const md = (track.metadata ?? {}) as any;
        if (
          md?.audio_url ||
          md?.preview_url ||
          (Array.isArray(md?.audio_urls) && md.audio_urls.length > 0)
        ) {
          hasAudio = true;
        }

        if (!hasLyrics) {
          const oneLyric = await ctx.db
            .query("lyric_variant")
            .withIndex("by_track_id", (q) => q.eq("track_id", track._id))
            .first();
          if (oneLyric) hasLyrics = true;
        }

        if (hasExplicit && hasLyrics && hasAudio) break;
      }

      results.push({ albumId, hasExplicit, hasLyrics, hasAudio });
    }

    return results;
  },
});

export const updateApprovedAlbum = mutation({
  args: {
    albumId: v.id("album"),
    patch: v.record(v.string(), v.any()),
  },
  returns: v.object({
    success: v.boolean(),
    updated: v.optional(v.any()),
  }),
  handler: async (ctx, { albumId, patch }) => {
    const album = await ctx.db.get(albumId);
    if (!album) {
      throw new Error("Album not found");
    }

    if (!album.approved) {
      throw new Error("Can only edit approved albums");
    }

    const allowedKeys = new Set([
      "title",
      "edition_tag",
      "release_date",
      "total_tracks",
      "genre_tags",
      "images",
      "metadata",
    ]);

    const safePatch: Record<string, any> = {};
    for (const [k, vVal] of Object.entries(patch)) {
      if (allowedKeys.has(k)) {
        safePatch[k] = vVal;
      }
    }

    if (Object.keys(safePatch).length === 0) {
      return { success: false };
    }

    if ("title" in safePatch) {
      const { normalizeAlbumTitle } = await import("./utils/helpers");
      const { base_title, edition_tag } = normalizeAlbumTitle(safePatch.title);
      safePatch.title_normalized = base_title;
      if (edition_tag && !("edition_tag" in safePatch)) {
        safePatch.edition_tag = edition_tag;
      }

      // No canonical key for albums here; leave canonical logic to track changes.
    }

    safePatch.last_edited_at = Date.now();

    await ctx.db.patch(albumId, safePatch);
    const updated = await ctx.db.get(albumId);

    return { success: true, updated };
  },
});
