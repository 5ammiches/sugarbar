import json
import os
import re
import shutil
import subprocess
import urllib.parse
from typing import Any, Dict, Final, List, Optional

import isodate
import requests
from dotenv import load_dotenv
from pyyoutube import Client
from yt_dlp import YoutubeDL

from app.logger import NoResultsError, ProviderError

load_dotenv()
FFMPEG = shutil.which("ffmpeg") or "/usr/bin/ffmpeg"

raw_key: Optional[str] = os.getenv("YOUTUBE_API_KEY")
if raw_key is None:
    raise RuntimeError(
        "YOUTUBE_API_KEY is missing. Put it in your environment or a .env file."
    )
API_KEY:  Final[str] = raw_key


class YoutubeScraper:
    """Manual YouTube scraping implementation based on the Go code approach"""

    def __init__(self):
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept-Language": "en",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            }
        )
        self.duration_match_threshold = 5

    def _parse_duration_string(self, duration_str: str) -> int:
        """Convert duration string like '3:45' to seconds"""
        if not duration_str:
            return 0

        parts = duration_str.split(":")
        if len(parts) == 2:  # MM:SS
            try:
                minutes = int(parts[0])
                seconds = int(parts[1])
                return minutes * 60 + seconds
            except ValueError:
                return 0
        elif len(parts) == 3:  # HH:MM:SS
            try:
                hours = int(parts[0])
                minutes = int(parts[1])
                seconds = int(parts[2])
                return hours * 3600 + minutes * 60 + seconds
            except ValueError:
                return 0
        return 0

    def _extract_yt_initial_data(self, html_content: str) -> Optional[Dict[Any, Any]]:
        """Extract ytInitialData JSON from YouTube search page HTML"""
        patterns = [
            r'window\["ytInitialData"\]\s*=\s*({.+?});',
            r"var ytInitialData\s*=\s*({.+?});",
            r'ytInitialData"\s*:\s*({.+?}),',
            r"ytInitialData\s*=\s*({.+?});",
        ]

        for pattern in patterns:
            match = re.search(pattern, html_content, re.DOTALL)
            if match:
                try:
                    json_str = match.group(1)
                    return json.loads(json_str)
                except json.JSONDecodeError:
                    continue

        return None

    def _parse_search_results(
        self, yt_data: Dict[Any, Any], limit: int = 10
    ) -> List[Dict[str, Any]]:
        """Parse YouTube search results from ytInitialData"""
        results = []

        try:
            contents = (
                yt_data.get("contents", {})
                .get("twoColumnSearchResultsRenderer", {})
                .get("primaryContents", {})
                .get("sectionListRenderer", {})
                .get("contents", [])
            )

            for section in contents:
                items = section.get("itemSectionRenderer",
                                    {}).get("contents", [])

                for item in items:
                    video_renderer = item.get("videoRenderer")
                    if not video_renderer:
                        continue

                    video_id = video_renderer.get("videoId")
                    if not video_id:
                        continue

                    # Extract title
                    title_runs = video_renderer.get(
                        "title", {}).get("runs", [])
                    title = title_runs[0].get("text", "") if title_runs else ""

                    # Extract uploader
                    owner_text = video_renderer.get(
                        "ownerText", {}).get("runs", [])
                    uploader = owner_text[0].get(
                        "text", "") if owner_text else ""

                    # Extract duration
                    duration_text = video_renderer.get("lengthText", {}).get(
                        "simpleText", ""
                    )

                    if (
                        not duration_text
                    ):  # Skip live streams and videos without duration
                        continue

                    duration_seconds = self._parse_duration_string(
                        duration_text)

                    result = {
                        "videoId": video_id,
                        "title": title,
                        "uploader": uploader,
                        "duration": duration_text,
                        "durationSec": duration_seconds,
                        "url": f"https://youtube.com/watch?v={video_id}",
                    }

                    results.append(result)

                    if len(results) >= limit:
                        return results

        except Exception as e:
            raise ProviderError(
                f"Error parsing YouTube search results: {str(e)}"
            ) from e

        return results

    async def search_scrape(
        self, title: str, artist: str, duration_sec: int, limit: int = 25
    ) -> List[Dict[str, Any]]:
        """Search YouTube using manual scraping approach"""
        search_query = f"'{title}' {artist}"
        encoded_query = urllib.parse.quote(search_query)
        search_url = f"https://www.youtube.com/results?search_query={
            encoded_query}"

        try:
            response = self.session.get(search_url, timeout=10)
            response.raise_for_status()

            yt_data = self._extract_yt_initial_data(response.text)
            if not yt_data:
                raise ProviderError(
                    "Could not extract YouTube initial data from search page"
                )

            search_results = self._parse_search_results(yt_data, limit)

            if not search_results:
                raise NoResultsError(
                    f"No search results found for: {search_query}")

            # Filter by duration matching (similar to Go code)
            allowed_duration_start = duration_sec - self.duration_match_threshold
            allowed_duration_end = duration_sec + self.duration_match_threshold

            filtered_results = []
            for result in search_results:
                result_duration = result["durationSec"]
                if allowed_duration_start <= result_duration <= allowed_duration_end:
                    filtered_results.append(
                        {
                            "videoId": result["videoId"],
                            "title": result["title"],
                            "durationSec": result_duration,
                            "url": result["url"],
                            "category": "10",  # Default music category
                        }
                    )

            if not filtered_results:
                raise NoResultsError(
                    f"No duration-matched results found for: {search_query}"
                )

            filtered_results.sort(key=lambda x: abs(
                x["durationSec"] - duration_sec))

            return filtered_results[:5]

        except requests.RequestException as e:
            raise ProviderError(
                f"YouTube scraping request failed: {str(e)}") from e
        except Exception as e:
            raise ProviderError(f"YouTube scraping error: {str(e)}") from e

    def cut_to_m4a(
        self, src: str, dst: str, start: float, dur: float, bitrate_kbps: int
    ):
        cmd = [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            str(start),
            "-t",
            str(dur),
            "-i",
            src,
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            f"{bitrate_kbps}k",
            "-movflags",
            "faststart",
            dst,
        ]
        subprocess.run(cmd, check=True)


