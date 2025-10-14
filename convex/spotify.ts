import { Album } from "@/shared/typings";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction } from "./_generated/server";
import { SpotifyProvider } from "./providers/music/spotify";

// TODO structure a way to get albums + tracks + artist + lyrics + metadata + genre_tags + audio
function makeSpotify(clientId?: string, clientSecret?: string) {
  clientId = clientId ?? process.env.SPOTIFY_CLIENT_ID;
  clientSecret = clientSecret ?? process.env.SPOTIFY_CLIENT_SECRET;
  return new SpotifyProvider(clientId, clientSecret);
}

export const getArtistById = internalAction({
  args: {
    artistId: v.string(),
  },
  handler: async (ctx, args) => {
    const spot = makeSpotify();

    const artist = await spot.getArtistById(args.artistId);
    if (!artist) {
      throw new Error(`Artist not found for ${args.artistId}`);
    }

    return artist;
  },
});

export const getAlbumById = internalAction({
  args: {
    albumId: v.string(),
  },
  handler: async (ctx, args) => {
    const spot = makeSpotify();

    const album = await spot.getAlbumById(args.albumId);
    if (!album) {
      throw new Error(`Album not found for ${args.albumId}`);
    }

    return album;
  },
});

export const getTracksByAlbumId = internalAction({
  args: {
    albumId: v.string(),
  },
  handler: async (ctx, args) => {
    const spot = makeSpotify();

    const tracks = await spot.getTracksByAlbumId(args.albumId);
    if (!tracks || tracks.length === 0) {
      throw new Error(`No tracks found for album ${args.albumId}`);
    }

    return tracks;
  },
});

export const getTrackById = internalAction({
  args: {
    trackId: v.string(),
  },
  handler: async (ctx, args) => {
    const spot = makeSpotify();

    const track = await spot.getTrackById(args.trackId);
    if (!track) {
      throw new Error(`No track found for ${args.trackId}`);
    }

    return track;
  },
});

/**
 * returns top 10 results from search
 */
export const searchAlbum = internalAction({
  args: {
    query: v.string(),
  },
  handler: async (ctx, { query }) => {
    const spot = makeSpotify();

    const albums = await spot.searchAlbum(query);
    if (!albums || albums.length === 0) {
      throw new Error("Album not found");
    }

    return albums;
  },
});

export const searchAlbums = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, { query }): Promise<Album[]> => {
    const albums = await ctx.runAction(internal.spotify.searchAlbum, {
      query: query,
    });
    return albums;
  },
});
