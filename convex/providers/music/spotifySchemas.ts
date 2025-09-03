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
 * Artist response
 */
export const SpotifyArtistSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    genres: z.array(z.string()).default([]),
    external_urls: SpotifyExternalUrlSchema.optional(),
    type: z.string().optional(),
    uri: z.string().optional(),
    href: z.url().optional(),
  })
  .catchall(z.any());

/**
 * Album response (full album as returned by albums.get or in search results)
 * Note: Spotify often omits genres on album objects; keep optional.
 */
export const SpotifySimplifiedArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  external_urls: SpotifyExternalUrlSchema.optional(),
  href: z.url().optional(),
  type: z.string().optional(),
  uri: z.string().optional(),
});

export const SpotifyAlbumSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    album_type: z.string().optional(),
    release_date: z.string().optional(),
    release_date_precision: z.enum(["year", "month", "day"]).optional(),
    total_tracks: z.number().optional(),
    artists: z.array(SpotifySimplifiedArtistSchema),
    external_urls: SpotifyExternalUrlSchema.optional(),
    genres: z.array(z.string()).default([]),
    label: z.string().optional(),
    type: z.string().optional(),
    uri: z.string().optional(),
    href: z.url().optional(),
    // When fetched via albums.get, a nested tracks paging object is present
    tracks: SpotifyPagingSchema(
      z.object({
        id: z.string(),
        name: z.string(),
        duration_ms: z.number(),
        explicit: z.boolean(),
        track_number: z.number().optional(),
        disc_number: z.number().optional(),
        external_urls: SpotifyExternalUrlSchema.optional(),
        artists: z.array(SpotifySimplifiedArtistSchema).optional(),
        href: z.url().optional(),
        uri: z.string().optional(),
      })
    ).optional(),
  })
  .catchall(z.any());

/**
 * Track response (full track as returned by tracks.get)
 */
export const SpotifySimplifiedAlbumSchema = z.object({
  id: z.string().optional(),
  name: z.string(),
  release_date: z.string().optional(),
  external_urls: SpotifyExternalUrlSchema.optional(),
});

export const SpotifyTrackSchema = z
  .object({
    id: z.string(),
    external_ids: SpotifyExternalIdSchema.optional(),
    name: z.string(),
    duration_ms: z.number(),
    release_date: z.string().optional(),
    explicit: z.boolean(),
    external_urls: SpotifyExternalUrlSchema.optional(),
    track_number: z.number().optional(),
    genres: z.array(z.string()).default([]),
    disc_number: z.number().optional(),
    album: SpotifySimplifiedAlbumSchema.optional(),
    artists: z.array(SpotifySimplifiedArtistSchema).default([]),
    type: z.string().optional(),
    uri: z.string().optional(),
    href: z.url().optional(),
  })
  .catchall(z.any());

/**
 * Search responses (albums, artists, tracks)
 */
export const SpotifyAlbumSearchPageSchema =
  SpotifyPagingSchema(SpotifyAlbumSchema);

export const SpotifyArtistSearchPageSchema =
  SpotifyPagingSchema(SpotifyArtistSchema);

export const SpotifyTrackSearchPageSchema =
  SpotifyPagingSchema(SpotifyTrackSchema);

export const SpotifySearchResponseSchema = z
  .object({
    albums: SpotifyAlbumSearchPageSchema.optional(),
    artists: SpotifyArtistSearchPageSchema.optional(),
    tracks: SpotifyTrackSearchPageSchema.optional(),
  })
  .catchall(z.any());

export type SpotifySearchResponse = z.infer<typeof SpotifySearchResponseSchema>;

export type SpotifyArtist = z.infer<typeof SpotifyArtistSchema>;
export type SpotifySimplifiedArtist = z.infer<
  typeof SpotifySimplifiedArtistSchema
>;

export type SpotifyAlbum = z.infer<typeof SpotifyAlbumSchema>;
export type SpotifySimplifiedAlbum = z.infer<
  typeof SpotifySimplifiedAlbumSchema
>;

export type SpotifyTrack = z.infer<typeof SpotifyTrackSchema>;
