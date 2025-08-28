import { internalAction } from "./_generated/server";
import { SpotifyProvider } from "@/utils/providers/music/spotify";

// TODO structure a way to get albums + tracks + artist + lyrics + metadata + genre_tags + audio
const spot = new SpotifyProvider();

export const GetAlbumInfo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const album = await spot.searchAlbum("kendrick", "gnx");
    return album;
  },
});

export const GetTrackInfo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const tracks = await spot.getTracksByAlbumId("0hvT3yIEysuuvkK73vgdcW");
    return tracks;
  },
});

export const GetArtistInfo = internalAction({
  args: {},
  handler: async (ctx, args) => {
    const artist = await spot.getArtistById("2YZyLoL8N0Wb9xBt1NhZWg");
    return artist;
  },
});
