from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import APIKeyHeader

from app.routers import lyrics, youtube
from app.utils.config import get_settings
from app.utils.logger import logger, setup_logging_and_handlers

# Was used for API auth but wont be necessary since the api is behind Cloudflare Access and these auth headers are consumed at the edge
# cf_client_id_scheme = APIKeyHeader(
#     name="CF-Access-Client-Id", auto_error=False, scheme_name="cfClientId"
# )
# cf_client_secret_scheme = APIKeyHeader(
#     name="CF-Access-Client-Secret", auto_error=False, scheme_name="cfClientSecret"
# )


# def require_cf_credentials(
#     client_id: str | None = Depends(cf_client_id_scheme),
#     client_secret: str | None = Depends(cf_client_secret_scheme),
# ):
#     settings = get_settings()
#     if not settings.cf_client_id or not settings.cf_client_secret:
#         return
#     if client_id != settings.cf_client_id or client_secret != settings.cf_client_secret:
#         raise HTTPException(status_code=401, detail="Unauthorized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.settings = get_settings()
    yield


app = FastAPI(
    lifespan=lifespan,
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
    # dependencies=[Depends(require_cf_credentials)],
)
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
    return {"message": "Music API is running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
