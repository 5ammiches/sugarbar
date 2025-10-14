import { normalizeText } from "@/shared/helpers";
import { Artist } from "@/shared/typings";
import { Doc, Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";
import { mergeMetadata } from "./metadata";

type ResolveArtistResult = {
  existing: Doc<"artist"> | null;
  nameNormalized: string;
};

export async function resolveOrFindArtist(
  ctx: MutationCtx,
  { artist }: { artist: Artist }
): Promise<ResolveArtistResult> {
  let existing;
  const nameNormalized = normalizeText(artist.name);
  const incomingIds = artist.metadata?.provider_ids ?? {};

  for (const [provider, id] of Object.entries(incomingIds)) {
    if (!id) continue;

    existing = await ctx.db
      .query("artist")
      .filter((q) => q.eq(q.field(`metadata.provider_ids.${provider}`), id))
      .first();

    if (existing) {
      return {
        existing: existing,
        nameNormalized,
      };
    }
  }

  if (!existing) {
    existing = await ctx.db
      .query("artist")
      .withIndex("by_name_normalized", (q) =>
        q.eq("name_normalized", nameNormalized)
      )
      .first();
  }

  return {
    existing: existing,
    nameNormalized,
  };
}

export async function buildArtistIds(
  ctx: MutationCtx,
  { artists }: { artists: Artist[] }
): Promise<Id<"artist">[]> {
  const artistIds = [];

  for (const a of artists) {
    const artistId = await upsertArtist(ctx, { artist: a });
    artistIds.push(artistId);
  }

  return artistIds;
}

export async function upsertArtist(
  ctx: MutationCtx,
  { artist }: { artist: Artist }
): Promise<Id<"artist">> {
  const { existing, nameNormalized } = await resolveOrFindArtist(ctx, {
    artist: artist,
  });
  const incomingMeta = artist.metadata ?? {};

  if (existing) {
    const mergedMeta = mergeMetadata(existing.metadata, incomingMeta);
    const metaChanged =
      JSON.stringify(existing.metadata ?? {}) !==
      JSON.stringify(mergedMeta ?? {});

    if (metaChanged) {
      await ctx.db.patch(existing._id, {
        metadata: mergedMeta,
      });
    }

    return existing._id;
  }

  const metadata = mergeMetadata(undefined, incomingMeta);
  const artistId = await ctx.db.insert("artist", {
    name: artist.name,
    name_normalized: nameNormalized,
    aliases: [],
    metadata: metadata,
  });

  return artistId;
}
