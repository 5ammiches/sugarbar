from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class LyricSource(str, Enum):
    genius = "genius"
    musixmatch = "musixmatch"

class LyricRequest(BaseModel):
    source: LyricSource
    title: str = Field(..., description="Track title")
    artist: str = Field(..., description="Artist name")

class LyricResponse(BaseModel):
    source: LyricSource
    title: str
    artist: str
    lyrics: Optional[str]
    url: Optional[str]

class AudioSource(str, Enum):
    youtube = "youtube"

class SearchRequest(BaseModel):
    title: str = Field(..., description="Track title")
    artist: str = Field(..., description="Artist name")
    durationSec: int

class SearchResultItem(BaseModel):
    videoId: str
    title: str
    durationSec: int
    url: str
    category: str

class SearchResponse(BaseModel):
    items: List[SearchResultItem]

class PreviewRequest(BaseModel):
    trackId: str
    candidates: List[SearchResultItem]
    previewStartSec: float = 30.0
    previewLenSec: float = Field(60, ge=5, le=90)
    bitrateKbps: int = 160
