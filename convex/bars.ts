import { query, mutation, action } from "./_generated/server";
import { v } from "convex/values";
import { SAMPLE_BARS } from "../src/sample-data";

export const generateRandomBar = action({
    args: {},
    returns: v.object({
        id: v.string(),
        text: v.string(),
        artist: v.string(),
        title: v.string(),
        album: v.optional(v.string()),
        year: v.optional(v.number()),
        platform: v.string(),
        contextScore: v.number(),
        lineCount: v.number(),
        generatedAt: v.number()
    }),
    handler: async (ctx) => {
        const timestamp = Date.now();
        const randomSeed = Math.floor(Math.random() * 1000000);
        const randomIndex = Math.floor((Math.random() + randomSeed) * SAMPLE_BARS.length) % SAMPLE_BARS.length;
        const selectedBar = SAMPLE_BARS[randomIndex];

        return {
            id: `bar_${timestamp}_${randomIndex}_${randomSeed}`,
            ...selectedBar,
            generatedAt: timestamp
        };
    },
});

export const getAllBars = query({
    args: {},
    handler: async (ctx) => {
        return SAMPLE_BARS.map((bar, index) => ({
            id: `bar_${index}`,
            ...bar,
            generatedAt: Date.now()
        }));
    },
}); 