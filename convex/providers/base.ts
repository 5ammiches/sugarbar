import {
  PreviewDownload,
  YTSearchResponse,
  YTSearchResultItem,
} from "@/lib/typings";
import {
  Album,
  Artist,
  LyricResponse,
  LyricSource,
  Track,
} from "../utils/typings";

export type MapperFn<T> = (raw: Record<string, any>) => T | undefined;

export interface MusicProvider {
  searchAlbum: (album: string, artist: string) => Promise<Album[] | undefined>;
  getAlbumById: (albumId: string) => Promise<Album | undefined>;
  getTracksByAlbumId: (albumId: string) => Promise<Track[] | undefined>;
  getTrackById: (trackId: string) => Promise<Track | undefined>;
  getArtistById: (artistId: string) => Promise<Artist | undefined>;
}

export interface AudioLyricProvider {
  getLyricsByTrack: (
    source: LyricSource,
    artist: string,
    title: string
  ) => Promise<LyricResponse | undefined>;
  getLyricsByAlbum?: (tracks: Track[]) => Promise<string | undefined>;
  searchYT: (
    title: string,
    artist: string,
    durationSec: number
  ) => Promise<YTSearchResponse | undefined>;
  downloadYTAudioPreview: (
    trackId: string,
    candidates: YTSearchResultItem[],
    bitrateKbps?: number,
    previewStartSec?: number,
    previewLenSec?: number
  ) => Promise<PreviewDownload | undefined>;
}
