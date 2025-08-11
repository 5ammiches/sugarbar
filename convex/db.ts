import { mutation } from "./_generated/server";
import { normalizeName } from "@/utils/mapping/createMapper";
import { AlbumSchema, Album } from "@/../src/utils/typings";

export const addAlbum = mutation({
  args: {},
  handler: async (ctx, rawArgs) => {
    const parsed = AlbumSchema.safeParse(rawArgs);
    let existingAlbum;

    if (!parsed.success) {
      throw new Error(`Cannot parse album arguments: ${parsed.error}`);
    }

    const args: Album = parsed.data;

    // TODO check for album name and artist name with normalization
    const artistName = normalizeName(args.artist_name);

    let artistId = args.artist_id;
    const artist = await ctx.db.get(artistId);
    if (!artist) {
      if (args.artist_name) {
        artistId = await ctx.db.insert("artist", {
          name: args.artist_name,
          name_normalized: normalizeName(args.artist_name),
          genre_tags: [],
          processed_status: false,
          metadata: {},
        });
      } else {
        throw new Error(`Album "${args.title}" does not have an artist`);
      }
    }

    existingAlbum = await ctx.db
      .query("album")
      .filter((q) => q.eq(q.field("title"), args.title))
      .filter((q) => q.eq(q.field("artist_id"), artistId))
      .first();

    if (!existingAlbum && args.metadata?.ids?.spotify) {
      existingAlbum = await ctx.db
        .query("album")
        .filter((q) =>
          q.eq(
            q.field("metadata.ids.spotify"),
            args.metadata?.ids?.spotify?.toString()
          )
        )
        .first();
    }

    if (existingAlbum) {
      return existingAlbum._id;
    }

    return await ctx.db.insert("album", {
      ...args,
      artist_id: artistId,
    });
  },
});

// TODO handle adding artists and songs
