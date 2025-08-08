import { AlbumSchema, ArtistSchema } from "@/utils/typings";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { zCustomMutation } from "convex-helpers/server/zod";
import { zodToConvex } from "convex-helpers/server/zod";
import { NoOp } from "convex-helpers/server/customFunctions";
import { logger } from "@/lib/utils";

const zMutation = zCustomMutation(mutation, NoOp);

export const addAlbum = zMutation({
  args: AlbumSchema,
  handler: async (ctx, args) => {
    let existingAlbum: any = null;

    // TODO get or create artist when adding album

    if (args.spotify_id) {
      existingAlbum = await ctx.db
        .query("album")
        .filter((q) => q.eq(q.field("spotify_id"), args.spotify_id))
        .first();
    }

    if (!existingAlbum) {
      existingAlbum = await ctx.db
        .query("album")
        .filter((q) => q.eq(q.field("title"), args.title))
        .filter((q) => q.eq(q.field("artist_id"), args.artist_id))
        .first();
    }

    if (existingAlbum) {
      return existingAlbum._id;
    }

    const album = AlbumSchema.safeParse(args);
    if (!album.success) {
      logger.error(
        `Error parsing album while adding to database: ${album.error}`
      );
      throw new Error("Invalid album data");
    }

    return await ctx.db.insert("album", album);
  },
});

export const addArtist = zMutation({
  args: ArtistSchema,
  handler: async (ctx, args) => {
    // TODO
    return;
  },
});
