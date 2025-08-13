import { SpotifyApi } from "@spotify/web-api-ts-sdk";
import { logger } from "@/lib/utils";
import {
  mapSpotifyAlbum,
  mapSpotifyArtist,
  mapSpotifyTrack,
} from "../mapping/spotifyMap";
import { Album, Track, Artist } from "../typings";
import { MusicProvider } from "./base";
import { MapperFn } from "./base";

// TODO add function for retreiving track by its ID (getTrackById)
export class SpotifyProvider implements MusicProvider {
  private client: SpotifyApi;

  constructor(
    private clientId = process.env.SPOTIFY_CLIENT_ID!,
    private clientSecret = process.env.SPOTIFY_CLIENT_SECRET!
  ) {
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

  mapAlbum: MapperFn<Album> = mapSpotifyAlbum;
  mapTrack: MapperFn<Track> = mapSpotifyTrack;
  mapArtist: MapperFn<Artist> = mapSpotifyArtist;

  async searchAlbum(artist: string, album: string) {
    let searchResults;
    try {
      searchResults = await this.client.search(
        `album:${album} artist:${artist}`,
        ["album"],
        "US",
        5
      );
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Spotify: Error when searching for album", {
          albumName: album,
          artist: artist,
          error: err.message,
        });
        throw new Error(`Spotify: Error searching for album: ${err.message}`);
      }
    }

    if (!searchResults || !searchResults.albums.items.length) {
      logger.error("Spotify: No albums found for search", {
        albumName: album,
        artist: artist,
      });
      throw new Error(
        `Spotify: No albums found for search: ${album} by ${artist}`
      );
    }

    const result = searchResults.albums.items[0];

    const mappedAlbum = this.mapAlbum(result);

    if (!mappedAlbum) {
      logger.error("Spotify: Failed to map album information", {
        albumName: album,
        artist: artist,
      });
      throw new Error("Spotify: Failed to map album information.");
    }

    return mappedAlbum;
  }

  async getAlbumbyId(id: string) {
    let album;
    try {
      album = await this.client.albums.get(id);
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Spotify: Error fetching album from Spotify", {
          albumId: id,
          error: err.message,
        });

        if (
          err.message.includes("404") ||
          err.message.includes("Resource not found")
        ) {
          throw new Error(`Spotify: Album not found for ID: ${id}`);
        }
        throw new Error(`Spotify: Error fetching album: ${err.message}`);
      }

      throw new Error("Spotify: Error fetching album: Unknown error");
    }

    if (!album) {
      logger.error(`Spotify: No album found for ID: ${id}`, {
        albumId: id,
      });
      throw new Error(`Spotify: No album found for ID: ${id}`);
    }

    const mappedAlbum = this.mapAlbum(album);

    if (!mappedAlbum) {
      logger.error("Spotify: Failed to map album information", {
        albumId: id,
      });
      throw new Error("Spotify: Failed to map album information.");
    }

    return mappedAlbum;
  }

  async getTracksByAlbumId(id: string) {
    let album;
    try {
      album = await this.client.albums.get(id);
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Spotify: Error fetching album from Spotify", {
          albumId: id,
          error: err.message,
        });

        if (
          err.message.includes("404") ||
          err.message.includes("Resource not found")
        ) {
          throw new Error(`Spotify: Album not found for ID: ${id}`);
        }
        throw new Error(`Spotify: Error fetching album: ${err.message}`);
      }

      throw new Error("Spotify: Error fetching album: Unknown error");
    }

    if (!album) {
      logger.error(`Spotify: No album found for ID: ${id}`, {
        albumId: id,
      });
      throw new Error(`Spotify: No album found for ID: ${id}`);
    }

    const releaseDate = album.release_date;
    const albumName = album.name;
    const result = album.tracks.items;

    // TODO get lyrics for tracks from notable sources
    const tracks: Track[] = [];

    for (const item of result) {
      const mappedTrack = this.mapTrack({
        ...item,
        release_date: releaseDate,
        album_name: albumName,
      });
      if (mappedTrack) {
        tracks.push(mappedTrack);
      }
    }

    if (!tracks.length) {
      throw new Error(`Spotify: No tracks found for album ID: ${id}`);
    }

    return tracks;
  }

  async getArtistById(id: string) {
    let artist;
    try {
      artist = await this.client.artists.get(id);
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Spotify: Error fetching artist from Spotify", {
          artistId: id,
          error: err.message,
        });
        if (
          err.message.includes("404") ||
          err.message.includes("Resource not found")
        ) {
          throw new Error(`Spotify: Artist not found for ID: ${id}`);
        }
        throw new Error(`Spotify: Error fetching artist: ${err.message}`);
      }

      throw new Error("Spotify: Error fetching artist: Unknown error");
    }

    if (!artist) {
      logger.error(`Spotify: No artist found from Spotify for ID : ${id}`, {
        artistId: id,
      });
      throw new Error(`Spotify: No artist found from Spotify for ID: ${id}`);
    }

    const mappedArtist = this.mapArtist(artist);

    if (!mappedArtist) {
      logger.error("Spotify: Failed to map artist information", {
        artistId: id,
      });
      throw new Error(`spotify: failed to map artist information.`);
    }

    return mappedArtist;
  }
}
