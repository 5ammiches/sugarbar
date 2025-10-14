from fastapi import APIRouter, HTTPException
from app.logger import NoResultsError, ProviderError, logger
from app.models import LyricSource, LyricResponse, LyricRequest
from app.genius import Genius
from app.musixmatch import Musixmatch
from app.config import get_settings

router = APIRouter()

def make_lyric_provider(
    source: LyricSource,
    settings
):
    if source == LyricSource.genius:
        return Genius(access_token=settings.genius_client_access_token)
    if source == LyricSource.musixmatch:
        return Musixmatch(musixmatch_profile_path=settings.musixmatch_profile_path)
    raise HTTPException(status_code=400, detail="Unsupported provider")

# TODO maybe try crawl4ai arun_many() for crawling multiple urls instead of one url per crawl
@router.post("/lyrics/{source}", response_model=LyricResponse)
async def get_lyrics(
    req: LyricRequest,
):
    settings = get_settings()
    client = make_lyric_provider(req.source, settings)
    provider_name = req.source.value

    try:
        url = await client.get_lyric_url(title=req.title, artist=req.artist)
        if not url:
            raise NoResultsError(
                f"No {provider_name} URL found for '{req.title}' by '{req.artist}'"
            )

        lyrics_md, err = await client.scrape_lyrics(url)
        if lyrics_md is None:
            raise NoResultsError(
                f"No lyrics found in {provider_name.capitalize()} URL: {url}"
                + (f" Error: {err}" if err else "")
            )

        cleaned_lyrics = client.clean_lyrics_markdown(lyrics_md)

        return LyricResponse(
            source=req.source,
            title=req.title,
            artist=req.artist,
            lyrics=cleaned_lyrics,
            url=url
        )

    except NoResultsError as e:
        logger.info(
            "%s: no results for %s - %s: %s", provider_name, req.title, req.artist, str(e)
        )
        raise HTTPException(status_code=404, detail=str(e))
    except ProviderError as e:
        logger.error(
            "%s provider error for %s - %s", provider_name, req.title, req.artist, exc_info=True
        )
        raise HTTPException(
            status_code=502, detail=f"{provider_name} provider error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Unexpected error (%s) for %s - %s", provider_name, req.title, req.artist
        )
        raise HTTPException(status_code=500, detail="Internal Server Error")
    finally:
        try:
            await client.aclose()
        except Exception:
            logger.exception("Error closing %s client", provider_name)
