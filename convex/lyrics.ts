import { PythonLyricProvider } from "./providers/lyrics/python_lyrics";
import { v } from "convex/values";
import { action } from "./_generated/server";
import { LYRIC_SOURCES } from "@/lib/constants";

function makeLyrics(endpoint?: string) {
  endpoint = endpoint ?? process.env.PYTHON_LYRICS_URL;
  return new PythonLyricProvider(endpoint);
}

const vLyricsSource = v.union(...LYRIC_SOURCES.map((s) => v.literal(s)));
const normalize = (s: string) =>
  s
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

// TODO: possibly update the client and this function for tracks that have multiple artists
export const getLyricsByTrack = action({
  args: {
    source: vLyricsSource,
    title: v.string(),
    artist: v.string(),
  },
  handler: async (ctx, args) => {
    const client = makeLyrics();
    const title = normalize(args.title);
    const artist = normalize(args.artist);

    const lyrics = await client.getLyricsByTrack(args.source, title, artist);

    if (!lyrics || lyrics.lyrics?.length === 0) {
      throw new Error("Lyrics not found");
    }

    return { lyrics: lyrics };
  },
});
