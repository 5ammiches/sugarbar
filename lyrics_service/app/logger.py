import logging

from fastapi import Request
from fastapi.responses import ORJSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("lyrics")


def setup_logging_and_handlers(app):
    logger = logging.getLogger("lyrics")
    logger.setLevel(logging.INFO)
    if not logger.handlers:
        _h = logging.StreamHandler()
        _h.setFormatter(
            logging.Formatter("%(asctime)s %(levelname)s %(name)s: %(message)s")
        )
        logger.addHandler(_h)

    @app.exception_handler(StarletteHTTPException)
    async def http_exc_handler(request: Request, exc: StarletteHTTPException):
        level = logging.WARNING if exc.status_code < 500 else logging.ERROR
        logger.log(
            level,
            "HTTP %s on %s %s: %s",
            exc.status_code,
            request.method,
            request.url,
            exc.detail,
        )
        return ORJSONResponse(
            status_code=exc.status_code, content={"detail": exc.detail}
        )

    @app.exception_handler(Exception)
    async def unhandled_exc_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception on %s %s", request.method, request.url)
        return ORJSONResponse(
            status_code=500, content={"detail": "Internal Server Error"}
        )


class NoResultsError(Exception):
    pass


class ProviderError(Exception):
    pass
