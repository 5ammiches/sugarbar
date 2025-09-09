import { MutationCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";
import { Album } from "../utils/typings";
import * as Artist from "./artist";
import * as Metadata from "./metadata";
import { normalizeAlbumTitle } from "../utils/helpers";

type ResolveAlbumResult = {
  existing: Doc<"album"> | null;
  titleNormalized: string;
  editionTag: string | "";
  artistIds: Id<"artist">[];
  primaryArtistId: Id<"artist">;
};

export async function resolveOrFindAlbum(
  ctx: MutationCtx,
  { album }: { album: Album }
): Promise<ResolveAlbumResult> {
  const { base_title, edition_tag } = normalizeAlbumTitle(album.title);
  const titleNormalized = base_title;
  const editionTag = edition_tag ?? "";
  let existing: Doc<"album"> | null = null;

  // collect/create Embedded Artist IDs
  const artistIds: Id<"artist">[] = await Artist.buildArtistIds(ctx, {
    artists: album.artists,
  });

  // Find or create primary artist after building Artist IDs
  const primaryArtistId: Id<"artist"> = album.primary_artist
    ? await Artist.upsertArtist(ctx, {
        artist: album.primary_artist,
      })
    : artistIds[0];

  if (!primaryArtistId) {
    throw new Error("Album requires a primary artist");
  }

  // Ensure artist_ids only reflect album.artists; include primary if artists is empty
  if (artistIds.length === 0 && primaryArtistId) {
    artistIds.push(primaryArtistId);
  }
  // Sort ArtistIDs since the sorted array will be used for resolving / creating album
  artistIds.sort();

  const providerIds = album.metadata?.provider_ids ?? {};
  for (const [provider, id] of Object.entries(providerIds)) {
    if (!id) continue;

    existing = await ctx.db
      .query("album")
      .filter((q) => q.eq(q.field(`metadata.provider_ids.${provider}`), id))
      .first();

    if (existing) {
      return {
        existing: existing,
        titleNormalized: titleNormalized,
        editionTag: editionTag,
        artistIds: artistIds,
        primaryArtistId: primaryArtistId,
      };
    }
  }

  if (!existing) {
    existing = await ctx.db
      .query("album")
      .withIndex("by_title_primary_edition", (q) =>
        q
          .eq("title_normalized", titleNormalized)
          .eq("primary_artist_id", primaryArtistId)
          .eq("edition_tag", editionTag)
      )
      .first();
  }

  // TODO maybe don't check for album existence with the artistIds array and just primary artist
  if (!existing && artistIds.length > 0) {
    existing = await ctx.db
      .query("album")
      .withIndex("by_title_artist_ids_edition", (q) =>
        q
          .eq("title_normalized", titleNormalized)
          .eq("artist_ids", artistIds)
          .eq("edition_tag", editionTag)
      )
      .first();
  }

  return {
    existing: existing,
    titleNormalized: titleNormalized,
    editionTag: editionTag,
    artistIds: artistIds,
    primaryArtistId: primaryArtistId,
  };
}

export async function upsertAlbum(
  ctx: MutationCtx,
  { album }: { album: Album }
): Promise<Id<"album">> {
  const { existing, titleNormalized, artistIds, editionTag, primaryArtistId } =
    await resolveOrFindAlbum(ctx, { album: album });

  const incomingMetadata = album.metadata ?? {};
  const totalTracks =
    album.total_tracks ??
    (Array.isArray(album.tracks) ? album.tracks.length : 0);

  if (existing) {
    await ctx.db.patch(existing._id, {
      title: album.title,
      title_normalized: titleNormalized,
      primary_artist_id: primaryArtistId ?? existing.primary_artist_id,

      edition_tag: editionTag ?? existing?.edition_tag,
      release_date: album.release_date ?? existing?.release_date,
      total_tracks: totalTracks || existing?.total_tracks,
      genre_tags:
        (album.genre_tags && album.genre_tags.length > 0
          ? album.genre_tags
          : existing?.genre_tags) ?? [],
      metadata: Metadata.mergeMetadata(existing?.metadata, incomingMetadata),
    });
    if (Array.isArray(album.tracks) && album.tracks.length > 0) {
      await ctx.db.patch(existing._id, { artist_ids: artistIds });
    }
    return existing._id;
  }

  const newId = await ctx.db.insert("album", {
    title: album.title,
    title_normalized: titleNormalized,
    primary_artist_id: primaryArtistId ?? artistIds[0],
    artist_ids: artistIds.length > 0 ? artistIds : [primaryArtistId],
    release_date: album.release_date ?? "",
    total_tracks: totalTracks,
    edition_tag: editionTag,
    genre_tags: album.genre_tags ?? [],
    metadata: incomingMetadata,
    // processed_status: false,
  });
  return newId;
}
