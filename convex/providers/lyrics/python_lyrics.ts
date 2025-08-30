import { logger } from "@/lib/utils";
import { LyricProvider, MapperFn } from "@/utils/providers/base";
import { LyricSource, LyricResponse } from "@/utils/typings";
import { ZodError } from "zod";

export class PythonLyricProvider implements LyricProvider {
  private BASE_URL: string;

  constructor(private baseUrl?: string) {
    if (!this.baseUrl) {
      throw new Error("API endpoint is missing");
    }

    this.BASE_URL = this.baseUrl;
  }

  async getLyricsByTrack(source: LyricSource, title: string, artist: string) {
    const url =
      `${this.BASE_URL}/lyrics/${encodeURIComponent(source)}` +
      `?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(
        artist
      )}`;

    try {
      const resp = await fetch(url, {
        method: "GET",
        headers: { Accept: "application/json" },
      });

      if (!resp.ok) {
        logger.error("Lyrics request failed", {
          status: resp.status,
          statusText: resp.statusText,
          url,
        });
        throw new Error(
          `Lyrics: Request to ${url} ${resp.status} ${resp.statusText}`
        );
      }

      const data = await resp.json();

      return LyricResponse.parse(data);
    } catch (err) {
      if (err instanceof Error) {
        logger.error("Error getting lyrics for track", {
          artist: artist,
          title: title,
        });
        throw new Error(`Lyrics: Error getting lyrics: ${err.message}`);
      }
      if (err instanceof ZodError) {
        logger.error("Error parsing lyrics response", {
          artist: artist,
          title: title,
        });
        throw new Error(`Lyrics: Error parsing lyric response: ${err.message}`);
      }
    }
  }
}
