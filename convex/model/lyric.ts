import { hashLyrics } from "@/shared/helpers";
import { LyricResponse } from "@/shared/typings";
import { Id } from "../_generated/dataModel";
import { MutationCtx } from "../_generated/server";

export async function upsertLyricVariant(
  ctx: MutationCtx,
  {
    trackId,
    lyric,
    forceOverwrite = false,
  }: {
    trackId: Id<"track">;
    lyric: LyricResponse;
    forceOverwrite?: boolean;
  }
): Promise<Id<"lyric_variant">> {
  // Compute normalized text hash for dedupe/versioning
  const text_hash = await hashLyrics(lyric.lyrics);

  const existing = await ctx.db
    .query("lyric_variant")
    .withIndex("by_track_source", (q) =>
      q.eq("track_id", trackId).eq("source", lyric.source)
    )
    .first();

  const now = Date.now();

  if (existing) {
    if (forceOverwrite) {
      const newVersion =
        (existing.version ?? 1) + (existing.text_hash === text_hash ? 0 : 1);
      await ctx.db.patch(existing._id, {
        last_crawled_at: now,
        url: lyric.url ?? existing.url,
        version: newVersion,
        text_hash: text_hash,
        lyrics: lyric.lyrics,
        processed_status: false,
      });
      return existing._id;
    }

    if (existing.text_hash === text_hash) {
      await ctx.db.patch(existing._id, {
        last_crawled_at: now,
        url: lyric.url ?? existing.url,
      });
      return existing._id;
    }

    const newVersion = (existing.version ?? 1) + 1;
    await ctx.db.patch(existing._id, {
      last_crawled_at: now,
      url: lyric.url ?? existing.url,
      version: newVersion,
      text_hash: text_hash,
      lyrics: lyric.lyrics,
      processed_status: false,
    });
    return existing._id;
  }

  const id = await ctx.db.insert("lyric_variant", {
    track_id: trackId,
    source: lyric.source,
    lyrics: lyric.lyrics,
    url: lyric.url,
    text_hash: text_hash,
    last_crawled_at: now,
    version: 1,
    processed_status: false,
  });
  return id;
}
