import { Metadata } from "../utils/typings";

export function shallowMergeMetadata(
  existing?: Partial<Metadata>,
  incoming?: Partial<Metadata>
): Metadata | undefined {
  if (!existing && !incoming) return undefined;

  if (!existing) {
    return {
      ids: incoming?.ids ?? {},
      source_urls: incoming?.source_urls ?? {},
      audio_urls: incoming?.audio_urls ?? {},
      ...incoming,
    } as Metadata;
  }

  if (!incoming) {
    return {
      ids: existing?.ids ?? {},
      source_urls: existing?.source_urls ?? {},
      audio_urls: existing?.audio_urls ?? {},
      ...existing,
    } as Metadata;
  }

  const merged: Metadata = {
    ids: { ...(existing.ids ?? {}), ...(incoming.ids ?? {}) },
    source_urls: {
      ...(existing.source_urls ?? {}),
      ...(incoming.source_urls ?? {}),
    },
    audio_urls:
      incoming.audio_urls !== undefined
        ? incoming.audio_urls
        : existing.audio_urls,
    ...existing,
    ...incoming,
  };

  merged.ids = { ...(existing.ids ?? {}), ...(incoming.ids ?? {}) };
  merged.source_urls = {
    ...(existing.source_urls ?? {}),
    ...(incoming.source_urls ?? {}),
  };

  return merged;
}
