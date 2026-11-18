import os
from datetime import datetime, timedelta, timezone

# Must be set before anything imports app.config
os.environ.setdefault("DATABASE_URL", "postgresql+psycopg://gather:gather@localhost:5432/gather_test")
os.environ.setdefault("JWT_SECRET", "test-secret")

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.db import Base, engine
from app.main import app

assert engine.url.database == "gather_test", "Tests must never run against a real database"


@pytest.fixture(scope="session", autouse=True)
def schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def clean_tables():
    yield
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE users, events, rsvps CASCADE"))


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth(client):
    """Register + log in a user; returns the Authorization header."""
    def make(email: str, password: str = "password123") -> dict:
        res = client.post("/auth/register", json={
            "email": email, "password": password, "display_name": email.split("@")[0],
        })
        assert res.status_code == 201, res.text
        res = client.post("/auth/login", json={"email": email, "password": password})
        assert res.status_code == 200, res.text
        return {"Authorization": f"Bearer {res.json()['access_token']}"}
    return make


def event_payload(**overrides) -> dict:
    """A valid event starting tomorrow. Override any field."""
    start = datetime.now(timezone.utc) + timedelta(days=1)
    return {
        "title": "Picnic", "location": "Park", "capacity": 10,
        "starts_at": start.isoformat(),
        "ends_at": (start + timedelta(hours=2)).isoformat(),
        **overrides,
    }


@pytest.fixture
def payload():
    return event_payload


@pytest.fixture
def create_event(client):
    """POST an event as `headers`; returns the created event JSON."""
    def make(headers: dict, **overrides) -> dict:
        res = client.post("/events", json=event_payload(**overrides), headers=headers)
        assert res.status_code == 201, res.text
        return res.json()
    return make