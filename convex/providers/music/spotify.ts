import { logger } from "@/lib/utils";
import { normalizeText, pickUrl, toArray } from "@/shared/helpers";
import { Album, Artist, EmbeddedAlbum, Track } from "@/shared/typings";
import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { z } from "zod";
import { MusicProvider } from "../base";
import {
  SpotifyAlbumUnified,
  SpotifyAlbumUnifiedSchema,
  SpotifyArtistUnified,
  SpotifyArtistUnifiedSchema,
  SpotifySearchResponseSchema,
  SpotifyTrackUnified,
  SpotifyTrackUnifiedSchema,
} from "./spotifySchemas";

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

  private mapTrack = (t: SpotifyTrackUnified): Track => {
    const artists = toArray(t.artists).map(this.mapArtist);
    const url = pickUrl(t);
    const urls = url ? { spotify: url } : undefined;
    const album = t.album ? this.mapEmbeddedAlbum(t.album) : undefined;

    return {
      title: t.name,
      primary_artist: artists[0],
      release_date: t.release_date,
      isrc: t.external_ids?.isrc,
      duration_ms: t.duration_ms,
      explicit_flag: t.explicit,
      metadata: {
        provider_ids: { spotify: t.id },
        urls,
      },
      genre_tags: t.genres,
      lyrics_fetched_status: "not_fetched",

      album,
      artists,
    };
  };

  private mapEmbeddedAlbum = (
    al: SpotifyAlbumUnified
  ): EmbeddedAlbum | undefined => {
    if (!al) return undefined;

    const url = pickUrl(al);
    const urls = url ? { spotify: url } : undefined;

    return {
      title: al.name,
      metadata: {
        provider_ids: { spotify: al.id },
        urls,
      },
    };
  };

  private mapArtist = (ar: SpotifyArtistUnified): Artist => {
    const url = pickUrl(ar);
    const urls = url ? { spotify: url } : undefined;

    return {
      name: ar.name,
      genre_tags: ar.genres,
      metadata: {
        provider_ids: { spotify: ar.id },
        urls,
      },
    };
  };

  private mapAlbum = (a: SpotifyAlbumUnified): Album => {
    const images: string[] = (a.images ?? [])
      .map((img) => img.url)
      .filter((u): u is string => typeof u === "string" && u.length > 0);

    const artists = toArray(a.artists).map(this.mapArtist);
    const url = pickUrl(a);
    const urls = url ? { spotify: url } : undefined;
    const items = (a.tracks?.items ?? []) as SpotifyTrackUnified[];
    const tracks = items.map(this.mapTrack);

    return {
      title: a.name,
      primary_artist: artists[0],
      total_tracks: a.total_tracks,
      release_date: a.release_date,
      genre_tags: a.genres,
      metadata: {
        provider_ids: { spotify: a.id },
        urls,
      },
      imageUrls: images,
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
    items: SpotifyAlbumUnified[],
    wantedTitle: string
  ): SpotifyAlbumUnified[] {
    const nTitle = this.normalize(wantedTitle);
    const dateToMs = (d?: string) => (d ? new Date(d).getTime() || 0 : 0);

    return items.slice().sort((a, b) => {
      const an = this.normalize(a.name);
      const bn = this.normalize(b.name);

      // 1) exact title
      const aExact = an === nTitle ? 1 : 0;
      const bExact = bn === nTitle ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      // 2) startsWith
      const aStarts = an.startsWith(nTitle) ? 1 : 0;
      const bStarts = bn.startsWith(nTitle) ? 1 : 0;
      if (aStarts !== bStarts) return bStarts - aStarts;

      // 3) includes
      const aIncl = an.includes(nTitle) ? 1 : 0;
      const bIncl = bn.includes(nTitle) ? 1 : 0;
      if (aIncl !== bIncl) return bIncl - aIncl;

      // 4) prefer real albums over singles/compilations (tiny nudge)
      const aType = (a.album_type || "").toLowerCase() === "album" ? 1 : 0;
      const bType = (b.album_type || "").toLowerCase() === "album" ? 1 : 0;
      if (aType !== bType) return bType - aType;

      // 5) newest first
      return dateToMs(b.release_date) - dateToMs(a.release_date);
    });
  }

  async searchAlbum(query: string): Promise<Album[] | undefined> {
    const client = this.getSpotifyClient();
    if (!query) {
      logger.error("Spotify: No query provided for search", {
        query: query,
      });
      throw new Error("No query provided for search");
    }

    const normalizedQuery = normalizeText(query);

    let rawSearch;
    try {
      rawSearch = await client.search(normalizedQuery, ["album"], "US", 10);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error("Spotify: Error when searching for album", {
        query: query,
        error: msg,
      });
      throw new Error(`Spotify: Error searching for album: ${msg}`);
    }

    const result = SpotifySearchResponseSchema.safeParse(rawSearch);
    if (!result.success) {
      logger.error("Spotify: search payload parse failed", {
        query,
        issues: result.error?.issues,
      });
      throw new Error("Spotify: Unexpected search response shape");
    }

    const albumsPage = result.data.albums;
    if (!albumsPage || albumsPage.items.length === 0) {
      logger.warn("Spotify: No albums found for search", { query });
      return [];
    }

    const ranked = this.sortAlbumsForQuery(albumsPage.items, query);

    // Fetch full album details to include tracks (needed for explicit flag)
    const fullAlbums = await Promise.all(
      ranked.map(async (a) => {
        try {
          return await this.getAlbumById(a.id);
        } catch {
          return undefined;
        }
      })
    );

    return fullAlbums.filter((al): al is Album => !!al);
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

    const fullAlbum = SpotifyAlbumUnifiedSchema.safeParse(raw);
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

    const TrackArraySchema = z.array(SpotifyTrackUnifiedSchema);
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

    const fullTrack = SpotifyTrackUnifiedSchema.safeParse(raw);
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

    const fullArtist = SpotifyArtistUnifiedSchema.safeParse(raw);
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
