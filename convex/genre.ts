import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { normalizeForCompare, slugify } from "./utils/helpers";

export const searchGenres = query({
  args: { query: v.string() },
  returns: v.array(
    v.object({
      id: v.id("genre"),
      name: v.string(),
      slug: v.string(),
    })
  ),
  handler: async (ctx, { query }) => {
    const qNorm = normalizeForCompare(query || "");
    if (!qNorm) return [];

    const genres = await ctx.db.query("genre").collect();

    const results = new Map<string, { id: any; name: string; slug: string }>();

    for (const g of genres) {
      if (!g?.name_normalized) continue;
      const nn: string = g.name_normalized;
      if (nn.startsWith(qNorm) || nn.includes(qNorm)) {
        results.set(String(g._id), { id: g._id, name: g.name, slug: g.slug });
      }
    }

    const out = Array.from(results.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );

    return out;
  },
});

export const createGenre = mutation({
  args: { name: v.string() },
  returns: v.id("genre"),
  handler: async (ctx, { name }) => {
    return await findOrCreateGenre(ctx, name);
  },
});

export const getGenresByIds = query({
  args: { genreIds: v.array(v.id("genre")) },
  returns: v.array(
    v.object({
      id: v.id("genre"),
      name: v.string(),
      slug: v.string(),
    })
  ),
  handler: async (ctx, { genreIds }) => {
    const genres = await Promise.all(
      genreIds.map(async (id) => {
        const genre = await ctx.db.get(id);
        return genre
          ? { id: genre._id, name: genre.name, slug: genre.slug }
          : null;
      })
    );
    return genres.filter(
      (g): g is { id: any; name: string; slug: string } => g !== null
    );
  },
});

export const getAlbumGenres = query({
  args: { albumIds: v.array(v.id("album")) },
  returns: v.array(
    v.object({
      albumId: v.id("album"),
      genres: v.array(
        v.object({
          id: v.id("genre"),
          name: v.string(),
          slug: v.string(),
        })
      ),
    })
  ),
  handler: async (ctx, { albumIds }) => {
    const result = [];

    for (const albumId of albumIds) {
      const albumGenreLinks = await ctx.db
        .query("album_genre")
        .withIndex("by_album_id", (q) => q.eq("album_id", albumId))
        .collect();

      const genres = await Promise.all(
        albumGenreLinks.map(async (link) => {
          const genre = await ctx.db.get(link.genre_id);
          return genre
            ? { id: genre._id, name: genre.name, slug: genre.slug }
            : null;
        })
      );

      const validGenres = genres.filter(
        (g): g is { id: any; name: string; slug: string } => g !== null
      );

      result.push({
        albumId,
        genres: validGenres,
      });
    }

    return result;
  },
});

async function findOrCreateGenre(ctx: any, name: string) {
  const genreNorm = normalizeForCompare(name);
  const baseSlug = slugify(name);

  const canonical = await ctx.db
    .query("genre")
    .withIndex("by_name_normalized", (q: any) =>
      q.eq("name_normalized", genreNorm)
    )
    .first();
  if (canonical) {
    return canonical._id;
  }

  let slug = baseSlug;
  let n = 2;
  while (
    await ctx.db
      .query("genre")
      .withIndex("by_slug", (q: any) => q.eq("slug", slug))
      .first()
  ) {
    slug = `${baseSlug}-${n++}`;
  }

  const id = await ctx.db.insert("genre", {
    name,
    name_normalized: genreNorm,
    slug,
  });

  return id;
}

export const upsertAlbumGenres = mutation({
  args: {
    albumId: v.id("album"),
    inputs: v.array(v.id("genre")),
  },
  handler: async (ctx, { albumId, inputs }) => {
    const seen = new Set<string>();
    let inserted = 0;

    for (const genreId of inputs ?? []) {
      const key = String(genreId);
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = await ctx.db
        .query("album_genre")
        .withIndex("by_album_genre", (q: any) =>
          q.eq("album_id", albumId).eq("genre_id", genreId)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("album_genre", {
          album_id: albumId,
          genre_id: genreId,
        });
        inserted++;
      }
    }

    return { inserted };
  },
});

export const removeAlbumGenre = mutation({
  args: { albumId: v.id("album"), genreId: v.id("genre") },
  handler: async (ctx, { albumId, genreId }) => {
    const existing = await ctx.db
      .query("album_genre")
      .withIndex("by_album_genre", (q: any) =>
        q.eq("album_id", albumId).eq("genre_id", genreId)
      )
      .first();

    if (!existing) return { removed: false };

    await ctx.db.delete(existing._id);
    return { removed: true };
  },
});

export const upsertArtistGenres = mutation({
  args: {
    artistId: v.id("artist"),
    inputs: v.array(v.id("genre")),
  },
  handler: async (ctx, { artistId, inputs }) => {
    const seen = new Set<string>();
    let inserted = 0;

    for (const genreId of inputs ?? []) {
      const key = String(genreId);
      if (seen.has(key)) continue;
      seen.add(key);

      const existing = await ctx.db
        .query("artist_genre")
        .withIndex("by_artist_genre", (q: any) =>
          q.eq("artist_id", artistId).eq("genre_id", genreId)
        )
        .first();

      if (!existing) {
        await ctx.db.insert("artist_genre", {
          artist_id: artistId,
          genre_id: genreId,
        });
        inserted++;
      }
    }

    return { inserted };
  },
});

export const removeArtistGenre = mutation({
  args: { artistId: v.id("artist"), genreId: v.id("genre") },
  handler: async (ctx, { artistId, genreId }) => {
    const existing = await ctx.db
      .query("artist_genre")
      .withIndex("by_artist_genre", (q: any) =>
        q.eq("artist_id", artistId).eq("genre_id", genreId)
      )
      .first();

    if (!existing) return { removed: false };

    await ctx.db.delete(existing._id);
    return { removed: true };
  },
});