class Youtube:
    def __init__(self, api_key: str):
        if not api_key:
            raise ValueError("Youtube API Key is required")

        self.api_key = api_key
        self.client = Client(api_key=self.api_key)

    def _iso_to_seconds(self, iso: str):
        return int(isodate.parse_duration(iso).total_seconds())

    async def search(self, title: str, artist: str, duration_sec: int):
        try:
            resp = self.client.search.list(
                parts=["snippet"],
                max_results=25,
                q=f"{title} {artist}",
                event_type="none",
                return_json=False,
                type="video",
                # video_category_id="10",
                order="relevance",
                safe_search="none",
            )

            if not resp or not resp.items or isinstance(resp, dict):
                raise NoResultsError(
                    f"Youtube client: no results found for query: {
                        title} - {artist}"
                )

            video_ids = [
                item.id.videoId
                for item in resp.items
                if item.id and item.id.kind == "youtube#video" and item.id.videoId
            ]

            videos = self.client.videos.list(video_id=",".join(video_ids))

            if not videos or not videos.items or isinstance(videos, dict):
                raise ProviderError(
                    f"Youtube client: no results found for query: {
                        title} - {artist}"
                )

            tol = 5
            low = duration_sec - tol
            high = duration_sec + tol

            res = []
            for v in videos.items:
                if (
                    not v.contentDetails
                    or not v.contentDetails.duration
                    or not v.snippet
                ):
                    continue
                track_dur = self._iso_to_seconds(v.contentDetails.duration)
                if low <= track_dur <= high:
                    res.append(
                        {
                            "videoId": v.id,
                            "title": v.snippet.title,
                            "durationSec": track_dur,
                            "url": f"https://www.youtube.com/watch?v={v.id}",
                            "category": v.snippet.categoryId,
                        }
                    )
                if len(res) >= 5:
                    break

            if not res:
                raise ProviderError(
                    f"Youtube client: no results found for query: {
                        title} - {artist}"
                )

            return res

        except Exception as e:
            raise ProviderError(f"Youtube client error: {str(e)}") from e

    def dl_best_audio(self, video_url: str, tmp_dir: str):
        out_tmpl = os.path.join(tmp_dir, "%(id)s.%(ext)s")
        ydl_opts = {
            "outtmpl": {"default": out_tmpl},
            "format": "bestaudio[ext=m4a]/bestaudio[ext=mp4]/bestaudio/best[height<=480]/best",
            "noplaylist": True,
            "quiet": True,
            "no_warnings": True,
            "socket_timeout": 15,
            "retries": 3,
            "concurrent_fragment_downloads": 4,
            "extract_flat": False,
            "ignoreerrors": False,
        }
        try:
            with YoutubeDL(ydl_opts) as ydl:  # type: ignore
                rc = ydl.download([video_url])
                if rc != 0:
                    raise RuntimeError("yt-dlp failed")
            files = [
                f
                for f in os.listdir(tmp_dir)
                if not f.endswith(".part") and not f.endswith(".info.json")
            ]
            if not files:
                raise RuntimeError("No file produced")
            files.sort(key=lambda f: os.path.getmtime(
                os.path.join(tmp_dir, f)))
            return os.path.join(tmp_dir, files[-1])

        except Exception as e:
            # Try with a more permissive format as fallback
            try:
                fallback_opts = ydl_opts.copy()
                fallback_opts["format"] = "worst/best"
                with YoutubeDL(fallback_opts) as ydl:  # type: ignore
                    rc = ydl.download([video_url])
                    if rc != 0:
                        raise RuntimeError("yt-dlp fallback failed")
                files = [
                    f
                    for f in os.listdir(tmp_dir)
                    if not f.endswith(".part") and not f.endswith(".info.json")
                ]
                if not files:
                    raise RuntimeError("No file produced in fallback")
                files.sort(key=lambda f: os.path.getmtime(
                    os.path.join(tmp_dir, f)))
                return os.path.join(tmp_dir, files[-1])
            except Exception as fallback_error:
                raise ProviderError(
                    f"Youtube client error (both primary and fallback failed): Primary: {
                        str(e)}, Fallback: {str(fallback_error)}"
                ) from e

    def cut_to_m4a(
        self, src: str, dst: str, start: float, dur: float, bitrate_kbps: int
    ):
        cmd = [
            FFMPEG,
            "-hide_banner",
            "-loglevel",
            "error",
            "-ss",
            str(start),
            "-t",
            str(dur),
            "-i",
            src,
            "-vn",
            "-c:a",
            "aac",
            "-b:a",
            f"{bitrate_kbps}k",
            "-movflags",
            "faststart",
            dst,
        ]
        subprocess.run(cmd, check=True)


# async def main():
#     youtube = Youtube(API_KEY)
#     resp = await youtube.search(
#         title="american dreamin'",
#         artist="jay z",
#         duration_sec=288
#     )

#     if not resp:
#         return None

#     pp(resp)
#     return resp

# if __name__ == "__main__":
#     asyncio.run(main())
