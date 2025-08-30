import { Album, Artist, Track, Lyric, LyricSource } from "@/utils/typings";

export type MapperFn<T> = (raw: Record<string, any>) => T | undefined;

export interface MusicProvider {
  searchAlbum: (artist: string, album: string) => Promise<Album | undefined>;
  getTracksByAlbumId: (id: string) => Promise<Track[] | undefined>;
  getAlbumbyId: (id: string) => Promise<Album | undefined>;
  getArtistById: (id: string) => Promise<Artist | undefined>;
  getTrackById: (id: string) => Promise<Track | undefined>;

  mapAlbum: MapperFn<Album>;
  mapTrack: MapperFn<Track>;
  mapArtist: MapperFn<Artist>;
}

export interface LyricProvider {
  getLyricsByTrack: (
    source: LyricSource,
    artist: string,
    title: string
  ) => Promise<Lyric | undefined>;
  getLyricsByAlbum?: (tracks: Track[]) => Promise<string | undefined>;

  mapLyric?: MapperFn<Lyric>;
}

export interface AudioProvider {
  // TODO implement getting audio from a source
}
