import { Album, Artist, Track } from "@/utils/typings";

export type MapperFn<T> = (raw: Record<string, any>) => T | undefined;

export interface MusicProvider {
  searchAlbum: (artist: string, album: string) => Promise<Album> | undefined;
  getAlbumbyId: (id: string) => Promise<Album> | undefined;
  getTracksByAlbumId: (id: string) => Promise<Track[]> | undefined;
  getArtistById: (id: string) => Promise<Artist> | undefined;
  getTrackById: (id: string) => Promise<Track> | undefined;

  mapAlbum: MapperFn<Album>;
  mapTrack: MapperFn<Track>;
  mapArtist: MapperFn<Artist>;
}

export interface LyricsProvider {
  getLyricsByTrack: (
    artist: string,
    track: string
  ) => Promise<string> | undefined;
  getLyricsByAlbum: (tracks: Track[]) => Promise<string> | undefined;
  getLyricsByTrackId: (id: string) => Promise<string> | undefined;
}
