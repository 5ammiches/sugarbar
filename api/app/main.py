from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import lyrics, youtube
from app.utils.config import get_settings
from app.utils.logger import setup_logging_and_handlers


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = get_settings()
    yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)
setup_logging_and_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lyrics.router, prefix="/api", tags=["lyrics"])
app.include_router(youtube.router, prefix="/api", tags=["youtube"])


@app.get("/")
async def root():
    settings = get_settings()
    print(f"COOKIES PATH: {settings.youtube_cookies_path}")
    return {"message": "Music API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
