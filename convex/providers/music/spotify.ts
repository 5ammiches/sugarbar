import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { z } from "zod";
import { logger } from "@/lib/utils";
import {
  SpotifySearchResponse,
  SpotifySearchResponseSchema,
  SpotifyAlbumSchema,
  SpotifyAlbum,
  SpotifyArtist,
  SpotifyTrack,
  SpotifyTrackSchema,
  SpotifyArtistSchema,
} from "./spotifySchemas";
import { Album, Track, Artist } from "@/utils/typings";
import { MusicProvider } from "../base";
import { MapperFn } from "../base";
import {
  mapEmbeddedAlbum,
  mapEmbeddedArtist,
  mapEmbeddedTrack,
  pickUrl,
  toArray,
} from "../helpers";

export class SpotifyProvider implements MusicProvider {
  private client: SpotifyApi;

  constructor(private clientId?: string, private clientSecret?: string) {
    if (!this.clientId || !this.clientSecret) {
      throw new Error("Spotify credentials are missing");
    }

    this.client = SpotifyApi.withClientCredentials(
      this.clientId,
      this.clientSecret
    );
  }

  private getSpotifyClient(): SpotifyApi {
    return this.client;
  }

  private mapTrack = (t: SpotifyTrack): Track => {
    const artists = toArray(t.artists).map(mapEmbeddedArtist);
    const album = mapEmbeddedAlbum(t.album);

    return {
      title: t.name,
      release_date: t.release_date,
      isrc: t.external_ids?.isrc,
      duration_ms: t.duration_ms,
      explicit_flag: t.explicit,
      metadata: {
        ids: { spotify: t.id },
        source_urls: { spotify: pickUrl(t) },
      },
      genre_tags: t.genres,
      lyrics_fetched_status: "not_fetched",
      // processed_status: false,

      album,
      artists,
    };
  };

  private mapArtist = (ar: SpotifyArtist): Artist => ({
    name: ar.name,
    genre_tags: ar.genres,
    metadata: {
      ids: { spotify: ar.id },
      source_urls: { spotify: pickUrl(ar) },
    },
    // processed_status: false,
  });

  private mapAlbum = (a: SpotifyAlbum): Album => {
    const artists = toArray(a.artists).map(mapEmbeddedArtist);
    const items = (a.tracks?.items ?? []) as SpotifyTrack[];
    const tracks = items.map(mapEmbeddedTrack);

    return {
      title: a.name,
      primary_artist: artists[0],
      total_tracks: a.total_tracks,
      release_date: a.release_date,
      genre_tags: a.genres,
      metadata: {
        ids: { spotify: a.id },
        source_urls: { spotify: pickUrl(a) },
      },
      // processed_status: false,

      artists,
      tracks,
    };
  };

