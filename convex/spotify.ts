import { action, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { v } from "convex/values";
import { SPOTIFY_BASE_URL } from "../src/lib/constants";

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

export const GetAlbumInfo = internalAction({
  args: {
    albumName: v.string(),
    artist: v.string(),
    type: v.literal("album"),
  },
  handler: async (ctx, args) => {
    // TODO check if album exists in db first in a separate call

    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
      throw new Error("Spotify credentials are missing");
    }

    const spot = SpotifyApi.withClientCredentials(
      SPOTIFY_CLIENT_ID,
      SPOTIFY_CLIENT_SECRET
    );

    const searchResults = await spot.search(
      `album:${args.albumName} artist:${args.artist}`,
      ["album"],
      "US",
      5
    );

    if (!searchResults.albums.items.length) {
      throw new Error("No albums found");
    }

    const album = searchResults.albums.items[0]
    const albumId = album.id
    
    

    const albumId = searchResults["id"];
    


    return searchResults.albums.items[0];
  },
});

export const;
