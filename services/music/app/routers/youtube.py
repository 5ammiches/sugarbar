import io
import os
import shutil
import tempfile

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from yt_dlp import YoutubeDL

from app.config import get_settings
from app.logger import NoResultsError, ProviderError, logger
from app.models import PreviewRequest, SearchRequest, SearchResponse, SearchResultItem
from app.youtube import Youtube, YoutubeScraper

router = APIRouter()

# def make_audio_provider(
#     source: AudioSource,
#     settings: Annotated[Settings, Depends(get_settings)]
# ):
#     if source == AudioSource.youtube:
#         return Youtube(api_key=settings.youtube_api_key)


@router.post("/youtube/search", response_model=SearchResponse)
async def youtube_search(
    req: SearchRequest,
):
    settings = get_settings()
    client = Youtube(api_key=settings.youtube_api_key)

    try:
        candidates = await client.search(
            title=req.title, artist=req.artist, duration_sec=req.durationSec
        )

        items = [SearchResultItem(**c) for c in candidates]
        return SearchResponse(items=items)

    except NoResultsError as e:
        logger.info(
            "Youtube: no results for %s - %s: %s", req.title, req.artist, str(e)
        )
        raise HTTPException(status_code=404, detail=str(e))
    except ProviderError as e:
        logger.error(
            "Youtube provider error for %s - %s", req.title, req.artist, exc_info=True
        )
        raise HTTPException(status_code=502, detail=f"Youtube provider error: {str(e)}")
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Unexpected error (Youtube) for %s - %s", req.title, req.artist
        )
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/youtube/preview")
async def youtube_preview(
    req: PreviewRequest,
):
    if not req.candidateUrls:
        raise HTTPException(status_code=400, detail="candidateUrls required")

    settings = get_settings()
    client = Youtube(api_key=settings.youtube_api_key)

    last_err = None
    for url in req.candidateUrls:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                src = client.dl_best_audio(url, tmp)
                out = os.path.join(tmp, "preview.m4a")
                client.cut_to_m4a(
                    src=src,
                    dst=out,
                    start=req.previewStartSec,
                    dur=req.previewLenSec,
                    bitrate_kbps=req.bitrateKbps,
                )

                headers = {
                    "Content-Type": "audio/mp4",
                    "X-Preview-Duration": str(req.previewLenSec),
                    "X-Codec": "aac",
                    "X-Bitrate-Kbps": str(req.bitrateKbps),
                    "X-Source-Url": url,
                }

                with open(out, "rb") as f:
                    data = f.read()
                shutil.rmtree(tmp, ignore_errors=True)

                return StreamingResponse(
                    io.BytesIO(data), media_type="audio/mp4", headers=headers
                )
        except ProviderError as e:
            last_err = e
            continue

        except Exception as e:
            last_err = e
            continue

    raise HTTPException(status_code=502, detail=f"All candidates failed: {last_err}")


@router.post("/youtube/search-scrape", response_model=SearchResponse)
async def youtube_search_scrape(
    req: SearchRequest,
):
    """Search YouTube using manual scraping (no API limits)"""
    scraper = YoutubeScraper()

    try:
        candidates = await scraper.search_scrape(
            title=req.title, artist=req.artist, duration_sec=req.durationSec
        )

        items = [SearchResultItem(**c) for c in candidates]
        return SearchResponse(items=items)

    except NoResultsError as e:
        logger.info(
            "Youtube scraping: no results for %s - %s: %s",
            req.title,
            req.artist,
            str(e),
        )
        raise HTTPException(status_code=404, detail=str(e))
    except ProviderError as e:
        logger.error(
            "Youtube scraping provider error for %s - %s",
            req.title,
            req.artist,
            exc_info=True,
        )
        raise HTTPException(
            status_code=502, detail=f"Youtube scraping provider error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Unexpected error (Youtube scraping) for %s - %s", req.title, req.artist
        )
        raise HTTPException(status_code=500, detail="Internal Server Error")


@router.post("/youtube/preview-scrape")
async def youtube_preview_scrape(
    req: PreviewRequest,
):
    """Generate preview using scraping-based search and yt-dlp download"""
    if not req.candidateUrls:
        raise HTTPException(status_code=400, detail="candidateUrls required")

    scraper = YoutubeScraper()

    last_err = None
    for url in req.candidateUrls:
        try:
            with tempfile.TemporaryDirectory() as tmp:
                # TODO abstract the download of the video url into the YoutubeScraper class
                out_tmpl = os.path.join(tmp, "%(id)s.%(ext)s")
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

                with YoutubeDL(ydl_opts) as ydl:  # type: ignore
                    rc = ydl.download([url])
                    if rc != 0:
                        raise RuntimeError("yt-dlp failed")

                files = [
                    f
                    for f in os.listdir(tmp)
                    if not f.endswith(".part") and not f.endswith(".info.json")
                ]
                if not files:
                    raise RuntimeError("No file produced")

                files.sort(key=lambda f: os.path.getmtime(os.path.join(tmp, f)))
                src = os.path.join(tmp, files[-1])

                out = os.path.join(tmp, "preview.m4a")
                scraper.cut_to_m4a(
                    src=src,
                    dst=out,
                    start=req.previewStartSec,
                    dur=req.previewLenSec,
                    bitrate_kbps=req.bitrateKbps,
                )

                headers = {
                    "Content-Type": "audio/mp4",
                    "X-Preview-Duration": str(req.previewLenSec),
                    "X-Codec": "aac",
                    "X-Bitrate-Kbps": str(req.bitrateKbps),
                    "X-Source-Url": url,
                    "X-Method": "scraping",
                }

                with open(out, "rb") as f:
                    data = f.read()
                shutil.rmtree(tmp, ignore_errors=True)

                return StreamingResponse(
                    io.BytesIO(data), media_type="audio/mp4", headers=headers
                )
        except ProviderError as e:
            last_err = e
            continue
        except Exception as e:
            last_err = e
            continue

    raise HTTPException(status_code=502, detail=f"All candidates failed: {last_err}")
