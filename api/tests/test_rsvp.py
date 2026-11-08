from datetime import datetime, timedelta, timezone


def future_event(**overrides):
    start = datetime.now(timezone.utc) + timedelta(days=1)
    return {"title": "Picnic", "location": "Park", "capacity": 1,
            "starts_at": start.isoformat(), "ends_at": (start + timedelta(hours=2)).isoformat(),
            **overrides}


def test_rsvp_to_full_event_returns_409(client, auth):
    host, a, b = auth("host@x.com"), auth("a@x.com"), auth("b@x.com")
    event = client.post("/events", json=future_event(), headers=host).json()

    assert client.post(f"/events/{event['id']}/rsvp", headers=a).status_code == 201
    res = client.post(f"/events/{event['id']}/rsvp", headers=b)

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "event_full"


def test_rsvp_to_full_event_returns_409(client, auth, create_event):
    host, a, b = auth("host@example.com"), auth("a@example.com"), auth("b@example.com")
    event = create_event(host, capacity=1)

    assert client.post(f"/events/{event['id']}/rsvp", headers=a).status_code == 201
    res = client.post(f"/events/{event['id']}/rsvp", headers=b)

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "event_full"


def test_rsvp_twice_returns_409_already_going(client, auth, create_event):
    host, guest = auth("host@example.com"), auth("guest@example.com")
    event = create_event(host)
    assert client.post(f"/events/{event['id']}/rsvp", headers=guest).status_code == 201

    res = client.post(f"/events/{event['id']}/rsvp", headers=guest)

    assert res.status_code == 409
    assert res.json()["error"]["code"] == "already_going"
    assert client.get(f"/events/{event['id']}").json()["rsvp_count"] == 1