import uuid
from datetime import datetime, timedelta, timezone


def test_create_event_without_token_returns_401(client, payload):
    res = client.post("/events", json=payload())

    assert res.status_code == 401
    assert res.json()["error"]["code"] == "not_authenticated"
    assert client.get("/events").json()["total"] == 0  # nothing was created


def test_editing_someone_elses_event_returns_403(client, auth, create_event):
    host, stranger = auth("host@example.com"), auth("stranger@example.com")
    event = create_event(host, title="Picnic")

    res = client.patch(f"/events/{event['id']}", json={"title": "Hijacked"}, headers=stranger)

    assert res.status_code == 403
    assert res.json()["error"]["code"] == "not_owner"
    assert client.get(f"/events/{event['id']}").json()["title"] == "Picnic"  # unchanged


def test_deleting_unknown_event_returns_404(client, auth):
    host = auth("host@example.com")

    res = client.delete(f"/events/{uuid.uuid4()}", headers=host)

    assert res.status_code == 404
    assert res.json()["error"]["code"] == "event_not_found"


def test_lowering_capacity_below_rsvps_returns_409(client, auth, create_event):
    host, a, b = auth("host@example.com"), auth("a@example.com"), auth("b@example.com")
    event = create_event(host, capacity=2)
    for guest in (a, b):
        assert client.post(f"/events/{event['id']}/rsvp", headers=guest).status_code == 201

    res = client.patch(f"/events/{event['id']}", json={"capacity": 1}, headers=host)

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "capacity_below_rsvps"
    assert client.get(f"/events/{event['id']}").json()["capacity"] == 2  # unchanged


def test_ends_before_starts_returns_422_with_form_error(client, auth, payload):
    host = auth("host@example.com")
    body = payload()
    body["starts_at"], body["ends_at"] = body["ends_at"], body["starts_at"]  # swap them

    res = client.post("/events", json=body, headers=host)

    assert res.status_code == 422
    error = res.json()["error"]
    assert error["code"] == "validation_error"
    assert "_form" in error["fields"]


def test_pagination_returns_last_partial_page(client, auth, create_event):
    host = auth("host@example.com")
    base = datetime.now(timezone.utc) + timedelta(days=1)
    for i in range(25):
        start = base + timedelta(hours=i)
        create_event(host, title=f"Event {i:02d}",
                     starts_at=start.isoformat(),
                     ends_at=(start + timedelta(hours=1)).isoformat())

    res = client.get("/events", params={"limit": 10, "offset": 20})

    assert res.status_code == 200
    page = res.json()
    assert page["total"] == 25
    assert [e["title"] for e in page["items"]] == [f"Event {i:02d}" for i in range(20, 25)]