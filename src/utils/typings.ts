import { z } from "zod";

export const GenreSchema = z.object({
  id: z.number(),
  name: z.string(),
});

export const Metadata = z.looseObject({
  external_ids: z.object({
    spotify: z.string().optional(),
    apple_music: z.string().optional(),
    youtube_music: z.string().optional(),
  }),
});

export const AlbumSchema = z.object({
  id: z.string(),
  title: z.string(),
  artist_id: z.string(),
  spotify_id: z.string().optional(),
  release_date: z.string().optional(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().min(0).max(100).optional(),
  critical_score: z.number().min(0).max(100).optional(),
  source_urls: z.array(z.url()),
  processed_status: z.boolean(),
  metadata: Metadata.optional(),
  created_at: z.string(),
});

export const SongSchema = z.object({
  id: z.string(),
  title: z.string(),
  album_id: z.string(),
  artist_id: z.string(),
  duration_ms: z.number().positive(),
  explicit_flag: z.boolean(),
  duration: z.number().positive(),
  lyrics: z.string(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().min(0).max(100).optional(),
  audio_urls: z.array(z.url()),
  processed_status: z.boolean(),
  metadata: Metadata.optional(),
  created_at: z.string(),
});

export const ArtistSchema = z.object({
  id: z.string(),
  name: z.string(),
  spotify_id: z.string().optional(),
  genre_tags: z.array(z.string()),
  popularity_score: z.number().min(0).max(100).optional(),
  social_links: z.array(z.url()).optional(),
  metadata: Metadata.optional(),
  created_at: z.string(),
});

export const ProcessedBarSchema = z.object({
  id: z.string(),
  song_id: z.string(),
  lyric_text: z.string(),
  start_time: z.number().min(0),
  end_time: z.number().min(0),
  context_score: z.number().min(0).max(100),
  sentiment_score: z.number().min(0).max(100).optional(),
  complexity_score: z.number().min(0).max(100).optional(),
  audio_url: z.url(),
  created_at: z.string(),
});

export const StreamingLinkSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  platform_name: z.enum(["Spotify", "YouTube", "Apple Music", "SoundCloud"]),
  url: z.url(),
  created_at: z.string(),
});

export const NLPProcessingLogSchema = z.object({
  id: z.string(),
  song_id: z.string(),
  processed_bars_count: z.number().min(0),
  processing_time_ms: z.number().positive(),
  error_logs: z.array(z.string()).optional(),
  created_at: z.string(),
});

export type Album = z.infer<typeof AlbumSchema>;
export type Song = z.infer<typeof SongSchema>;
export type Genre = z.infer<typeof GenreSchema>;
export type Artist = z.infer<typeof ArtistSchema>;
export type Bar = z.infer<typeof ProcessedBarSchema>;
export type Stream = z.infer<typeof StreamingLinkSchema>;
export type NLPLog = z.infer<typeof NLPProcessingLogSchema>;
