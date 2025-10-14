import { Metadata } from "@/shared/typings";

export function mergeStringMap(
  a?: Record<string, string>,
  b?: Record<string, string>
) {
  const merged = { ...(a ?? {}), ...(b ?? {}) };

  const cleaned = Object.fromEntries(
    Object.entries(merged).filter(
      ([, v]) => typeof v === "string" && v.trim().length > 0
    )
  ) as Record<string, string>;

  return Object.keys(cleaned).length ? cleaned : undefined;
}

export function mergeMetadata(
  existing?: Partial<Metadata>,
  incoming?: Partial<Metadata>
): Metadata | undefined {
  if (!existing && !incoming) return undefined;

  const providerIds = mergeStringMap(
    existing?.provider_ids,
    incoming?.provider_ids
  );

  const urls = mergeStringMap(existing?.urls, incoming?.urls);

  const audioUrlsArr = Array.from(
    new Set([...(existing?.audio_urls ?? []), ...(incoming?.audio_urls ?? [])])
  );

  const audioUrls = audioUrlsArr.length ? audioUrlsArr : undefined;

  return {
    ...(existing ?? {}),
    ...(incoming ?? {}),
    provider_ids: providerIds,
    urls: urls,
    audio_urls: audioUrls,
  };
}
