import { Album, Artist, Track } from "@/utils/typings";

export type MapperFn<T> = (raw: Record<string, any>) => T | undefined;

export interface MusicProvider {
  searchAlbum: (artist: string, album: string) => Promise<Album> | undefined;
  getAlbumbyId: (id: string) => Promise<Album> | undefined;
  getTracksByAlbumId: (id: string) => Promise<Track[]> | undefined;
  getArtistById: (id: string) => Promise<Artist> | undefined;

  mapAlbum: MapperFn<Album>;
  mapTrack: MapperFn<Track>;
  mapArtist: MapperFn<Artist>;
}
