import { logger } from "@/lib/utils";
import { AudioLyricProvider, MapperFn } from "../base";
import {
  LyricSource,
  LyricResponseSchema,
  YTSearchResponseSchema,
  YTPreviewResponse,
  LyricResponse,
  YTSearchResponse,
  PreviewDownload,
  YTPreviewResponseSchema,
} from "@/lib/typings";
import z, { ZodError } from "zod";
import { internalAction } from "../../_generated/server";

export class PythonProvider implements AudioLyricProvider {
  private BASE_URL: string;

  constructor(private baseUrl?: string) {
    if (!this.baseUrl) {
      throw new Error("API endpoint is missing");
    }

    this.BASE_URL = this.baseUrl;
  }

  async getLyricsByTrack(
    source: LyricSource,
    title: string,
    artist: string
  ): Promise<LyricResponse | undefined> {
    const url =
      `${this.BASE_URL}/api/lyrics/${encodeURIComponent(source)}` +
      `?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`;

    const resp = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        source: source,
        title: title,
        artist: artist,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const isJson = resp.headers.get("content-type")?.toLowerCase().includes("application/json");

    if (!resp.ok) {
      let detail = `${resp.status} ${resp.statusText}`;
      try {
        if (isJson) {
          const errBody = await resp.json();
          if (errBody?.detail) {
            detail =
              typeof errBody.detail === "string" ? errBody.detail : JSON.stringify(errBody.detail);
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

  async searchYT(
    title: string,
    artist: string,
    durationSec: number
  ): Promise<YTSearchResponse | undefined> {
    const url = `${this.BASE_URL}/api/youtube/search-scrape`;

    const resp = await fetch(url, {
      method: "POST",
      body: JSON.stringify({
        title: title,
        artist: artist,
        durationSec: durationSec,
      }),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const isJson = resp.headers.get("content-type")?.toLowerCase().includes("application/json");

    if (!resp.ok) {
      let detail = `${resp.status} ${resp.statusText}`;
      try {
        if (isJson) {
          const errBody = await resp.json();
          if (errBody?.detail) {
            detail =
              typeof errBody.detail === "string" ? errBody.detail : JSON.stringify(errBody.detail);
          }
        } else {
          const text = await resp.text();
          if (text) detail = text;
        }
      } catch {
        // ignore parse failures
      }

      logger.error("Youtube search failed", {
        status: resp.status,
        title,
        artist,
        url,
        detail,
      });
      throw new Error(`Youtube search failed: ${detail}`);
    }

    const data = await resp.json();
    const searchResult = YTSearchResponseSchema.safeParse(data);
    if (!searchResult.success) {
      logger.error(`Youtube: search response payload parse failed`, {
        title,
        artist,
        issues: searchResult.error?.issues,
      });
      throw new Error(`Youtube: Unexpected search response shape`);
    }

    return searchResult.data;
  }

  async downloadYTAudioPreview(
    trackId: string,
    candidateUrls: string[],
    bitrateKbps?: number,
    previewStartSec?: number,
    previewLenSec?: number
  ): Promise<PreviewDownload | undefined> {
    const url = `${this.BASE_URL}/api/youtube/preview-scrape`;

    const body: Record<string, any> = {
      trackId,
      candidateUrls,
    };

    if (bitrateKbps !== undefined) body.bitrateKbps = bitrateKbps;
    if (previewStartSec !== undefined) body.previewStartSec = previewStartSec;
    if (previewLenSec !== undefined) body.previewLenSec = previewLenSec;

    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    const isJson = res.headers.get("content-type")?.toLowerCase().includes("application/json");

    if (!res.ok) {
      let detail = `${res.status} ${res.statusText}`;
      try {
        if (isJson) {
          const errBody = await res.json();
          if (errBody?.detail) {
            detail =
              typeof errBody.detail === "string" ? errBody.detail : JSON.stringify(errBody.detail);
          }
        } else {
          const text = await res.text();
          if (text) detail = text;
        }
      } catch {
        // ignore parse failures
      }

      logger.error("Youtube preview download failed", {
        status: res.status,
        trackId,
        url,
        detail,
      });
      throw new Error(`Youtube preview download failed: ${detail}`);
    }

    try {
      const blob = await res.blob();
      const meta = YTPreviewResponseSchema.parse({
        sourceUrl: res.headers.get("X-Source-Url"),
        contentType: res.headers.get("Content-Type") ?? (blob.type || "audio/mp4"),
        durationSec: Number(res.headers.get("X-Preview-Duration") ?? previewLenSec),
        bitrateKbps: Number(res.headers.get("X-Bitrate-Kbps") ?? bitrateKbps),
        codec: res.headers.get("X-Codec") ?? "aac",
      });

      return { blob, meta };
    } catch (err) {
      if (err instanceof z.ZodError) {
        logger.error(`Youtube: preview download response payload parse failed`, {
          trackId,
          issues: err.issues,
        });
      }
      throw new Error(`Youtube: Unexpected search response shape`);
    }
  }
}
