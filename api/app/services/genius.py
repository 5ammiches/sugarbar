# app/genius.py
from typing import Any, Dict, Optional, Tuple

import httpx
from crawl4ai import (
    AsyncWebCrawler,
    CacheMode,
    CrawlerRunConfig,
    DefaultMarkdownGenerator,
    PruningContentFilter,
)

from app.services.base import LyricsBaseProvider
from app.utils.logger import NoResultsError, ProviderError


class Genius(LyricsBaseProvider):
    BASE_URL = "https://api.genius.com"

    def __init__(self, access_token: str, client: Optional[httpx.AsyncClient] = None):
        if not access_token:
            raise ValueError("Access token must be provided")

        self.access_token = access_token
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Accept": "application/json",
            "User-Agent": "DailyBar/1.0 (+https://dailybar.netlify.app/)",
        }
        self.client = client or httpx.AsyncClient(
            base_url=self.BASE_URL, timeout=10.0, headers=headers
        )

    async def aclose(self) -> None:
        await self.client.aclose()

    async def _get(
        self, path: str, params: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        try:
            resp = await self.client.get(url=path, params=params, timeout=15)
            resp.raise_for_status()
            data = resp.json()

            # Genius sometimes returns 200 with an error in "meta"
            if "meta" in data and data["meta"].get("status", 200) >= 400:
                raise ProviderError(f"Genius API error in response: {data['meta']}")

            if not data:
                raise ProviderError(f"Empty response body for: {resp.url}")

            payload = data.get("response", data)
            if not payload:
                raise ProviderError("No 'response' data in payload")

            return payload
        except httpx.HTTPError as e:
            raise ProviderError(f"Genius HTTP error: {str(e)}") from e
        except ValueError as e:
            raise ProviderError(f"Genius parse error: {str(e)}") from e

    async def _search(
        self, title: str, artist: str, per_page: int = 1, page: int = 1
    ) -> Dict[str, Any]:
        if not title or not artist:
            raise ProviderError("Title and artist must be provided")
        params = {
            "q": f"{title}-{artist}",
            "per_page": per_page,
            "page": page,
        }
        return await self._get("/search", params)

    def _first_track_id(self, search_result: Dict[str, Any]) -> Optional[int]:
        hits = search_result.get("hits", [])
        if not hits:
            raise NoResultsError("No results found")

        first = hits[0]
        if first.get("type") == "song":
            return first.get("result", {}).get("id")
        raise NoResultsError("Top result is not a song")

    async def _url_for_track(self, id: int) -> str:
        res = await self._get(f"/songs/{id}")
        song = res.get("song")
        if not song:
            raise ProviderError("Song payload missing in response")
        url = song.get("url")
        if not url:
            raise NoResultsError("No URL found for track")
        return url

    async def get_lyric_url(self, title: str, artist: str) -> Optional[str]:
        try:
            res = await self._search(title, artist)
            track_id = self._first_track_id(res)
            if not track_id:
                raise NoResultsError("No track ID found")

            url = await self._url_for_track(track_id)
            return url
        except (NoResultsError, ProviderError):
            # Raise domain errors unchanged so the route can translate them to proper HTTP codes
            raise
        except Exception as e:
            # Any other unexpected error is a provider failure from the app's perspective
            raise ProviderError(f"Genius client error: {str(e)}") from e

    async def scrape_lyrics(self, url: str) -> Tuple[Optional[str], Optional[str]]:
        print(f"scraping url {url}")
        
        prune_filer = PruningContentFilter(
            threshold=0.5,
            threshold_type="fixed",
        )
        fit_md_generator = DefaultMarkdownGenerator(
            content_filter=prune_filer,
            content_source="raw_html",
            options={"ignore_links": True},
        )
        config = CrawlerRunConfig(
            css_selector="div[data-lyrics-container='true']",
            excluded_selector="div[data-exclude-from-selection='true']",
            cache_mode=CacheMode.BYPASS,
            markdown_generator=fit_md_generator,
            scan_full_page=True,
            remove_overlay_elements=True,
            word_count_threshold=1,
        )

        try:
            async with AsyncWebCrawler() as crawler:
                result = await crawler.arun(url, config=config)

            if not result.success:  # type: ignore
                return None, str(result.error_message)  # type: ignore

            md = result.markdown  # type: ignore
            return md, None
        except Exception as e:
            return None, str(e)
