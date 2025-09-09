import { z } from "zod";

/**
 * Common atoms
 */
export const SpotifyExternalUrlSchema = z.object({
  spotify: z.url().optional(),
});

export const SpotifyExternalIdSchema = z.object({
  isrc: z.string().optional(),
});

export const SpotifyImageSchema = z.object({
  url: z.url().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
});

export const SpotifyPagingSchema = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    href: z.url().optional(),
    limit: z.number().optional(),
    next: z.url().nullable().optional(),
    offset: z.number().optional(),
    previous: z.url().nullable().optional(),
    total: z.number().optional(),
    items: z.array(item),
  });

/**
 * Unified Artist
 * Accepts both full and simplified: genres optional with default []
 */
export const SpotifyArtistUnifiedSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    genres: z.array(z.string()).default([]), // simplified payloads omit this
    external_urls: SpotifyExternalUrlSchema.optional(),
    type: z.string().optional(),
    uri: z.string().optional(),
    href: z.url().optional(),
  })
  .catchall(z.any());

/**
 * Unified Album
 * Accepts both full album and simplified album (from track)
 */
export const SpotifyAlbumUnifiedSchema = z
  .object({
    id: z.string(),
    images: z.array(SpotifyImageSchema).optional(),
    name: z.string(),
    album_type: z.string().optional(),
    release_date: z.string().optional(),
    release_date_precision: z.enum(["year", "month", "day"]).optional(),
    total_tracks: z.number().optional(),
    artists: z.array(SpotifyArtistUnifiedSchema).optional(), // simplified album may not have full artists
    external_urls: SpotifyExternalUrlSchema.optional(),
    genres: z.array(z.string()).default([]),
    label: z.string().optional(),
    type: z.string().optional(),
    uri: z.string().optional(),
    href: z.url().optional(),
    get tracks() {
      return SpotifyPagingSchema(SpotifyTrackUnifiedSchema).optional();
    },
  })
  .catchall(z.any());

/**
 * Unified Track
 * artists are simplified in API, but unified artist handles it
 */
export const SpotifyTrackUnifiedSchema = z
  .object({
    id: z.string(),
    external_ids: SpotifyExternalIdSchema.optional(),
    name: z.string(),
    duration_ms: z.number(),
    release_date: z.string().optional(),
    explicit: z.boolean(),
    external_urls: SpotifyExternalUrlSchema.optional(),
    track_number: z.number().optional(),
    genres: z.array(z.string()).default([]), // many endpoints don’t include track genres
    disc_number: z.number().optional(),
    album: SpotifyAlbumUnifiedSchema.optional(),
    artists: z.array(SpotifyArtistUnifiedSchema).default([]),
    type: z.string().optional(),
    uri: z.string().optional(),
    href: z.url().optional(),
  })
  .catchall(z.any());

/**
 * Search responses (albums, artists, tracks)
 */
export const SpotifyAlbumSearchPageSchema = SpotifyPagingSchema(
  SpotifyAlbumUnifiedSchema
);

export const SpotifyArtistSearchPageSchema = SpotifyPagingSchema(
  SpotifyArtistUnifiedSchema
);

export const SpotifyTrackSearchPageSchema = SpotifyPagingSchema(
  SpotifyTrackUnifiedSchema
);

export const SpotifySearchResponseSchema = z
  .object({
    albums: SpotifyAlbumSearchPageSchema.optional(),
    artists: SpotifyArtistSearchPageSchema.optional(),
    tracks: SpotifyTrackSearchPageSchema.optional(),
  })
  .catchall(z.any());

export type SpotifyArtistUnified = z.infer<typeof SpotifyArtistUnifiedSchema>;
export type SpotifyAlbumUnified = z.infer<typeof SpotifyAlbumUnifiedSchema>;
export type SpotifyTrackUnified = z.infer<typeof SpotifyTrackUnifiedSchema>;
export type SpotifySearchResponse = z.infer<typeof SpotifySearchResponseSchema>;
