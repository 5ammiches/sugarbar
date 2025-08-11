import { logger } from "@/lib/utils";
import { internalAction } from "./_generated/server";
import {
  mapSpotifyAlbum,
  mapSpotifyArtist,
  mapSpotifyTrack,
} from "@/utils/spotify/spotifyMap";
import { Album, AlbumSchema, Track } from "@/utils/typings";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { ConvexError, v } from "convex/values";

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

    let searchResults;

    try {
      searchResults = await spot.search(
        `album:${args.albumName} artist:${args.artist}`,
        ["album"],
        "US",
        5
      );
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Spotify: Error when searching for album", {
          albumName: args.albumName,
          artist: args.artist,
          error: err.message,
        });
        throw new ConvexError(
          `Spotify: Error searching for album: ${err.message}`
        );
      }
    }

    if (!searchResults || !searchResults.albums.items.length) {
      logger.error("Spotify: No albums found for search", {
        albumName: args.albumName,
        artist: args.artist,
      });
      throw new ConvexError(
        `Spotify: No albums found for search: ${args.albumName} by ${args.artist}`
      );
    }

    const result = searchResults.albums.items[0];

    const album = mapSpotifyAlbum(result);
    return album;
  },
});

export const GetTrackInfo = internalAction({
  args: { albumId: v.string() },
  handler: async (ctx, args) => {
    const spot = getSpotifyClient();

    let album;
    try {
      album = await spot.albums.get(args.albumId);
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Spotify: Error fetching album from Spotify", {
          albumId: args.albumId,
          error: err.message,
        });

        if (
          err.message.includes("404") ||
          err.message.includes("Resource not found")
        ) {
          throw new ConvexError(
            `Spotify: Album not found for ID: ${args.albumId}`
          );
        }
        throw new ConvexError(`Spotify: Error fetching album: ${err.message}`);
      }

      throw new ConvexError("Spotify: Error fetching album: Unknown error");
    }

    if (!album) {
      logger.error(`Spotify: No album found for ID: ${args.albumId}`, {
        albumId: args.albumId,
      });
      throw new ConvexError(`Spotify: No album found for ID: ${args.albumId}`);
    }

    const releaseDate = album.release_date;
    const albumName = album.name;
    const result = album.tracks.items;

    // TODO get lyrics for tracks from notable sources
    const tracks: Track[] = [];

    for (const item of result) {
      const mappedTrack = mapSpotifyTrack({
        ...item,
        release_date: releaseDate,
        album_name: albumName,
      });
      if (mappedTrack) {
        tracks.push(mappedTrack);
      }
    }

    return tracks;
  },
});

export const GetArtistInfo = internalAction({
  args: { artistId: v.string() },
  handler: async (ctx, args) => {
    const spot = getSpotifyClient();

    let result;
    try {
      result = await spot.artists.get(args.artistId);
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Spotify: Error fetching artist from Spotify", {
          artistId: args.artistId,
          error: err.message,
        });
        if (
          err.message.includes("404") ||
          err.message.includes("Resource not found")
        ) {
          throw new ConvexError(
            `Spotify: Artist not found for ID: ${args.artistId}`
          );
        }
        throw new ConvexError(`Spotify: Error fetching artist: ${err.message}`);
      }

      throw new ConvexError("Spotify: Error fetching artist: Unknown error");
    }

    if (!result) {
      logger.error(
        `Spotify: No artist found from Spotify for ID : ${args.artistId}`,
        {
          artistId: args.artistId,
        }
      );
      throw new ConvexError(
        `Spotify: No artist found from Spotify for ID: ${args.artistId}`
      );
    }

    const artist = mapSpotifyArtist(result);
    return artist;
  },
});
