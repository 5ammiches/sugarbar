import {
  SpotifyAlbum,
  SpotifyArtist,
  SpotifySimplifiedArtist,
  SpotifyTrack,
  SpotifySimplifiedAlbum,
} from "../providers/music/spotifySchemas";
import { EmbeddedAlbum, EmbeddedArtist, EmbeddedTrack } from "./typings";

type Maybe<T> = T | null | undefined;

export const toArray = <T>(v: Maybe<T[]>) => (Array.isArray(v) ? v : []);
export const safeStr = (v: Maybe<string>) => (typeof v === "string" ? v : "");
export const safeDate = (v: Maybe<string>) => safeStr(v) || undefined;
/**
 * Spotify helpers
 */
export const pickUrl = (obj: Maybe<{ external_urls?: { spotify?: string } }>) =>
  obj?.external_urls?.spotify;

type AnySpotifyArtist = SpotifyArtist | SpotifySimplifiedArtist;
type AnySpotifyAlbum = SpotifyAlbum | SpotifySimplifiedAlbum;

export const mapEmbeddedArtist = (ar: AnySpotifyArtist): EmbeddedArtist => {
  return {
    provider_id: ar.id,
    provider: "spotify",
    name: ar.name,
    url: pickUrl(ar),
  };
};

export const mapEmbeddedAlbum = (
  al: Maybe<AnySpotifyAlbum>
): EmbeddedAlbum | undefined => {
  if (!al) {
    return undefined;
  }

  return {
    provider_id: al.id,
    provider: "spotify",
    title: al.name,
    url: pickUrl(al),
  };
};

export const mapEmbeddedTrack = (t: SpotifyTrack): EmbeddedTrack => {
  return {
    provider_id: t.id,
    provider: "spotify",
    title: t.name,
    duration_ms: t.duration_ms,
    explicit_flag: t.explicit,
    url: pickUrl(t),
    primary_artist: mapEmbeddedArtist(t.artists[0]),
    album: mapEmbeddedAlbum(t.album),
  };
};

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

const EDITION_SUFFIX_RE =
  /\s*(?:-|:)\s*(deluxe(?: edition)?|expanded(?: edition)?|remaster(?:ed)?(?:\s*\d{2,4})?|bonus track(?:s)?(?: version)?|super deluxe|collector'?s edition|anniversary edition|20(?:th)? anniversary edition)\s*$/i;

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

export function normalizeArtistName(s: string) {
  if (!s) return "";
  // Normalize unicode and strip diacritics
  const noDiacritics = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  return noDiacritics
    .toLowerCase()
    .replace(/['’"“”`]/g, "") // quotes
    .replace(/[^a-z0-9 ]+/g, " ") // non alphanumerics -> space
    .replace(/\s+/g, " ") // collapse spaces
    .trim();
}
