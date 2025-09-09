import { z } from "zod";
import { LYRIC_SOURCES } from "@/lib/constants";

/**
 * Reusable atoms
 */
export const ProviderIdsSchema = z.record(z.string(), z.string().min(1));
export const UrlsSchema = z.record(z.string(), z.url());

export const MetadataSchema = z
  .object({
    provider_ids: ProviderIdsSchema.optional(),
    urls: UrlsSchema.optional(),
    audio_urls: z.array(z.url()).optional(),
  })
  .catchall(z.any());

/**
 * Normalized domain entities
 */
// Forward declarations via z.lazy
export const ArtistSchema = z.object({
  name: z.string(),
  genre_tags: z.array(z.string()).default([]),
  metadata: MetadataSchema.optional(),
});

export const AlbumSchema = z.object({
  total_tracks: z.number().optional(),
  title: z.string(),
  primary_artist: ArtistSchema.optional(),
  artists: z.array(ArtistSchema).default([]),
  get tracks() {
    return z.array(TrackSchema).default([]);
  },
  imageUrls: z.array(z.url()).optional(),
  release_date: z.string().optional(),
  genre_tags: z.array(z.string()).default([]),
  metadata: MetadataSchema.optional(),
});

export const EmbeddedAlbumSchema = z.object({
  title: z.string(),
  metadata: MetadataSchema.optional(),
});

export const TrackSchema = z.object({
  title: z.string(),
  isrc: z.string().optional(),
  release_date: z.string().optional(),
  duration_ms: z.number(),
  explicit_flag: z.boolean(),
  album: EmbeddedAlbumSchema.optional(),
  primary_artist: ArtistSchema.optional(),
  artists: z.array(ArtistSchema).default([]),
  lyrics: z.string().optional(),
  genre_tags: z.array(z.string()).default([]),
  lyrics_fetched_status: z
    .enum(["not_fetched", "fetching", "fetched", "failed"])
    .default("not_fetched"),
  metadata: MetadataSchema.optional(),
});

/**
 * Lyrics (provider response)
 */
export const LyricSource = z.enum(LYRIC_SOURCES);

export const LyricResponseSchema = z.object({
  source: LyricSource,
  title: z.string(),
  artist: z.string(),
  lyrics: z.string(),
  url: z.url().optional(),
});

/**
 * Types
 */
export type Metadata = z.infer<typeof MetadataSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Album = z.infer<typeof AlbumSchema>;
export type EmbeddedAlbum = z.infer<typeof EmbeddedAlbumSchema>;
export type LyricResponse = z.infer<typeof LyricResponseSchema>;
export type LyricSource = z.infer<typeof LyricSource>;
