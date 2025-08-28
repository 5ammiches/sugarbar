import { createMapper, normalizeName } from "@/utils/mapping/createMapper";
import {
  AlbumSchema,
  Album,
  Track,
  TrackSchema,
  Artist,
  ArtistSchema,
} from "@/utils/typings";

// TODO: Spotify does not provide genre tags
export const mapSpotifyAlbum = createMapper<Album>(
  AlbumSchema,
  {
    name: "title",
    "artists.0.name": "artist_name",
    "artists.0.id": "metadata.ids.spotify_artist",
    id: "metadata.ids.spotify",
    release_date: "release_date",
    genres: "genre_tags",
    "external_urls.spotify": "metadata.source_urls.spotify",
  },
  {
    genre_tags: (genres) => genres ?? [],
    title_normalized: (_, __, mapped) => normalizeName(mapped.title ?? ""),
    artist_name_normalized: (_, __, mapped) =>
      normalizeName(mapped.artist_name ?? ""),
    metadata: (_, raw, mapped) => ({
      ...mapped.metadata,
      total_tracks: raw.total_tracks,
    }),
  }
);

export const mapSpotifyTrack = createMapper<Track>(
  TrackSchema,
  {
    name: "title",
    album_name: "album_name",
    "artists.0.name": "artist_name",
    "artists.0.id": "metadata.ids.spotify_artist",
    id: "metadata.ids.spotify",
    release_date: "release_date",
    duration_ms: "duration_ms",
    explicit: "explicit_flag",
    "external_urls.spotify": "metadata.source_urls.spotify",
  },
  {
    title_normalized: (_, __, mapped) => normalizeName(mapped.title ?? ""),
    album_name_normalized: (_, __, mapped) =>
      normalizeName(mapped.album_name ?? ""),
    artist_name_normalized: (_, __, mapped) =>
      normalizeName(mapped.artist_name ?? ""),
    genre_tags: (genres) => genres ?? [],
  }
);

export const mapSpotifyArtist = createMapper<Artist>(
  ArtistSchema,
  {
    name: "name",
    genres: "genre_tags",
    "external_urls.spotify": "metadata.source_urls.spotify",
    id: "metadata.ids.spotify_artist",
  },
  {
    name_normalized: (_, __, mapped) => normalizeName(mapped.name ?? ""),
    genre_tags: (genres) => genres ?? [],
  }
);
