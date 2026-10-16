import logging
import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from givehub.api import router
from givehub.community import router as community_router
from givehub.community_seed import seed_community
from givehub.config import get_settings
from givehub.database import Base, SessionLocal, engine, get_db
from givehub.governance import router as governance_router
from givehub.lifecycle import router as lifecycle_router
from givehub.schemas import ErrorDetail, ErrorEnvelope
from givehub.seed import seed_reference_data
from givehub.sharing import router as sharing_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("givehub")
settings = get_settings()


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    if not settings.is_production and get_db not in _app.dependency_overrides:
        Base.metadata.create_all(engine)
        with SessionLocal() as db:
            seed_reference_data(db)
            seed_community(db)
    yield


app = FastAPI(
    title="GiveHub API",
    version="0.1.0",
    description="Volunteer discovery and coordination for the Greater Toronto Area.",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(router)
app.include_router(governance_router)
app.include_router(lifecycle_router)
app.include_router(sharing_router)
app.include_router(community_router)


@app.middleware("http")
async def request_context(request: Request, call_next):  # type: ignore[no-untyped-def]
    request_id = request.headers.get("x-request-id", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["x-request-id"] = request_id
    logger.info(
        "request id=%s method=%s path=%s status=%s",
        request_id,
        request.method,
        request.url.path,
        response.status_code,
    )
    return response


@app.exception_handler(HTTPException)
async def http_error(_request: Request, exc: HTTPException) -> JSONResponse:
    envelope = ErrorEnvelope(
        error=ErrorDetail(
            code=f"http_{exc.status_code}",
            message=str(exc.detail),
        )
    )
    return JSONResponse(status_code=exc.status_code, content=envelope.model_dump(mode="json"))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/ready")
def ready() -> dict[str, str]:
    with engine.connect() as connection:
        connection.execute(text("SELECT 1"))
    return {"status": "ready"}
