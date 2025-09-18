import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { Track, Album } from "../utils/typings";
import * as Artist from "./artist";
import * as AlbumModel from "./album";
import * as Metadata from "./metadata";
import { normalizeText } from "../utils/helpers";

export function computeCanonicalKey(
  titleNormalized: string,
  primaryArtistId: Id<"artist">,
  durationMs: number
): string {
  const bucket = Math.round(durationMs / 3000); // 3s bucket
  return `${titleNormalized}|${primaryArtistId}|${bucket}`;
}

type ResolveTrackResult = {
  existing: Doc<"track"> | null;
  titleNormalized: string;
  artistIds: Id<"artist">[];
  primaryArtistId: Id<"artist">;
};

export async function resolveOrFindTrack(
  ctx: MutationCtx,
  { track }: { track: Track }
): Promise<ResolveTrackResult> {
  const titleNormalized = normalizeText(track.title);

  // Resolve artists
  const artistIds: Id<"artist">[] = await Artist.buildArtistIds(ctx, {
    artists: track.artists ?? [],
  });

  const primaryArtistId: Id<"artist"> | undefined = track.primary_artist
    ? await Artist.upsertArtist(ctx, { artist: track.primary_artist })
    : artistIds[0];

  if (!primaryArtistId) {
    throw new Error("Track requires a primary artist");
  }

  // Ensure the album exists (if embedded album provided)
  if (track.album?.title || track.album?.metadata) {
    const minimalAlbum: Album = {
      title: track.album?.title ?? "",
      primary_artist: track.primary_artist,
      artists: track.primary_artist ? [track.primary_artist] : [],
      release_date: track.release_date,
      metadata: track.album?.metadata,
      genre_tags: [],
      total_tracks: undefined,
      tracks: [],
    };
    await AlbumModel.upsertAlbum(ctx, { album: minimalAlbum });
  }

  // Lookup by provider ids only (single source of truth)
  let existing: any | null = null;
  const providerIds = track.metadata?.provider_ids ?? {};
  for (const [provider, id] of Object.entries(providerIds)) {
    if (!id) continue;

    existing =
      (await ctx.db
        .query("track")
        .filter((q) => q.eq(q.field(`metadata.provider_ids.${provider}`), id))
        .first()) ?? null;

    if (existing) {
      return {
        existing: existing,
        titleNormalized: titleNormalized,
        artistIds: artistIds,
        primaryArtistId: primaryArtistId,
      };
    }
  }

  // Lookup by ISRC
  if (track.isrc) {
    existing =
      (await ctx.db
        .query("track")
        .filter((q) => q.eq(q.field("isrc"), track.isrc))
        .first()) ?? null;

    if (existing) {
      return { existing, titleNormalized, artistIds, primaryArtistId };
    }
  }

  // Heuristic: title_normalized + primaryArtistId + albumId + duration_ms
  const candidates = await ctx.db
    .query("track")
    .filter((q) => q.eq(q.field("title_normalized"), titleNormalized))
    .collect();

  const filtered = candidates.filter((t) => {
    const primaryMatch = primaryArtistId
      ? t.primary_artist_id === primaryArtistId
      : true;
    const durationMatch =
      typeof track.duration_ms === "number"
        ? t.duration_ms === track.duration_ms
        : true;

    return primaryMatch && durationMatch;
  });

  if (filtered.length > 0) {
    existing = filtered[0];
    return { existing, titleNormalized, artistIds, primaryArtistId };
  }

  return {
    existing: existing,
    titleNormalized,
    artistIds,
    primaryArtistId,
  };
}

export async function upsertTrack(
  ctx: MutationCtx,
  { track }: { track: Track }
): Promise<Id<"track">> {
  const { existing, titleNormalized, artistIds, primaryArtistId } =
    await resolveOrFindTrack(ctx, { track });

  const incomingMeta = track.metadata ?? {};

  if (existing) {
    const desiredPrimaryArtistId =
      primaryArtistId ?? existing.primary_artist_id;

    const desiredDurationMs =
      typeof track.duration_ms === "number"
        ? track.duration_ms
        : existing.duration_ms;

    const canonicalKey = computeCanonicalKey(
      titleNormalized,
      desiredPrimaryArtistId,
      desiredDurationMs
    );

    await ctx.db.patch(existing._id, {
      title: track.title,
      title_normalized: titleNormalized,
      isrc: track.isrc ?? existing.isrc,
      release_date: track.release_date ?? existing.release_date,
      duration_ms: desiredDurationMs,
      explicit_flag:
        typeof track.explicit_flag === "boolean"
          ? track.explicit_flag
          : existing.explicit_flag,
      primary_artist_id: desiredPrimaryArtistId,
      artist_ids: artistIds.length > 0 ? artistIds : existing.artist_ids ?? [],
      lyrics_fetched_status:
        track.lyrics_fetched_status ??
        existing.lyrics_fetched_status ??
        "not_fetched",
      canonical_key: canonicalKey,
      metadata: Metadata.mergeMetadata(existing.metadata, incomingMeta),
    });

    return existing._id;
  }

  const desiredPrimaryArtistId = primaryArtistId ?? artistIds[0];
  if (!desiredPrimaryArtistId) {
    throw new Error("Track requires a primary artist");
  }

  const canonicalKey = computeCanonicalKey(
    titleNormalized,
    desiredPrimaryArtistId,
    track.duration_ms
  );

  const newId = await ctx.db.insert("track", {
    title: track.title,
    title_normalized: titleNormalized,
    isrc: track.isrc ?? "",
    release_date: track.release_date ?? "",
    duration_ms: track.duration_ms,
    explicit_flag: track.explicit_flag,
    primary_artist_id: desiredPrimaryArtistId,
    artist_ids: artistIds,
    lyrics_fetched_status: track.lyrics_fetched_status ?? "not_fetched",
    canonical_key: canonicalKey,
    metadata: incomingMeta,
  });

  return newId;
}
