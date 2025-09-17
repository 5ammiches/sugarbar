type Maybe<T> = T | null | undefined;

export const toArray = <T>(v: Maybe<T[]>) => (Array.isArray(v) ? v : []);
export const safeStr = (v: Maybe<string>) => (typeof v === "string" ? v : "");
export const safeDate = (v: Maybe<string>) => safeStr(v) || undefined;

export function arraysEqualUnordered(a?: string[], b?: string[]) {
  const as = new Set(a ?? []);
  const bs = new Set(b ?? []);
  if (as.size !== bs.size) return false;
  for (const v of as) if (!bs.has(v)) return false;
  return true;
}

/**
 * Spotify external url helper
 */
export const pickUrl = (obj: Maybe<{ external_urls?: { spotify?: string } }>) =>
  obj?.external_urls?.spotify;

/**
 * Normalize text functions - album titles, track title, artist names
 */
export type NormalizedAlbum = {
  base_title: string;
  edition_tag?: string;
};

const SPACE_RE = /\s+/g;
const BRACKET_NOISE_RE = /\s*[\[\(]\s*(explicit|clean|edited)\s*[\]\)]\s*$/i;

const EDITION_PARENS_RE =
  /\s*\((deluxe(?: edition)?|expanded(?: edition)?|remaster(?:ed)?(?:\s*\d{2,4})?|bonus track(?:s)?(?: version)?|super deluxe|collector'?s edition|anniversary edition|20(?:th)? anniversary edition)\)\s*$/i;

// Matches common edition suffixes that are prefixed with a hyphen or colon, e.g.
// "Song Title - Deluxe Edition" or "Song Title: Remastered 2020"
const EDITION_SUFFIX_RE =
  /\s*(?:-|:)\s*(deluxe(?: edition)?|expanded(?: edition)?|remaster(?:ed)?(?:\s*\d{2,4})?|bonus track(?:s)?(?: version)?|super deluxe|collector'?s edition|anniversary edition|20(?:th)? anniversary edition)\s*$/i;

// Matches plain trailing edition words without punctuation, e.g. "the recipe bonus track"
const EDITION_PLAIN_SUFFIX_RE =
  /\s*(deluxe(?: edition)?|expanded(?: edition)?|remaster(?:ed)?(?:\s*\d{2,4})?|bonus track(?:s)?(?: version)?|super deluxe|collector'?s edition|anniversary edition|20(?:th)? anniversary edition)\s*$/i;

const EDITION_BRACKETS_RE =
  /\s*\[(deluxe|expanded|remaster(?:ed)?(?:\s*\d{2,4})?|bonus tracks?|anniversary edition)\]\s*$/i;

function stripDiacritics(input: string): string {
  return input.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeAlbumTitle(raw: string): NormalizedAlbum {
  if (!raw) return { base_title: "" };

  // Trim and collapse
  let title = raw.trim().replace(SPACE_RE, " ");

  // Remove non-semantic noise like [Explicit] or (Clean) at the very end
  title = title.replace(BRACKET_NOISE_RE, "");

  // Extract edition tags iteratively (some titles have multiple)
  const editions: string[] = [];
  let changed = true;
  while (changed) {
    changed = false;

    const par = title.match(EDITION_PARENS_RE);
    if (par) {
      editions.push(par[1].toLowerCase());
      title = title.slice(0, par.index).trim();
      changed = true;
      continue;
    }

    const suf = title.match(EDITION_SUFFIX_RE);
    if (suf) {
      editions.push(suf[1].toLowerCase());
      title = title.slice(0, suf.index).trim();
      changed = true;
      continue;
    }

    const br = title.match(EDITION_BRACKETS_RE);
    if (br) {
      editions.push(br[1].toLowerCase());
      title = title.slice(0, br.index).trim();
      changed = true;
      continue;
    }
  }

  // Normalize for matching
  let base = stripDiacritics(title).toLowerCase();

  // Strip punctuation except spaces and alphanumerics
  base = base.replace(/[^a-z0-9 ]+/g, "");
  base = base.replace(SPACE_RE, " ").trim();

  const edition_tag =
    editions.length > 0 ? Array.from(new Set(editions)).join("; ") : undefined;

  return { base_title: base, edition_tag };
}

/**
 * normalizeText now accepts an optional keepQuotes flag.
 * Default behaviour (keepQuotes=false) preserves existing behaviour and strips quotes.
 */
export function normalizeText(s: string, keepQuotes: boolean = false) {
  if (!s) return "";

  // Start by trimming + collapsing whitespace
  let title = s.trim().replace(SPACE_RE, " ");

  // Remove non-semantic noise like [Explicit] or (Clean) at the very end
  title = title.replace(BRACKET_NOISE_RE, "");

  // Remove common edition/variant suffixes (e.g. "(Deluxe)", "- Bonus Track", "[Remaster]" etc.)
  // We iterate because titles may contain multiple trailing markers.
  let changed = true;
  while (changed) {
    changed = false;

    const par = title.match(EDITION_PARENS_RE);
    if (par) {
      title = title.slice(0, par.index).trim();
      changed = true;
      continue;
    }

    const suf = title.match(EDITION_SUFFIX_RE);
    if (suf) {
      title = title.slice(0, suf.index).trim();
      changed = true;
      continue;
    }

    const plain = title.match(EDITION_PLAIN_SUFFIX_RE);
    if (plain) {
      // Only strip the plain suffix if it appears as a trailing token and
      // isn't likely part of a longer phrase (we still anchor to end via the regex).
      title = title.slice(0, plain.index).trim();
      changed = true;
      continue;
    }

    const br = title.match(EDITION_BRACKETS_RE);
    if (br) {
      title = title.slice(0, br.index).trim();
      changed = true;
      continue;
    }
  }

  // Normalize unicode and strip diacritics
  const noDiacritics = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  let out = noDiacritics.toLowerCase();

  if (!keepQuotes) {
    // Remove quote characters explicitly (default behaviour)
    out = out.replace(/['’"“”`]/g, "");
  } else {
    // Normalize typographic apostrophes/quotes to ASCII equivalents but keep them
    out = out.replace(/[’‘`]/g, "'");
    out = out.replace(/[“”]/g, '"');
  }

  // Preserve dots used as intra-acronym separators (e.g. "m.a.a.d") while converting
  // other punctuation to spaces. We allow letters/digits, dots and spaces through.
  out = out.replace(/[^a-z0-9. '" ]+/g, " ");

  // Remove spaces around dots so acronyms keep their dot form: "m . a . a . d" => "m.a.a.d"
  out = out.replace(/\s*\.\s*/g, ".");

  // Collapse remaining whitespace and trim
  out = out.replace(/\s+/g, " ").trim();

  return out;
}

/**
 * Normalize Lyrics
 */
const NORMALIZER_VERSION = "v1";

// Expandable list of section labels
const SECTION_LABELS = [
  "intro",
  "verse",
  "pre-chorus",
  "chorus",
  "post-chorus",
  "hook",
  "bridge",
  "outro",
  "refrain",
  "interlude",
] as const;

const SECTION_ALT = SECTION_LABELS.map((s) =>
  s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")
).join("|");

// Alias normalization (expand as you encounter more)
const ALIASES: Record<string, string> = {
  "pre chorus": "pre-chorus",
  prechorus: "pre-chorus",
  "post chorus": "post-chorus",
  postchorus: "post-chorus",
  refrains: "refrain",
  "pre hook": "pre-chorus", // if you see this in the wild
};

function canonicalizeLabel(raw: string): string {
  const k = raw.toLowerCase();
  return ALIASES[k] ?? k;
}

export function normalizeLyricsForHash(
  md: string,
  opts: {
    collapseSectionNumbers?: boolean; // true => "verse 2" and "verse" both => SECTION:verse
    keepBlankStanzaBreaks?: boolean; // true => preserve blank-line boundaries as tokens
  } = {}
): string {
  const { collapseSectionNumbers = false, keepBlankStanzaBreaks = false } =
    opts;

  if (!md) return "";

  // Preserve stanza boundaries optionally
  let t = keepBlankStanzaBreaks
    ? md.replace(/\n{2,}/g, "\n\nPARA_BREAK\n\n")
    : md;

  // Strip diacritics
  t = t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Normalize known label spacing variants first
  t = t.replace(/\bpre[\s-]?chorus\b/gi, "pre-chorus");
  t = t.replace(/\bpost[\s-]?chorus\b/gi, "post-chorus");

  const lines = t.split(/\r?\n/);
  const out: string[] = [];

  for (let line of lines) {
    const raw = line.trim();

    if (!raw) {
      if (keepBlankStanzaBreaks) out.push("PARA_BREAK");
      continue;
    }

    // Remove inline markdown your cleaner might leave (safety)
    line = raw.replace(/^#+\s*/, ""); // strip leading ### if present for matching below

    const m = line.match(
      new RegExp(
        String.raw`^(?:${SECTION_ALT})\s*(\d+)?(?:\s*[:\-\u2013].*)?$`,
        "i"
      )
    );

    if (m) {
      const label = (line.match(new RegExp(`(?:${SECTION_ALT})`, "i"))?.[0] ??
        "section") as string;
      const canon = canonicalizeLabel(label);
      const num = m[1];

      out.push(
        collapseSectionNumbers || !num
          ? `SECTION:${canon}`
          : `SECTION:${canon} ${num}`
      );
      continue;
    }

    // Non-header lyric line
    out.push(raw);
  }

  // Join back and finish normalization
  t = out
    .join("\n")
    .toLowerCase()
    .replace(/['’"“”`]/g, "") // quotes
    .replace(/[^a-z0-9 \n]+/g, " ") // punctuation -> space, keep newlines for PARA_BREAK tokenization
    .replace(/\s+\n\s+/g, "\n") // trim spaces around line breaks
    .replace(/\s+/g, " ") // collapse spaces
    .replace(/\s*\n\s*/g, " ") // collapse remaining line breaks to space
    .trim();

  return t;
}

export async function hashLyrics(cleanedMd: string): Promise<string> {
  const normalized = normalizeLyricsForHash(cleanedMd, {
    collapseSectionNumbers: true,
    keepBlankStanzaBreaks: false,
  });
  const data = new TextEncoder().encode(`${NORMALIZER_VERSION}:${normalized}`);
  const digest = await (
    globalThis.crypto.subtle || (crypto as any).subtle
  ).digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(digest));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Strip trailing featuring/ft/featuring credits from a track title.
 *
 * Accepts both raw and normalized titles (like "feat.marsha ambrosius").
 * Only removes trailing segments and leaves inner words intact.
 */
export function stripFeaturingCredits(title: string): string {
  if (!title) return "";
  let t = title.trim();

  // Remove enclosing brackets like "(feat. ...)" or "[feat ...]" at the end
  t = t.replace(
    /\s*[\(\[\{]\s*(?:feat(?:uring)?|ft)\.?[\s.]+[^\)\]\}]*[\)\]\}]\s*$/i,
    ""
  );

  // Remove unbracketed trailing featuring segments (handles "feat.marsha", "ft marsha", etc.)
  t = t.replace(
    /\s*(?:-|:)?\s*(?:feat(?:uring)?|ft)\.?[\s.]+[a-z0-9 .&,+-]*$/i,
    ""
  );

  // Normalize whitespace again
  return t.replace(/\s+/g, " ").trim();
}

/**
 * Convenience: normalize a raw title and strip trailing featuring credits.
 */
export function normalizeTitleForLyrics(s: string): string {
  return stripFeaturingCredits(normalizeText(s));
}

/**
 * Generate title variants suitable for lyrics providers that are sensitive to apostrophes.
 */
export function generateTitleVariantsForLyrics(s: string): string[] {
  const preserved = stripFeaturingCredits(normalizeText(s, true)).trim();
  // Ensure apostrophes are ASCII in the preserved form (normalizeText with keepQuotes does this)
  const apostropheRemoved = preserved
    .replace(/['’‘`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const fallback = normalizeTitleForLyrics(s);

  const variants: string[] = [];
  for (const v of [preserved, apostropheRemoved, fallback]) {
    if (v && !variants.includes(v)) variants.push(v);
  }
  return variants;
}

/**
 * Genre / comparison helpers
 * Normalize a string for comparison/lookup.
 * Example: "  Hip-Hop/R&B " -> "hip hop r and b" (after diacritic folding and replacements)
 */
export function normalizeForCompare(name: string): string {
  if (!name) return "";

  let s = name.trim();

  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  s = s.toLowerCase();

  s = s.replace(/&/g, "and");

  s = s.replace(/[._-]/g, " ");

  s = s.replace(/\s+/g, " ").trim();

  return s;
}

/**
 * Slugify a string for machine-friendly identifiers.
 * Example: "Hip-Hop & R&B" -> "hip-hop-and-rb"
 */
export function slugify(name: string): string {
  if (!name) return "";

  let s = name.trim();

  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  s = s.toLowerCase();

  s = s.replace(/&/g, "and");

  s = s.replace(/[^a-z0-9\s-]/g, "");

  s = s.replace(/\s+/g, "-");

  s = s.replace(/-+/g, "-");

  s = s.replace(/^-+|-+$/g, "");

  return s;
}
