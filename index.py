from contextlib import asynccontextmanager

from backend.routers import lyrics, youtube
from backend.utils.config import get_settings
from backend.utils.logger import setup_logging_and_handlers
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = get_settings()
    yield

app = FastAPI(lifespan=lifespan)
setup_logging_and_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(lyrics.router, tags=["lyrics"])
app.include_router(youtube.router, tags=["youtube"])

@app.get("/")
async def root():
    return {"message": "Music API is running"}

@app.get("/health")
async def health():
    return {"status": "healthy"}
