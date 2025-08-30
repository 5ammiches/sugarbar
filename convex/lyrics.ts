import { PythonLyricProvider } from "./providers/lyrics/python_lyrics";
import { action } from "./_generated/server";

export const GetTrackLyrics = action({
  args: {},
  handler: async (ctx, args) => {
    const baseUrl = process.env.PYTHON_LYRICS_URL;

    const lyricProvider = new PythonLyricProvider(baseUrl);

    const lyrics = await lyricProvider.getLyricsByTrack(
      "genius",
      "maad city",
      "kendrick lamar"
    );

    if (!lyrics) {
      throw new Error("Lyrics not found");
    }

    return lyrics;
  },
});
