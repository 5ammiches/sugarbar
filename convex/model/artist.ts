import { MutationCtx } from "../_generated/server";
import { normalizeArtistName } from "../utils/helpers";
import { EmbeddedArtist, Metadata } from "../utils/typings";

export async function findOrCreateEmbeddedArtist(
  ctx: MutationCtx,
  { artist }: { artist: EmbeddedArtist }
) {
  const nameNormalized = normalizeArtistName(artist.name);
  let existing =
    artist.provider && artist.provider_id
      ? await ctx.db
          .query("artist")
          .filter((q) =>
            q.eq(q.field(`metadata.ids.${artist.provider}`), artist.provider_id)
          )
          .first()
      : null;

  if (!existing) {
    existing = await ctx.db
      .query("artist")
      .withIndex("by_name_normalized", (q) =>
        q.eq("name_normalized", nameNormalized)
      )
      .first();
  }

  let artistId = existing?._id;
  if (!artistId) {
    artistId = await ctx.db.insert("artist", {
      name: artist.name,
      name_normalized: nameNormalized,
      aliases: [],
      genre_tags: [],
      metadata: {
        ids:
          artist.provider_id && artist.provider
            ? { [artist.provider]: artist.provider_id }
            : {},
        source_urls:
          artist.url && artist.provider
            ? { [artist.provider]: artist.url }
            : {},
      },
      // processed_status: false,
    });
  } else {
    if (artist.provider_id && artist.provider) {
      const updatedIds = {
        ...(existing?.metadata?.ids ?? {}),
        [artist.provider]: artist.provider_id,
      };
      const updatedUrls = {
        ...(existing?.metadata?.source_urls ?? {}),
        [artist.provider]: artist.url,
      };
      await ctx.db.patch(artistId, {
        metadata: {
          ...(existing?.metadata ?? {}),
          ids: updatedIds,
          source_urls: updatedUrls,
        } as Metadata,
      });
    }
  }

  return artistId;
}
