import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import * as Artist from "./model/artist";
import * as Metadata from "./model/metadata";
import { v } from "convex/values";
import { normalizeAlbumTitle, normalizeArtistName } from "./utils/helpers";
import {
  AlbumSchema,
  Album,
  EmbeddedArtist,
  EmbeddedArtistSchema,
} from "./utils/typings";
import { Id } from "./_generated/dataModel";

// TODO organize and modularize this code
export const findOrCreateEmbeddedArtist = internalMutation({
  args: {
    artist: v.any(),
  },
  handler: async (ctx, { artist }) => {
    const ar = EmbeddedArtistSchema.parse(artist);
    return Artist.findOrCreateEmbeddedArtist(ctx, { artist: ar });
  },
});

export const addAlbum = internalMutation({
  args: { album: v.any() },
  handler: async (ctx, args) => {
    const al = AlbumSchema.parse(args.album);
    let existing;

    const { base_title, edition_tag } = normalizeAlbumTitle(al.title);
    const titleNormalized = base_title;
    const edTag = edition_tag ?? "";

    // collect Artist IDs
    const artistIds: Id<"artist">[] = [];
    for (const a of al.artists) {
      const artistId = await ctx.runMutation(
        internal.db.findOrCreateEmbeddedArtist,
        {
          artist: a,
        }
      );
      artistIds.push(artistId);
    }

    // Find or create primary artist
    let primaryArtistId: Id<"artist">;
    if (al.primary_artist) {
      primaryArtistId = await ctx.runMutation(
        internal.db.findOrCreateEmbeddedArtist,
        {
          artist: al.primary_artist,
        }
      );
    } else if (artistIds.length > 0) {
      primaryArtistId = artistIds[0];
    }

    // find existing album by provider IDs
    const providerIds = al.metadata?.ids ?? {};
    for (const [provider, id] of Object.entries(providerIds)) {
      if (!id) continue;

      const hit = await ctx.db
        .query("album")
        .filter((q) => q.eq(q.field(`metadata.ids.${provider}`), id))
        .first();

      if (hit) {
        existing = hit;
        break;
      }
    }

    if (!existing) {
      existing = await ctx.db
        .query("album")
        .withIndex("by_title_primary_edition", (q) =>
          q
            .eq("title_normalized", titleNormalized)
            .eq("primary_artist_id", primaryArtistId)
            .eq("edition_tag", edTag)
        )
        .first();
    }

    artistIds.sort();
    if (!existing && artistIds.length > 0) {
      existing = await ctx.db
        .query("album")
        .withIndex("by_title_artist_ids_edition", (q) =>
          q
            .eq("title_normalized", titleNormalized)
            .eq("artist_ids", artistIds)
            .eq("edition_tag", edTag)
        )
        .first();
    }

    const incomingMetadata = al.metadata ?? {};
    const totalTracks =
      al.total_tracks ?? (Array.isArray(al.tracks) ? al.tracks.length : 0);

    const albumId = existing?._id;
    if (albumId) {
      await ctx.db.patch(albumId, {
        title: al.title,
        title_normalized: titleNormalized,
        artist_ids: artistIds,
        edition_tag: edition_tag ?? existing?.edition_tag,
        release_date: al.release_date ?? existing?.release_date,
        total_tracks: totalTracks || existing?.total_tracks,
        genre_tags:
          (al.genre_tags && al.genre_tags.length > 0
            ? al.genre_tags
            : existing?.genre_tags) ?? [],
        metadata: Metadata.shallowMergeMetadata(
          existing?.metadata,
          incomingMetadata
        ),
      });
    } else {
      const newId = await ctx.db.insert("album", {
        title: al.title,
        title_normalized: titleNormalized,
        primary_artist_id: artistIds[0],
        artist_ids: artistIds,
        release_date: al.release_date ?? "",
        total_tracks: totalTracks,
        edition_tag, // may be undefined
        genre_tags: al.genre_tags ?? [],
        metadata: incomingMetadata,
        // processed_status: false,
      });
      return newId;
    }
  },
});
