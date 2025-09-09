import { logger } from "@/lib/utils";
import { LyricProvider, MapperFn } from "../base";
import { LyricSource, LyricResponseSchema } from "../../utils/typings";
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

    const resp = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
    });

    const isJson = resp.headers
      .get("content-type")
      ?.toLowerCase()
      .includes("application/json");

    if (!resp.ok) {
      let detail = `${resp.status} ${resp.statusText}`;
      try {
        if (isJson) {
          const errBody = await resp.json();
          if (errBody?.detail) {
            detail =
              typeof errBody.detail === "string"
                ? errBody.detail
                : JSON.stringify(errBody.detail);
          }
        } else {
          const text = await resp.text();
          if (text) detail = text;
        }
      } catch {
        // ignore parse failures
      }

      logger.error("Lyrics request failed", {
        status: resp.status,
        title,
        artist,
        url,
        detail,
      });
      throw new Error(`Lyrics: ${detail}`);
    }

    const data = isJson ? await resp.json() : await resp.text();
    const lyrics = LyricResponseSchema.safeParse(data);
    if (!lyrics.success) {
      logger.error(`${source}: lyrics payload parse failed`, {
        title,
        artist,
        issues: lyrics.error?.issues,
      });
      throw new Error(`${source}: Unexpected lyric response shape`);
    }

    return lyrics.data;
  }
}
