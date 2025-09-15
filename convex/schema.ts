import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const MetadataField = v.record(v.string(), v.any());

export const LyricsStatus = v.union(
  v.literal("not_fetched"),
  v.literal("fetching"),
  v.literal("fetched"),
  v.literal("failed")
);

export const AlbumFields = {
  title: v.string(),
  title_normalized: v.string(),
  primary_artist_id: v.id("artist"),
  artist_ids: v.array(v.id("artist")),
  release_date: v.string(),
  total_tracks: v.optional(v.number()),
  edition_tag: v.optional(v.string()),
  genre_tags: v.array(v.string()),
  images: v.optional(v.array(v.string())),
  // processed_status: v.boolean(),
  metadata: v.optional(MetadataField),

  approved: v.optional(v.boolean()),
  approved_at: v.optional(v.number()),

  rejected: v.optional(v.boolean()),
  rejected_at: v.optional(v.number()),
  latest_workflow_id: v.optional(v.string()),
  latest_workflow_status: v.optional(
    v.union(
      v.literal("queued"),
      v.literal("in_progress"),
      v.literal("success"),
      v.literal("failed"),
      v.literal("canceled"),
      v.literal("pending_review"),
      v.literal("rejected"),
      v.literal("approved")
    )
  ),
  latest_workflow_updated_at: v.optional(v.number()),
};

export const TrackFields = {
  artist_ids: v.array(v.id("artist")),
  primary_artist_id: v.id("artist"),
  title: v.string(),
  title_normalized: v.string(),
  duration_ms: v.number(),
  explicit_flag: v.boolean(),
  isrc: v.optional(v.string()),
  canonical_key: v.string(), // hash of normalized(title)+primary_artist+duration_bucket
  track_number: v.optional(v.number()),
  disc_number: v.optional(v.number()),
  release_date: v.optional(v.string()),
  edition_tag: v.optional(v.string()), // e.g., "Deluxe", "Live", "Radio Edit"
  lyrics_fetched_status: LyricsStatus,
  genre_tags: v.array(v.string()),
  // processed_status: v.boolean(),
  metadata: v.optional(MetadataField),
};

export const ArtistFields = {
  name: v.string(),
  name_normalized: v.string(),
  aliases: v.array(v.string()),
  genre_tags: v.array(v.string()),
  // processed_status: v.boolean(),
  metadata: v.optional(MetadataField),
};

export const LyricVariantFields = {
  track_id: v.id("track"),
  source: v.string(), // "genius" | "musixmatch" | "other"
  lyrics: v.string(),
  url: v.optional(v.string()),
  text_hash: v.string(), // normalized text hash for dedupe
  last_crawled_at: v.number(), // epoch ms
  version: v.optional(v.number()), // increment if the same source text changes
  confidence: v.optional(v.number()), // keep simple (0-1)
  processed_status: v.boolean(), // NLP/alignment not yet done -> false
};

export const AlbumTrackFields = {
  album_id: v.id("album"),
  track_id: v.id("track"),
};

export const WorkflowJobFields = {
  workflow_id: v.string(),
  workflow_name: v.string(),
  args: v.optional(v.any()),
  status: v.union(
    v.literal("queued"),
    v.literal("in_progress"),
    v.literal("success"),
    v.literal("failed"),
    v.literal("canceled"),
    v.literal("pending_review"),
    v.literal("rejected"),
    v.literal("approved")
  ),
  progress: v.optional(v.number()),
  started_at: v.optional(v.number()),
  updated_at: v.optional(v.number()),
  error: v.optional(v.string()),
  context: v.optional(v.any()),
};

export default defineSchema({
  artist: defineTable(ArtistFields).index("by_name_normalized", [
    "name_normalized",
  ]),

  album: defineTable(AlbumFields)
    .index("by_title_normalized", ["title_normalized"])
    .index("by_title_primary_edition", [
      "title_normalized",
      "primary_artist_id",
      "edition_tag",
    ])
    .index("by_title_artist_ids_edition", [
      "title_normalized",
      "artist_ids",
      "edition_tag",
    ]),

  album_track: defineTable(AlbumTrackFields)
    .index("by_album_id", ["album_id"])
    .index("by_track_id", ["track_id"])
    .index("by_album_track", ["album_id", "track_id"]),

  track: defineTable(TrackFields)
    .index("by_primary_artist", ["primary_artist_id"])
    .index("by_title_normalized", ["title_normalized"])
    .index("by_isrc", ["isrc"])
    .index("by_canonical_key", ["canonical_key"])
    .index("by_lyrics_status", ["lyrics_fetched_status"]),

  lyric_variant: defineTable(LyricVariantFields)
    .index("by_track_id", ["track_id"])
    .index("by_track_source", ["track_id", "source"])
    .index("by_text_hash", ["text_hash"]),

  workflow_job: defineTable(WorkflowJobFields)
    .index("by_workflow_id", ["workflow_id"])
    .index("by_status", ["status"])
    .index("by_workflow_name", ["workflow_name"])
    .index("by_started_at", ["started_at"]),
});
