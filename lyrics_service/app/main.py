from enum import Enum
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse

from app.config import Settings
from app.genius import Genius
from app.musixmatch import Musixmatch


class LyricSource(str, Enum):
    genius = "genius"
    musixmatch = "musixmatch"


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@lru_cache
def get_settings() -> Settings:
    return Settings()  # type: ignore[call-arg]


# TODO handle for multiple artists
@app.get("/lyrics/{source}", response_class=ORJSONResponse)
async def get_lyrics(
    source: LyricSource,
    title: Annotated[str, Query(..., description="Track title")],
    artist: Annotated[str, Query(..., description="Artist name")],
    settings: Annotated[Settings, Depends(get_settings)],
):
    if source is LyricSource.genius:
        client = Genius(access_token=settings.genius_client_access_token)
        try:
            url = await client.get_lyric_url(title=title, artist=artist)
            if url is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No Genius URL found for '{title}' by '{artist}'",
                )

            lyrics_md, err = await client.scrape_lyrics(url)
            if lyrics_md is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No lyrics found in Genius URL: {url} Error: {err}",
                )

            cleaned_lyrics = client.clean_lyrics_markdown(lyrics_md)

            return {
                "provider": "genius",
                "title": title,
                "artist": artist,
                "lyrics": cleaned_lyrics
                if cleaned_lyrics != ""
                else "No lyrics found in Genius",
                "url": url,
            }

        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error while fetching lyrics: {str(e)}",
            )
        finally:
            await client.aclose()

    elif source is LyricSource.musixmatch:
        client = Musixmatch(musixmatch_profile_path=settings.musixmatch_profile_path)
        try:
            url = await client.get_lyric_url(title=title, artist=artist)
            if url is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No Musixmatch URL found for '{title}' by '{artist}'",
                )

            lyrics_md, err = await client.scrape_lyrics(url)
            if lyrics_md is None:
                raise HTTPException(
                    status_code=404,
                    detail=f"No lyrics found in Musixmatch URL: {url} Error: {err}",
                )

            cleaned_lyrics = client.clean_lyrics_markdown(lyrics_md)

            return {
                "provider": "musixmatch",
                "title": title,
                "artist": artist,
                "lyrics": cleaned_lyrics
                if cleaned_lyrics != ""
                else "No lyrics found in Musixmatch",
                "url": url,
            }
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Unexpected error while fetching lyrics: {str(e)}",
            )
