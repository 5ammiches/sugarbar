import { Doc } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import * as Track from "./model/track";
import * as Album from "./model/album";
import * as Artist from "./model/artist";
import * as Lyric from "./model/lyric";
import { v } from "convex/values";
import {
  AlbumSchema,
  ArtistSchema,
  LyricResponseSchema,
  TrackSchema,
} from "./utils/typings";
import { LyricsStatus } from "./schema";

export const upsertAlbum = internalMutation({
  args: {
    album: v.any(),
  },
  handler: async (ctx, { album }) => {
    const al = AlbumSchema.parse(album);
    const id = await Album.upsertAlbum(ctx, { album: al });
    return id;
  },
});

export const getAlbum = internalQuery({
  args: { albumId: v.id("album") },
  handler: async (ctx, { albumId }) => {
    return await ctx.db.get(albumId);
  },
});

export const upsertArtist = internalMutation({
  args: { artist: v.any() },
  handler: async (ctx, { artist }) => {
    const ar = ArtistSchema.parse(artist);
    const id = await Artist.upsertArtist(ctx, { artist: ar });
    return id;
  },
});

export const getArtist = internalQuery({
  args: { artistId: v.id("artist") },
  handler: async (ctx, { artistId }) => {
    return await ctx.db.get(artistId);
  },
});

export const upsertTrack = internalMutation({
  args: {
    track: v.any(),
  },
  handler: async (ctx, { track }) => {
    const tr = TrackSchema.parse(track);
    const id = await Track.upsertTrack(ctx, { track: tr });
    return id;
  },
});

export const getTrack = internalQuery({
  args: { trackId: v.id("track") },
  handler: async (ctx, { trackId }) => {
    return await ctx.db.get(trackId);
  },
});

export const updateTrackLyricStatus = internalMutation({
  args: {
    trackId: v.id("track"),
    status: LyricsStatus,
  },
  handler: async (ctx, { trackId, status }) => {
    return await ctx.db.patch(trackId, { lyrics_fetched_status: status });
  },
});

// TODO maybe add an operation for deleting a lyric variant then updating the track's lyrics_fetched_status
export const upsertLyricVariant = internalMutation({
  args: {
    trackId: v.id("track"),
    lyric: v.any(),
  },
  handler: async (ctx, { trackId, lyric }) => {
    const ly = LyricResponseSchema.parse(lyric);
    const id = await Lyric.upsertLyricVariant(ctx, {
      trackId: trackId,
      lyric: ly,
    });
    return id;
  },
});

export const upsertAlbumTrack = internalMutation({
  args: {
    albumId: v.id("album"),
    trackId: v.id("track"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("album_track")
      .withIndex("by_album_track", (q) =>
        q.eq("album_id", args.albumId).eq("track_id", args.trackId)
      )
      .first();

    if (existing) {
      return existing._id;
    }

    const newId = await ctx.db.insert("album_track", {
      album_id: args.albumId,
      track_id: args.trackId,
    });
    return newId;
  },
});
