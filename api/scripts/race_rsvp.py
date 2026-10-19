"""Fire two simultaneous RSVPs at a capacity-1 event, many times, and report oversells"""

import threading
from datetime import datetime, timezone, timedelta

import httpx

API = "http://localhost:8000"
ROUNDS = 20


def auth(email: str) -> dict:
    r = httpx.post(
        f"{API}/auth/login", json={"email": email, "password": "password123"}
    )
    r.raise_for_status()
    return {"Authorization": f"Bearer {r.json()['access_token']}"}


def main() -> None:
    host, a, b = (
        auth("chen@example.com"),
        auth("amira@example.com"),
        auth("ben@example.com"),
    )
    oversold = 0

    for i in range(ROUNDS):
        start = datetime.now(timezone.utc) + timedelta(days=1)
        event = httpx.post(
            f"{API}/events",
            headers=host,
            json={
                "title": f"Race test {i}",
                "location": "Nowhere",
                "capacity": 1,
                "starts_at": start.isoformat(),
                "ends_at": (start + timedelta(hours=1)).isoformat(),
            },
        ).json()

        results: list[int] = []
        barrier = threading.Barrier(2)  # both threads release at the same moment

        def rsvp(headers: dict) -> None:
            with httpx.Client() as client:
                barrier.wait()
                results.append(
                    client.post(
                        f"{API}/events/{event['id']}/rsvp", headers=headers
                    ).status_code
                )

        threads = [threading.Thread(target=rsvp, args=(h,)) for h in (a, b)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        if results.count(201) > 1:
            oversold += 1
        print(
            f"round {i:2}: {sorted(results)} {'OVERSOLD' if results.count(201) > 1 else 'ok'}"
        )

        httpx.delete(f"{API}/events/{event['id']}", headers=host)  # tidy up

    print(f"\n{oversold} of {ROUNDS} rounds oversold")


if __name__ == "__main__":
    main()
