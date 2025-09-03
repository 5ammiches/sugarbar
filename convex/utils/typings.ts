import { z } from "zod";
import { LYRIC_SOURCES } from "@/lib/constants";

/**
 * Reusable atoms
 */
export const ProviderIdsSchema = z.object({
  spotify: z.string().optional(),
});

export const SourceUrlsSchema = z.object({
  spotify: z.url().optional(),
  apple: z.url().optional(),
  youtube: z.url().optional(),
});

export const MetadataSchema = z
  .object({
    ids: ProviderIdsSchema,
    source_urls: SourceUrlsSchema,
    audio_urls: z.array(z.url()).optional(),
  })
  .catchall(z.any());

/**
 * Embeddable snapshots (denormalized for convenience)
 * Keep them small and UI-friendly; the normalized docs are still the source of truth
 */
export const EmbeddedArtistSchema = z.object({
  provider_id: z.string().optional(),
  provider: z.string().optional(),
  name: z.string(),
  url: z.url().optional(),
});

export const EmbeddedAlbumSchema = z.object({
  provider_id: z.string().optional(),
  provider: z.string().optional(),
  title: z.string().optional(),
  url: z.url().optional(),
});

export const EmbeddedTrackSchema = z.object({
  provider_id: z.string().optional(),
  provider: z.string().optional(),
  title: z.string(),
  duration_ms: z.number().optional(),
  explicit_flag: z.boolean().optional(),
  url: z.url().optional(),
  primary_artist: EmbeddedArtistSchema.optional(),
  album: EmbeddedAlbumSchema.optional(),
});

/**
 * Normalized domain entities
 */
export const ArtistSchema = z.object({
  name: z.string(),
  genre_tags: z.array(z.string()).default([]),
  metadata: MetadataSchema.optional(),
  // processed_status: z.boolean().default(false),
});

export const TrackSchema = z.object({
  title: z.string(),
  isrc: z.string().optional(),
  release_date: z.string().optional(),
  duration_ms: z.number(),
  explicit_flag: z.boolean(),
  album: EmbeddedAlbumSchema.optional(),
  artists: z.array(EmbeddedArtistSchema).default([]),
  lyrics: z.string().optional(),
  genre_tags: z.array(z.string()).default([]),
  lyrics_fetched_status: z
    .enum(["not_fetched", "fetching", "fetched", "failed"])
    .default("not_fetched"),
  metadata: MetadataSchema.optional(),
  // processed_status: z.boolean().default(false),
});

export const AlbumSchema = z.object({
  total_tracks: z.number().optional(),
  title: z.string(),
  primary_artist: EmbeddedArtistSchema.optional(),
  artists: z.array(EmbeddedArtistSchema).default([]),
  tracks: z.array(EmbeddedTrackSchema).default([]),
  release_date: z.string().optional(),
  genre_tags: z.array(z.string()).default([]),
  metadata: MetadataSchema.optional(),
  // processed_status: z.boolean().default(false),
});

/**
 * Lyrics (provider response)
 */
export const LyricSource = z.enum(LYRIC_SOURCES);

export const LyricResponseSchema = z.object({
  provider: LyricSource,
  title: z.string(),
  artist: z.string(),
  lyrics: z.string().optional(),
  url: z.url().optional(),
});

/**
 * Types
 */
export type Metadata = z.infer<typeof MetadataSchema>;

export type EmbeddedArtist = z.infer<typeof EmbeddedArtistSchema>;
export type EmbeddedAlbum = z.infer<typeof EmbeddedAlbumSchema>;
export type EmbeddedTrack = z.infer<typeof EmbeddedTrackSchema>;

export type Artist = z.infer<typeof ArtistSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Album = z.infer<typeof AlbumSchema>;
export type LyricResponse = z.infer<typeof LyricResponseSchema>;
export type LyricSource = z.infer<typeof LyricSource>;
