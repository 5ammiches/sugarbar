import { internalAction } from "./_generated/server";
import { mapSpotifyAlbum } from "@/utils/spotify/spotifyMap";
import { Album, AlbumSchema } from "@/utils/typings";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { v } from "convex/values";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

function getSpotifyClient() {
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error("Spotify credentials are missing");
  }

  return SpotifyApi.withClientCredentials(
    SPOTIFY_CLIENT_ID,
    SPOTIFY_CLIENT_SECRET
  );
}

export const GetAlbumInfo = internalAction({
  args: {
    albumName: v.string(),
    artist: v.string(),
    type: v.literal("album"),
  },
  handler: async (ctx, args) => {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      throw new Error("Spotify credentials are missing");
    }

    const spot = getSpotifyClient();

    const searchResults = await spot.search(
      `album:${args.albumName} artist:${args.artist}`,
      ["album"],
      "US",
      5
    );

    if (!searchResults || !searchResults.albums.items.length) {
      throw new Error("No albums found");
    }

    const result = searchResults.albums.items[0];

    const album = mapSpotifyAlbum(result);
    return album;
  },
});

export const GetTrackInfo = internalAction({
  args: {
    albumId: v.number(),
  },
  handler: async (ctx, args) => {
    // TODO setup getting artist and track info then use an action pipeline to process albums, tracks, and artists
    return;
  },
});

export const GetArtistInfo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    return;
  },
});
