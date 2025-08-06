import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
    songs: defineTable({
        title: v.string(),
        artist: v.string(),
        platform: v.string(),
        platformId: v.string(),
        audioUrl: v.optional(v.string()),
        lyrics: v.optional(v.string()),
        genre: v.array(v.string()),
    }),

    bars: defineTable({
        songId: v.id("songs"),
        text: v.string(),
        startTime: v.optional(v.number()),
        endTime: v.optional(v.number()),
        contextScore: v.number(),
        lineCount: v.number(),
    }),
}); 