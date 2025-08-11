import { Album, Artist, Track } from "@/utils/typings";

export interface MusicSourceAdapter {
  searchAlbum(artist: string, album: string): Promise<any>;
  getAlbumbyId(id: string): Promise<any>;
  getTracksByAlbumId(id: string): Promise<any[]>;
  getArtistById(id: string): Promise<any>;
  mapAlbum(raw: any): Album;
  mapTrack(raw: any): Track;
  mapArtist(raw: any): Artist;
}
