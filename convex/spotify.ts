import { internalAction } from "./_generated/server";
import { SpotifyProvider } from "./providers/music/spotify";

// TODO structure a way to get albums + tracks + artist + lyrics + metadata + genre_tags + audio

export const GetAlbumInfo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const spot = new SpotifyProvider(clientId, clientSecret);
    const album = await spot.searchAlbum("kendrick", "gnx");
    return album;
  },
});

export const GetTrackInfo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const spot = new SpotifyProvider(clientId, clientSecret);
    const tracks = await spot.getTracksByAlbumId("0hvT3yIEysuuvkK73vgdcW");
    return tracks;
  },
});

export const GetArtistInfo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const clientId = process.env.SPOTIFY_CLIENT_ID;
    const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

    const spot = new SpotifyProvider(clientId, clientSecret);
    const artist = await spot.getArtistById("2YZyLoL8N0Wb9xBt1NhZWg");
    return artist;
  },
});
