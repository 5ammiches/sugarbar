import re
import unicodedata
from crawl4ai import (
    AsyncWebCrawler,
    CacheMode,
    CrawlerRunConfig,
    DefaultMarkdownGenerator,
    PruningContentFilter,
)
from abc import ABC, abstractmethod
from typing import Optional, Protocol, Tuple, runtime_checkable, List

from unidecode import unidecode


@runtime_checkable
class AsyncClosable(Protocol):
    async def aclose(self):
        return None

# class AudioBaseProvider(ABC):
#     @abstractmethod
#     async def search(self, title: str, artist: str, duration_sec: int) :
#         raise NotImplementedError

#     @abstractmethod
#     async def download_yt_audio(self, video_url: str):
#         raise NotImplementedError

#     @abstractmethod
#     async def trim_audio_preview(self, url: str):
#         raise NotImplementedError


class LyricsBaseProvider(ABC):
    async def aclose(self) -> None:
        return None

    @abstractmethod
    async def get_lyric_url(self, title: str, artist: str) -> Optional[str]:
        raise NotImplementedError

    @abstractmethod
    async def scrape_lyrics(self, url: str) -> Tuple[Optional[str], Optional[str]]:
        raise NotImplementedError("scrape_lyrics is not supported for this provider")

    async def scrape_urls(self, urls: List[str]) -> Tuple[Optional[str], Optional[str]]:
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
                result = await crawler.arun_many(urls, config=config)

            if not result.success:  # type: ignore
                return None, str(result.error_message)  # type: ignore

            md = result.markdown  # type: ignore
            return md, None
        except Exception as e:
            return None, str(e)


    def normalize_text(self, text: str, keep_punctuation: bool = True) -> str:
        if not text:
            return ""

        # Normalize unicode (NFKC = compatibility composition)
        text = unicodedata.normalize("NFKC", text)

        # Lowercase
        text = text.lower()

        # Trim + collapse whitespace
        text = " ".join(text.split())

        # Optionally strip punctuation
        if not keep_punctuation:
            text = re.sub(r"[^\w\s]", "", text)

        # Transliterate (optional, e.g. Cyrillic → Latin)
        text = unidecode(text)

        # Standardize spacing around dots so acronyms like "m . a . a . d" become "m.a.a.d"
        # Only apply when punctuation is preserved.
        if keep_punctuation:
            # Remove spaces surrounding dots
            text = re.sub(r"\s*\.\s*", ".", text)
            # Collapse repeated dots (e.g. "..." -> ".")
            text = re.sub(r"\.{2,}", ".", text)
            # Trim stray spaces or dots at ends
            text = text.strip(". ")

        return text

    def clean_lyrics_markdown(self, md: str) -> str:
        """
        Cleans markdown lyrics fetched from sources (Genius, Musixmatch, etc.)
        - Removes contributor counts, translation notes, and descriptions
        - Normalizes section headers
        - Strips markdown formatting
        """
        lines = md.splitlines()
        cleaned_lines = []

        has_headers = any(
            re.match(r"^\[.*?\]$", line.strip()) or line.strip().startswith("### ")
            for line in lines
        )

        saw_section = not has_headers

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # --- Skip junk ---
            if re.match(r"^\d+\s+Contributors", line, re.I):
                continue
            if line.lower().startswith("translations"):
                continue
            if line.startswith("* "):  # translation bullet list
                continue
            if re.match(r"^## .*lyrics$", line, re.I):  # "## Song Title Lyrics"
                continue

            # --- Genius section headers like [Verse 1: Artist] ---
            if re.match(r"^\[.*?\]$", line):
                saw_section = True
                # Normalize to markdown header
                section = line.strip("[]").lower()
                cleaned_lines.append(f"### {section}")
                continue

            # --- Musixmatch section headers like ### verse ---
            if line.startswith("### "):
                saw_section = True
                section = line.replace("###", "").strip().lower()
                cleaned_lines.append(f"### {section}")
                continue

            # --- Remove inline markdown formatting ---
            line = re.sub(r"[_*`]", "", line)

            if saw_section:
                cleaned_lines.append(line)

        return "\n".join(cleaned_lines)
