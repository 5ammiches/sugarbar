import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const MetadataField = v.record(v.string(), v.any());

export const AlbumFields = {
  title: v.string(),
  artist_id: v.id("artist"),
  artist_name: v.string(),
  spotify_id: v.optional(v.string()),
  release_date: v.string(),
  genre_tags: v.array(v.string()),
  popularity_score: v.optional(v.number()),
  critical_score: v.optional(v.number()),
  processed_status: v.boolean(),
  metadata: v.optional(MetadataField),
};

export const SongFields = {
  title: v.string(),
  album_id: v.id("album"),
  artist_id: v.id("artist"),
  album_name: v.string(),
  artist_name: v.string(),
  release_date: v.string(),
  duration_ms: v.number(),
  explicit_flag: v.boolean(),
  duration: v.number(),
  lyrics: v.string(),
  genre_tags: v.array(v.string()),
  popularity_score: v.optional(v.number()),
  processed_status: v.boolean(),
  metadata: v.optional(MetadataField),
};

export const ArtistFields = {
  name: v.string(),
  spotify_id: v.optional(v.string()),
  genre_tags: v.array(v.string()),
  popularity_score: v.optional(v.number()),
  social_links: v.optional(v.array(v.string())),
  processed_status: v.boolean(),
  metadata: v.optional(MetadataField),
};

export default defineSchema({
  album: defineTable(AlbumFields),
  song: defineTable(SongFields),
  artist: defineTable(ArtistFields),
});
