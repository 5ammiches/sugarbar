import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  album: defineTable({
    title: v.string(),
    artist_id: v.id("artist"),
    spotify_id: v.string().optional(),
    release_date: v.string(),
    genre_tags: v.array(v.string()),
    popularity_score: v.number(),
    critical_score: v.number(),
    source_urls: v.array(v.string()),
    processed_status: v.boolean(),
    metadata: v.any(),
  }),

  song: defineTable({
    title: v.string(),
    album_id: v.id("album"),
    artist_id: v.id("artist"),
    duration_ms: v.number(),
    explicit_flag: v.boolean(),
    duration: v.number(),
    lyrics: v.string(),
    genre_tags: v.array(v.string()),
    popularity_score: v.number(),
    audio_urls: v.array(v.string()),
    processed_status: v.boolean(),
    metadata: v.any(),
    created_at: v.string(),
  }),

  artist: defineTable({
    name: v.string(),
    spotify_id: v.string().optional(),
    genre_tags: v.array(v.string()),
    popularity_score: v.number(),
    social_links: v.array(v.string()),
    metadata: v.any(),
    created_at: v.string(),
  }),
});
