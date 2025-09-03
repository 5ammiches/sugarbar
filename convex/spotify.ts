import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
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

    return { artist: artist };
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

    return { album: album };
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

    return { tracks: tracks };
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

    return { track: track };
  },
});

/**
 * returns top 5 results from search
 */
export const searchAlbum = internalAction({
  args: {
    album: v.string(),
    artist: v.string(),
  },
  handler: async (ctx, args) => {
    const spot = makeSpotify();

    const albums = await spot.searchAlbum(args.album, args.artist);
    if (!albums || albums.length === 0) {
      throw new Error("Album not found");
    }

    return { albums: albums };

    // const id = albums[0].metadata?.ids?.spotify;
    // if (!id) {
    //   throw new Error("Album ID not found");
    // }

    // const album = await spot.getAlbumById(id);
    // if (!album) {
    //   throw new Error("Album not found");
    // }

    // const baseTracks = album.tracks ?? [];
    // if (baseTracks.length === 0) {
    //   return { album, tracks: [] };
    // }

    // const enriched = await Promise.all(
    //   baseTracks.map(async (t) => {
    //     const trackId = t.provider_id;
    //     if (!trackId) return t;

    //     try {
    //       const full = await spot.getTrackById(trackId);
    //       if (!full) return t;

    //       const isrc = full.isrc ?? null;
    //       const metadata = full.metadata ?? {};

    //       return {
    //         ...t,
    //         artists: full.artists,
    //         isrc,
    //         metadata,
    //       };
    //     } catch {
    //       return t;
    //     }
    //   })
    // );

    // return {
    //   album,
    //   tracks: enriched,
    // };
  },
});
