# Gather

[![CI](https://github.com/<your-username>/gather/actions/workflows/ci.yml/badge.svg)](https://github.com/<your-username>/gather/actions/workflows/ci.yml)

A small community events board: people sign up, post events, and RSVP to each other's.
Full-stack practice project covering relational schema design, migrations, REST API design,
password auth, ownership rules, and a React frontend that handles loading, errors and forms properly.

**Live:** [gather web](https://your-app.vercel.app) · [API docs](https://your-api.onrender.com/docs)

> The API runs on Render's free tier and sleeps when idle, so the first request can take ~50 seconds.

![Gather event list](docs/screenshot.png)

## Architecture

```mermaid
flowchart LR
  Browser -->|loads app| Web[React on Vercel]
  Browser -->|HTTPS + JWT| API[FastAPI on Render]
  API --> DB[(Postgres on Neon)]
```

| Layer    | Stack                                                           |
| -------- | --------------------------------------------------------------- |
| Database | PostgreSQL 16, SQLAlchemy 2.0, Alembic                          |
| API      | FastAPI, Pydantic v2, JWT (PyJWT), Argon2 (pwdlib)              |
| Web      | React, Vite, TypeScript, Tailwind CSS, React Router             |
| Ops      | Docker Compose (local DB), GitHub Actions, Render, Vercel, Neon |

## Run it locally

Needs Python 3.12, Node 22 and Docker.

```bash
docker compose up -d
docker compose exec db createdb -U gather gather_test   # first time only, for tests

cd api
python -m venv .venv
source .venv/bin/activate          # Windows Git Bash: source .venv/Scripts/activate
pip install -r requirements-dev.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
fastapi dev app/main.py            # http://localhost:8000/docs
```

In a second terminal:

```bash
cd web
npm install
cp .env.example .env
npm run dev                        # http://localhost:5173
```

Seeded accounts (local only): `amira@example.com`, `ben@example.com`, `chen@example.com`, password `password123`.

## Environment variables

| Name           | Used by | Example                                                    | Secret?                                   |
| -------------- | ------- | ---------------------------------------------------------- | ----------------------------------------- |
| `DATABASE_URL` | api     | `postgresql+psycopg://gather:gather@localhost:5432/gather` | Yes                                       |
| `JWT_SECRET`   | api     | any long random string                                     | Yes                                       |
| `CORS_ORIGINS` | api     | `["http://localhost:5173"]` (JSON list)                    | No                                        |
| `VITE_API_URL` | web     | `http://localhost:8000`                                    | No: it's built into the public JavaScript |

## Tests

```bash
cd api && pytest -q            # runs against the gather_test database
cd web && npm test -- --run
```

CI runs both suites on every pull request, against a fresh Postgres service. It also checks
that all migrations apply and roll back cleanly, and that `alembic check` finds no model
changes missing a migration. `main` is protected, so a red build can't be merged.

## API overview

Full interactive docs at `/docs`. Errors always have one shape:
`{"error": {"code": "event_full", "message": "..."}}`, and validation errors add a `fields` map.

| Method         | Path                                 | Auth     |
| -------------- | ------------------------------------ | -------- |
| POST           | `/auth/register`, `/auth/login`      | —        |
| GET            | `/auth/me`                           | user     |
| GET            | `/events`, `/events/{id}`            | optional |
| POST           | `/events`                            | user     |
| PATCH / DELETE | `/events/{id}`                       | owner    |
| POST / DELETE  | `/events/{id}/rsvp`                  | user     |
| GET            | `/me/events?role=hosting\|attending` | user     |

## Decisions

- **FastAPI over Django.** I wanted to write the auth, validation and query layers myself
  rather than get them from a framework, while staying in Python.
- **Row locking for RSVPs.** `SELECT ... FOR UPDATE` on the event row makes concurrent RSVPs
  queue, so two people can't both take the last place. I tested this by firing parallel
  requests with and without the lock.
- **Constraints live in the database.** Unique email, `ends_at > starts_at`, positive capacity
  and cascading deletes are enforced by Postgres, not just Pydantic, so no script or bug can bypass them.
- **Short-lived access tokens (15 minutes).** A leaked token is only useful briefly. Tokens are
  signed, not encrypted, so they hold only the user id.
- **No user enumeration.** Wrong password and unknown email return the identical 401, and the
  unknown-email path still runs a dummy hash so response times match.
- **Migrations run on deploy and stay backward compatible.** Render runs `alembic upgrade head`
  before starting the server. New columns are added as nullable; renames and drops happen in a later deploy.
- **React + Vite rather than Next.js.** Doing routing, data fetching and auth state by hand,
  including aborting stale search requests and keeping filters in the URL.

## What I'd do next

- Refresh tokens in an httpOnly cookie, with rotation
- Put web and API on one domain, so cookies aren't treated as third-party
