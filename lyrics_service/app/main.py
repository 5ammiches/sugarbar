from enum import Enum
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.config import Settings
from app.genius import Genius
from app.logger import NoResultsError, ProviderError, logger, setup_logging_and_handlers
from app.musixmatch import Musixmatch


class LyricSource(str, Enum):
    genius = "genius"
    musixmatch = "musixmatch"


app = FastAPI()
setup_logging_and_handlers(app)


@lru_cache
def get_settings() -> Settings:
    return Settings()


def make_provider(
    source: LyricSource,
    settings: Annotated[Settings, Depends(get_settings)],
):
    if source == LyricSource.genius:
        return Genius(access_token=settings.genius_client_access_token)
    if source == LyricSource.musixmatch:
        return Musixmatch(musixmatch_profile_path=settings.musixmatch_profile_path)
    raise HTTPException(status_code=400, detail="Unsupported provider")


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# TODO use arun_many() for crawling multiple urls instead of 1 crawl right now
#
@app.get("/lyrics/{source}", response_class=ORJSONResponse)
async def get_lyrics(
    source: LyricSource,
    title: Annotated[str, Query(..., description="Track title")],
    artist: Annotated[str, Query(..., description="Artist name")],
    settings: Annotated[Settings, Depends(get_settings)],
):
    client = make_provider(source, settings)
    provider_name = source.value

    try:
        url = await client.get_lyric_url(title=title, artist=artist)
        if not url:
            raise NoResultsError(
                f"No {provider_name} URL found for '{title}' by '{artist}'"
            )

        lyrics_md, err = await client.scrape_lyrics(url)
        if lyrics_md is None:
            raise NoResultsError(
                f"No lyrics found in {provider_name.capitalize()} URL: {url}"
                + (f" Error: {err}" if err else "")
            )

        cleaned_lyrics = client.clean_lyrics_markdown(lyrics_md)

        return {
            "source": provider_name,
            "title": title,
            "artist": artist,
            "lyrics": cleaned_lyrics,
            "url": url,
        }

    except NoResultsError as e:
        logger.info(
            "%s: no results for %s - %s: %s", provider_name, title, artist, str(e)
        )
        raise HTTPException(status_code=404, detail=str(e))
    except ProviderError as e:
        logger.error(
            "%s provider error for %s - %s", provider_name, title, artist, exc_info=True
        )
        raise HTTPException(
            status_code=502, detail=f"{provider_name} provider error: {str(e)}"
        )
    except HTTPException:
        raise
    except Exception:
        logger.exception(
            "Unexpected error (%s) for %s - %s", provider_name, title, artist
        )
        raise HTTPException(status_code=500, detail="Internal Server Error")
    finally:
        try:
            await client.aclose()
        except Exception:
            logger.exception("Error closing %s client", provider_name)
