import {
  Album,
  Artist,
  Track,
  LyricResponse,
  LyricSource,
} from "@/utils/typings";

export type MapperFn<T> = (raw: Record<string, any>) => T | undefined;

export interface MusicProvider {
  searchAlbum: (album: string, artist: string) => Promise<Album[] | undefined>;
  getAlbumById: (albumId: string) => Promise<Album | undefined>;
  getTracksByAlbumId: (albumId: string) => Promise<Track[] | undefined>;
  getTrackById: (trackId: string) => Promise<Track | undefined>;
  getArtistById: (artistId: string) => Promise<Artist | undefined>;
}

export interface LyricProvider {
  getLyricsByTrack: (
    source: LyricSource,
    artist: string,
    title: string
  ) => Promise<LyricResponse | undefined>;
  getLyricsByAlbum?: (tracks: Track[]) => Promise<string | undefined>;
}

export interface AudioProvider {
  // TODO implement getting audio from a source
}