  private normalize(s: string) {
    return s
      .toLowerCase()
      .replace(/['’"“”`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  private sortAlbumsForQuery(
    items: SpotifyAlbum[],
    wantedTitle: string,
    wantedArtist: string
  ): SpotifyAlbum[] {
    const nTitle = this.normalize(wantedTitle);
    const nArtist = this.normalize(wantedArtist);

    const dateToMs = (d?: string) => (d ? new Date(d).getTime() || 0 : 0);

    return items.slice().sort((a, b) => {
      const an = this.normalize(a.name);
      const bn = this.normalize(b.name);

      const aExactTitle = an === nTitle ? 1 : 0;
      const bExactTitle = bn === nTitle ? 1 : 0;
      if (aExactTitle !== bExactTitle) return bExactTitle - aExactTitle;

      const aArtistMatch = a.artists.some(
        (ar) => this.normalize(ar.name) === nArtist
      )
        ? 1
        : 0;
      const bArtistMatch = b.artists.some(
        (ar) => this.normalize(ar.name) === nArtist
      )
        ? 1
        : 0;
      if (aArtistMatch !== bArtistMatch) return bArtistMatch - aArtistMatch;

      const aStarts = an.startsWith(nTitle) ? 1 : 0;
      const bStarts = bn.startsWith(nTitle) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      return dateToMs(b.release_date) - dateToMs(a.release_date);
    });
  }

  async searchAlbum(
    album: string,
    artist: string
  ): Promise<Album[] | undefined> {
    const client = this.getSpotifyClient();
    let rawSearch;
    try {
      rawSearch = await client.search(
        `album:${album} artist:${artist}`,
        ["album"],
        "US",
        5
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Spotify: Error when searching for album", {
        albumName: album,
        artist,
        error: msg,
      });
      throw new Error(`Spotify: Error searching for album: ${msg}`);
    }

    const result = SpotifySearchResponseSchema.safeParse(rawSearch);
    if (!result.success) {
      logger.error("Spotify: search payload parse failed", {
        album,
        artist,
        issues: result.error?.issues,
      });
      throw new Error("Spotify: Unexpected search response shape");
    }

    const albumsPage = result.data.albums;
    if (!albumsPage || albumsPage.items.length === 0) {
      logger.warn("Spotify: No albums found for search", { album, artist });
      return [];
    }

    const ranked = this.sortAlbumsForQuery(albumsPage.items, album, artist);

    return ranked.map((a) => this.mapAlbum(a));
  }

  async getAlbumById(albumId: string): Promise<Album | undefined> {
    const client = this.getSpotifyClient();
    let raw;
    try {
      raw = await client.albums.get(albumId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Spotify: Error fetching full album after search", {
        albumId: albumId,
        error: msg,
      });
      throw new Error(`Spotify: Error fetching album ${albumId}: ${msg}`);
    }

    const fullAlbum = SpotifyAlbumSchema.safeParse(raw);
    if (!fullAlbum.success) {
      logger.error("Spotify: full album payload parse failed", {
        albumId: albumId,
        issues: fullAlbum.error.issues,
      });

      return undefined;
    }

    return this.mapAlbum(fullAlbum.data);
  }

  async getTracksByAlbumId(albumId: string): Promise<Track[] | undefined> {
    const client = this.getSpotifyClient();
    let raw;
    try {
      raw = await client.albums.tracks(albumId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Spotify: Error fetching album tracks after search", {
        albumId: albumId,
        error: msg,
      });
      throw new Error(
        `Spotify: Error fetching tracks for album ${albumId}: ${msg}`
      );
    }

    const TrackArraySchema = z.array(SpotifyTrackSchema);
    const parsed = TrackArraySchema.safeParse(raw.items);
    if (!parsed.success) {
      logger.error("Spotify: full album payload parse failed", {
        albumId: albumId,
        issues: parsed.error.issues,
      });

      return undefined;
    }

    const fullTracks = parsed.data;

    return fullTracks.map((t) => this.mapTrack(t));
  }

  async getTrackById(trackId: string): Promise<Track | undefined> {
    const client = this.getSpotifyClient();
    let raw;
    try {
      raw = await client.tracks.get(trackId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Spotify: Error fetching track after search", {
        trackId: trackId,
        error: msg,
      });
      throw new Error(`Spotify: Error fetching track ${trackId}: ${msg}`);
    }

    const fullTrack = SpotifyTrackSchema.safeParse(raw);
    if (!fullTrack.success) {
      logger.error("Spotify: full tracks payload parse failed", {
        trackId: trackId,
        issues: fullTrack.error.issues,
      });

      return undefined;
    }

    return this.mapTrack(fullTrack.data);
  }

  async getArtistById(artistId: string): Promise<Artist | undefined> {
    const client = this.getSpotifyClient();
    let raw;
    try {
      raw = await client.artists.get(artistId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Spotify: Error fetching artist after search", {
        artistId: artistId,
        error: msg,
      });
      throw new Error(`Spotify: Error fetching artist ${artistId}: ${msg}`);
    }

    const fullArtist = SpotifyArtistSchema.safeParse(raw);
    if (!fullArtist.success) {
      logger.error("Spotify: full artist payload parse failed", {
        artistId: artistId,
        issues: fullArtist.error.issues,
      });

      return undefined;
    }

    return this.mapArtist(fullArtist.data);
  }
}
