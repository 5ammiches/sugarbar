from typing import Any, Dict, Optional, Tuple

import httpx
from crawl4ai import (
    AsyncWebCrawler,
    CacheMode,
    CrawlerRunConfig,
    DefaultMarkdownGenerator,
    PruningContentFilter,
)

from app.base import LyricsBaseProvider


# TODO implement retries for failed api calls
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
            if "meta" in data and data["meta"].get("status", 200) >= 400:
                raise httpx.HTTPError(f"Genius API Error in response: {data['meta']}")

            if not data:
                raise httpx.HTTPError(
                    f"Empty response body from request for: {resp.url}"
                )

            payload = data.get("response", data)
            if not payload:
                raise httpx.HTTPError("No 'response' data in payload")

            return payload
        except httpx.HTTPError as e:
            print(f"Error while making request for: {e.request.url}")
            raise e

    # TODO handle for tracks that have multiple artists
    async def _search(
        self, title: str, artist: str, per_page: int = 1, page: int = 1
    ) -> Dict[str, Any]:
        if not title or not artist:
            raise ValueError("Title and artist must be provided")
        params = {
            "q": f"{title}-{artist}",
            "per_page": per_page,
            "page": page,
        }
        res = await self._get("/search", params)
        return res

    def _first_track_id(self, search_result: Dict[str, Any]) -> Optional[int]:
        hits = search_result.get("hits", [])
        if not hits:
            raise ValueError("No results found")

        first = hits[0]
        if first.get("type") == "song":
            return first.get("result", {}).get("id")
        return None

    async def _url_for_track(self, id: int) -> Optional[str]:
        res = await self._get(f"/songs/{id}")
        if res.get("song"):
            return res.get("song", {}).get("url")
        return None

    async def get_lyric_url(self, title: str, artist: str) -> Optional[str]:
        try:
            res = await self._search(title, artist)
            id = self._first_track_id(res)
            if not id:
                return None

            url = await self._url_for_track(id)
            if not url:
                print(f"URL not found for {title}-{artist} ")
                return None

            return url
        except Exception as e:
            raise ValueError(f"Error fetching lyrics: {str(e)}")

    async def scrape_lyrics(self, url: str) -> Tuple[Optional[str], Optional[str]]:
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
                print("Scraper Failed:", result.error_message)  # type: ignore
                print("Debug HTML snippet:\n", result.cleaned_html[:1000])  # type: ignore
                return None, result.error_message  # type: ignore

            md = result.markdown  # type: ignore
            return md, None
        except Exception as e:
            return None, str(e)


# async def amain() -> None:
#     ACCESS_TOKEN = os.getenv("GENIUS_CLIENT_ACCESS_TOKEN")
#     if not ACCESS_TOKEN:
#         raise ValueError("No access token provided")

#     genius = Genius(ACCESS_TOKEN)
#     try:
#         lyric_url = await genius.get_lyric_url(
#             title="feel it in the air", artist="beanie sigel"
#         )
#         if not lyric_url:
#             raise ValueError("No lyrics found")

#         md, err = await genius.scrape_lyrics(lyric_url)
#         if not md:
#             raise RuntimeError(f"No lyrics found: {err}")

#         lyrics = genius.clean_lyrics_markdown(md)

#         with open("lyrics.md", "w", encoding="utf-8") as f:
#             f.write(lyrics)

#     except Exception as e:
#         print(f"Error fetcing lyrics: {str(e)}")
#     finally:
#         await genius.aclose()


# if __name__ == "__main__":
#     asyncio.run(amain())
