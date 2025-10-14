import json
from typing import Any, Dict, Optional, Tuple
from urllib.parse import urlencode, urljoin

from crawl4ai import (
    AsyncWebCrawler,
    BrowserConfig,
    CacheMode,
    CrawlerRunConfig,
    DefaultMarkdownGenerator,
    JsonCssExtractionStrategy,
    PruningContentFilter,
)

from utils.logger import NoResultsError, ProviderError

from .base import LyricsBaseProvider


# TODO maybe refactor with an initialized AcynWebCrawler since it is used in two methods here
class Musixmatch(LyricsBaseProvider):
    BASE_URL = "https://www.musixmatch.com"

    def __init__(self, musixmatch_profile_path):
        self.musixmatch_profile_path = musixmatch_profile_path

    def _get_top_result(
        self, search_result: Dict[str, list]
    ) -> Optional[Dict[str, Any]]:
        if not search_result.get("best_result") and not search_result.get("tracks"):
            raise NoResultsError("No results found")

        result = search_result.get("best_result", {})
        if result:
            return result[0]

        result = search_result.get("tracks", {})
        if result is None:
            raise NoResultsError("No results found")

        return result[0]

    async def _search(
        self, title: str, artist: str, per_page: int = 1, page: int = 1
    ) -> Optional[Dict[str, list]]:
        """
        return the search results from Musixmatch
        - track res's will either be in "Best Result" section or at top of "Tracks" section
        - check for "Best res" first then check for top of "Tracks" section
        - tracks are in the url format BASE_URL/lyrics/{artist}/{title}
        """

        params = {
            "query": f"{title} {artist}",
            "page": page,
            "per_page": per_page,
        }

        encoded_params = urlencode(params)
        search_query = urljoin(self.BASE_URL, f"/search?{encoded_params}")

        schema = {
            "name": "SearchResults",
            "baseSelector": "body",
            "fields": [
                {
                    "name": "best_results",
                    "type": "list",
                    "selector": "div.r-140ww7k",
                    "fields": [
                        {
                            "name": "url",
                            "selector": "a[href^='/lyrics']:first-of-type",
                            "type": "attribute",
                            "attribute": "href",
                        },
                        {
                            "name": "title",
                            "selector": "a[href^='/lyrics'] div[dir='auto'][style*='contentPrimary']",
                            "type": "text",
                            "default": "",
                        },
                        {
                            "name": "artist",
                            "selector": "a[href^='/lyrics'] div[dir='auto'][style*='contentSecondary']",
                            "type": "text",
                            "default": "",
                        },
                    ],
                },
                {
                    "name": "tracks",
                    "type": "list",
                    "selector": "div.r-1f720gc",
                    "fields": [
                        {
                            "name": "url",
                            "selector": "a[href^='/lyrics']",
                            "type": "attribute",
                            "attribute": "href",
                            "default": None,
                        },
                        {
                            "name": "title",
                            "selector": "a[href^='/lyrics'] div[dir='auto'][style*='contentPrimary']",
                            "type": "text",
                            "default": "",
                        },
                        {
                            "name": "artist",
                            "selector": "a[href^='/lyrics'] div[dir='auto'][style*='contentSecondary']",
                            "type": "text",
                            "default": "",
                        },
                    ],
                },
            ],
        }

        strategy = JsonCssExtractionStrategy(schema)

        crawler_config = CrawlerRunConfig(
            extraction_strategy=strategy,
            cache_mode=CacheMode.BYPASS,
            scan_full_page=True,
            remove_overlay_elements=True,
            word_count_threshold=1,
        )

        browser_config = BrowserConfig(
            headless=True,
            verbose=True,
            use_managed_browser=True,
            use_persistent_context=True,
            user_data_dir=self.musixmatch_profile_path,
            browser_type="chromium",
            text_mode=True
        )

        try:
            async with AsyncWebCrawler(config=browser_config) as crawler:
                res = await crawler.arun(search_query, config=crawler_config)

                if not res.success:  # type: ignore
                    print("Debug HTML snippet:\n", res.cleaned_html[:1000])  # type: ignore
                    raise ValueError(
                        f"Musixmatch searching failed: {res.error_message}"  # type: ignore
                    )

                data = json.loads(res.extracted_content)  # type: ignore
                if not data:
                    print(f"Results from scraper: {res.extracted_content}")  # type: ignore
                    raise NoResultsError("No search results found")

                raw = data[0]

                # FIX normalize functions here for the title and artist
                query_title = self.normalize_text(title)
                # query_artist = self.normalize_text(artist)
                best_results = []
                if raw.get("best_results"):
                    for track in raw.get("best_results"):
                        track["title"] = self.normalize_text(track.get("title", ""))
                        track["artist"] = self.normalize_text(track.get("artist", ""))

                        if "url" in track and track["url"]:
                            track["url"] = urljoin(self.BASE_URL, track["url"])
                            # if (
                            #     track["title"] == query_title
                            #     # and track["artist"] == query_artist
                            # ):
                            #     best_results.append(track)
                            best_results.append(track)

                tracks = []
                for t in raw.get("tracks", []):
                    if "url" in t and t["url"]:
                        track = {**t}
                        track["url"] = urljoin(self.BASE_URL, t["url"])
                        track["title"] = self.normalize_text(track.get("title", ""))
                        track["artist"] = self.normalize_text(track.get("artist", ""))

                        # if (
                        #     track["title"] == query_title
                        #     # and track["artist"] == query_artist
                        # ):
                        tracks.append(track)

                return {"best_result": best_results, "tracks": tracks}

        except Exception as e:
            raise ProviderError(f"Error making search query: {str(e)}")

    async def get_lyric_url(self, title: str, artist: str) -> Optional[str]:
        try:
            res = await self._search(title, artist)
            if not res:
                raise NoResultsError("No results found")

            top_result = self._get_top_result(res)

            if not top_result or not top_result["url"]:
                raise NoResultsError("No URL found for top result")

            return top_result["url"]
        except (NoResultsError, ProviderError):
            raise
        except Exception as e:
            raise ProviderError(f"Musixmatch client error: {str(e)}") from e

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
            css_selector="div.css-175oi2r.r-zd98yo",
            excluded_selector="div.css-175oi2r.r-zd98yo:has(a)",
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


# async def amain():
#     musix = Musixmatch()
#     try:
#         url = await musix.get_lyric_url(title="blue laces", artist="nipsey hussle")
#         if not url:
#             raise RuntimeError("No URL found")

#         md, err = await musix.scrape_lyrics(url)
#         if not md:
#             raise RuntimeError(f"No lyrics found: {err}")

#         lyrics = musix.clean_lyrics_markdown(md)

#         with open("lyrics.md", "w", encoding="utf-8") as f:
#             f.write(lyrics)

#     except Exception as e:
#         print(f"Error fetching lyrics: {str(e)}")
#     finally:
#         await musix.aclose()


# if __name__ == "__main__":
#     asyncio.run(amain())
