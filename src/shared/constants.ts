export const LYRIC_SOURCES = ["genius", "musixmatch"] as const;
export type LyricsSource = (typeof LYRIC_SOURCES)[number];
