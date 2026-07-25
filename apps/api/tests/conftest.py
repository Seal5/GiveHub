import uuid
from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from givehub.auth import Identity, current_identity
from givehub.database import Base, get_db
from givehub.main import app
from givehub.seed import DEMO_VOLUNTEER_ID, seed_reference_data

engine = create_engine(
    "sqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSession = sessionmaker(bind=engine, expire_on_commit=False)


@pytest.fixture(autouse=True)
def database() -> Generator[None, None, None]:
    Base.metadata.create_all(engine)
    with TestingSession() as session:
        seed_reference_data(session)
    yield
    Base.metadata.drop_all(engine)


@pytest.fixture
def db() -> Generator[Session, None, None]:
    with TestingSession() as session:
        yield session


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    def override_db() -> Generator[Session, None, None]:
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_db] = override_db
    app.dependency_overrides[current_identity] = lambda: Identity(DEMO_VOLUNTEER_ID, None)
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture
def identity_override():
    def set_identity(user_id: uuid.UUID) -> None:
        app.dependency_overrides[current_identity] = lambda: Identity(user_id, None)

    return set_identity

