import { z } from "zod";
import type { Id } from "@/../convex/_generated/dataModel";

export const MetadataSchema = z
  .object({
    external_ids: z.object({
      spotify: z.string().optional(),
      apple_music: z.string().optional(),
      youtube_music: z.string().optional(),
    }),
    source_urls: z.object({
      spotify: z.string().optional(),
    }),
    audio_urls: z.array(z.string()).optional(),
  })
  .catchall(z.any());

export const AlbumSchema = z.object({
  _id: z.custom<Id<"album">>(),
  title: z.string(),
  artist_id: z.custom<Id<"artist">>(),
  artist_name: z.string(),
  release_date: z.string(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().optional(),
  critical_score: z.number().optional(),
  processed_status: z.boolean().default(false),
  metadata: MetadataSchema.optional(),
});

export const SongSchema = z.object({
  _id: z.custom<Id<"song">>(),
  album_id: z.custom<Id<"album">>(),
  artist_id: z.custom<Id<"artist">>(),
  album_name: z.string(),
  artist_name: z.string(),
  release_date: z.string(),
  duration_ms: z.number(),
  explicit_flag: z.boolean(),
  duration: z.number(),
  lyrics: z.string(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().optional(),
  processed_status: z.boolean().default(false),
  metadata: MetadataSchema.optional(),
});

export const ArtistSchema = z.object({
  _id: z.custom<Id<"artist">>(),
  name: z.string(),
  spotify_id: z.string().optional(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().optional(),
  social_links: z.array(z.string()).optional(),
  processed_status: z.boolean().default(false),
  metadata: MetadataSchema.optional(),
});

export type Album = z.infer<typeof AlbumSchema>;
export type Song = z.infer<typeof SongSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
