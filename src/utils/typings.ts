import { z } from "zod";
import type { Id } from "@/../convex/_generated/dataModel";

export const MetadataSchema = z
  .object({
    ids: z.object({
      spotify: z.string().optional(),
      spotify_artist: z.string().optional(),
    }),
    source_urls: z.object({
      spotify: z.url().optional(),
    }),
    audio_urls: z.array(z.url()).optional(),
  })
  .catchall(z.any());

export const AlbumSchema = z.object({
  _id: z.custom<Id<"album">>(),
  artist_id: z.custom<Id<"artist">>(),
  title: z.string(),
  title_normalized: z.string(),
  artist_name: z.string(),
  artist_name_normalized: z.string(),
  release_date: z.string(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().optional(),
  critical_score: z.number().optional(),
  processed_status: z.boolean().default(false),
  metadata: MetadataSchema.optional(),
});

export const TrackSchema = z.object({
  _id: z.custom<Id<"track">>(),
  album_id: z.custom<Id<"album">>(),
  artist_id: z.custom<Id<"artist">>(),
  title: z.string(),
  title_normalized: z.string(),
  album_name: z.string(),
  album_name_normalized: z.string(),
  artist_name: z.string(),
  artist_name_normalized: z.string(),
  release_date: z.string(),
  duration_ms: z.number(),
  explicit_flag: z.boolean(),
  lyrics: z.string().optional(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().optional(),
  processed_status: z.boolean().default(false),
  metadata: MetadataSchema.optional(),
});

export const ArtistSchema = z.object({
  _id: z.custom<Id<"artist">>(),
  name: z.string(),
  name_normalized: z.string(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().optional(),
  social_links: z.array(z.url()).optional(),
  processed_status: z.boolean().default(false),
  metadata: MetadataSchema.optional(),
});

export const LyricSource = z.enum(["genius", "musixmatch"]);

export const LyricResponse = z.object({
  provider: LyricSource,
  title: z.string(),
  artist: z.string(),
  lyrics: z.string().optional(),
  url: z.url().optional(),
});

export type LyricSource = z.infer<typeof LyricSource>;
export type Lyric = z.infer<typeof LyricResponse>;
export type Album = z.infer<typeof AlbumSchema>;
export type Track = z.infer<typeof TrackSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
