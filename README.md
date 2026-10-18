# Gather

A small community events board: people sign up, post events, and RSVP to each other's.

Gather is a full-stack practice build covering relational schema design, migrations, REST API design, password authentication, ownership rules, and a React frontend that handles loading, errors and forms properly.

**Live:** [web](https://gather-three-gilt.vercel.app/) · [API docs](https://gather-1qn0.onrender.com/docs)

## Status

| Milestone    | Scope                                                            | Status  |
| ------------ | ---------------------------------------------------------------- | ------- |
| 1. Skeleton  | Repo, Docker Postgres, FastAPI `/health`, React app, deploys     | ✅ Done |
| 2. Database  | Models, constraints, Alembic migrations, seed data, practice SQL | ✅ Done |
| 3. REST API  | Events CRUD, search, pagination, error format                    | ✅ Done |
| 4. Auth      | Register, login, JWT, ownership rules, RSVPs                     | ✅ Done |
| 5. Frontend  | Event list, detail, forms, auth flow                             | ⏳ Next |
| 6. Hardening | Tests, CI, automatic migrations on deploy                        | ⏳      |

## Architecture

```mermaid
flowchart LR
  Browser -->|loads static files| Web[React + Vite on Vercel]
  Browser -->|HTTPS JSON requests| API[FastAPI on Render]
  API -->|SQL over TLS| DB[(PostgreSQL on Neon)]
```

- **Vercel** serves the built frontend as static files. No application code runs there.
- **Render** runs the FastAPI app and holds all secrets. It is the only service that connects to the database.
- **Neon** hosts PostgreSQL. The browser never connects to it directly.

The browser calls the API directly from a different origin, so the API only accepts requests from origins listed in `CORS_ORIGINS`.

## Tech stack

| Layer                | Tools                                                              |
| -------------------- | ------------------------------------------------------------------ |
| Database             | PostgreSQL 16, SQLAlchemy 2.0, Alembic                             |
| API                  | Python 3.12, FastAPI, Pydantic, pydantic-settings, pwdlib (Argon2), PyJWT |
| Web                  | React, TypeScript, Vite, Tailwind CSS                              |
| Local infrastructure | Docker Compose                                                     |
| Hosting              | Vercel (web), Render (API), Neon (database)                        |

## Data model

```mermaid
erDiagram
  USERS ||--o{ EVENTS : hosts
  USERS ||--o{ RSVPS : makes
  EVENTS ||--o{ RSVPS : receives

  USERS {
    uuid id PK
    text email UK
    text password_hash
    text display_name
    timestamptz created_at
    timestamptz updated_at
  }
  EVENTS {
    uuid id PK
    uuid owner_id FK
    text title
    text description
    text location
    timestamptz starts_at
    timestamptz ends_at
    int capacity
    timestamptz created_at
    timestamptz updated_at
  }
  RSVPS {
    uuid user_id PK, FK
    uuid event_id PK, FK
    timestamptz created_at
    timestamptz updated_at
  }
```

Rules enforced by the database itself, not only in application code:

- Email addresses are unique.
- A user can RSVP to an event at most once (composite primary key on `rsvps`).
- Deleting a user deletes their events and RSVPs; deleting an event deletes its RSVPs (`ON DELETE CASCADE`).
- Titles are 3–120 characters, events end after they start, and capacity is greater than zero (check constraints).
- `events.starts_at` is indexed for upcoming-event queries.

## API

Full interactive docs are served at `/docs`. [`api/requests.http`](api/requests.http) has ready-to-run example requests for the VS Code REST Client or JetBrains HTTP client.

### Authentication

Log in to get a bearer token, then send it with every request that needs one:

```
Authorization: Bearer <access_token>
```

Tokens are signed JWTs (HS256) that expire after 15 minutes. In `/docs`, click **Authorize** and paste the token to try protected endpoints.

| Method | Path             | Auth | Description                                                         | Success      |
| ------ | ---------------- | ---- | ------------------------------------------------------------------- | ------------ |
| `POST` | `/auth/register` | —    | Create an account; email is stored lowercased                       | 201 user     |
| `POST` | `/auth/login`    | —    | Exchange email and password for an access token                     | 200 token    |
| `GET`  | `/auth/me`       | Yes  | The current user                                                    | 200 user     |

Passwords must be 8–128 characters. User responses never include the password hash.

### Events

| Method   | Path                | Auth     | Description                                                                 | Success |
| -------- | ------------------- | -------- | --------------------------------------------------------------------------- | ------- |
| `GET`    | `/events`           | —        | List events with RSVP counts, ordered by start time                         | 200     |
| `GET`    | `/events/{id}`      | Optional | One event with its RSVP count; `i_am_going` is set when a token is sent     | 200     |
| `POST`   | `/events`           | Yes      | Create an event owned by the current user; `Location` header points at it   | 201     |
| `PATCH`  | `/events/{id}`      | Host     | Update only the fields sent                                                 | 200     |
| `DELETE` | `/events/{id}`      | Host     | Delete an event and its RSVPs                                               | 204     |
| `POST`   | `/events/{id}/rsvp` | Yes      | RSVP to an event                                                            | 201     |
| `DELETE` | `/events/{id}/rsvp` | Yes      | Cancel your RSVP                                                            | 204     |
| `GET`    | `/me/events`        | Yes      | Events you host (`?role=hosting`, the default) or attend (`?role=attending`) | 200     |

"Host" means the user who created the event; anyone else gets 403.

`GET /events` accepts these query parameters:

| Parameter | Default | Description                                                     |
| --------- | ------- | --------------------------------------------------------------- |
| `q`       | —       | Case-insensitive search in title and location                   |
| `from`    | —       | Only events starting at or after this time (ISO 8601)           |
| `limit`   | `20`    | Page size, 1–50                                                 |
| `offset`  | `0`     | Number of events to skip                                        |

It returns a page:

```json
{ "items": [ { "id": "…", "title": "Board games night", "rsvp_count": 12, "i_am_going": false, "…": "…" } ], "total": 42, "limit": 20, "offset": 0 }
```

Validation rules for create and update: the title is 3–120 characters, the location is 1–200 characters, capacity is 1–10,000, and `starts_at` and `ends_at` must include a timezone, with the end after the start. `PATCH` checks the end-after-start rule against the event's values after the update is applied, and rejects `null` for any field except `description`.

### RSVP and capacity rules

- You can't RSVP to an event that has already started, that you're already going to, or that is full.
- A host can't lower an event's capacity below the number of people already going.
- Both checks lock the event's row (`SELECT … FOR UPDATE`) for the rest of the transaction, so simultaneous requests are handled one at a time and an event can never be oversold. [`api/scripts/race_rsvp.py`](api/scripts/race_rsvp.py) fires concurrent RSVPs at capacity-1 events to verify this.

### Errors

Every error uses the same shape:

```json
{ "error": { "code": "validation_error", "message": "Some fields are invalid.", "fields": { "title": "String should have at least 3 characters" } } }
```

| Status | `code`                 | When                                                                                                |
| ------ | ---------------------- | --------------------------------------------------------------------------------------------------- |
| 401    | `bad_credentials`      | Login failed; the same response for an unknown email and a wrong password                           |
| 401    | `not_authenticated`    | The endpoint needs a token and none was sent                                                         |
| 401    | `token_expired`        | The token has expired; log in again                                                                  |
| 401    | `invalid_token`        | The token is malformed, tampered with, or its user no longer exists                                  |
| 403    | `not_owner`            | Only the event's host can change or delete it                                                        |
| 404    | `event_not_found`      | No event has that id                                                                                 |
| 404    | `not_going`            | Cancelling an RSVP you don't have                                                                    |
| 409    | `email_taken`          | An account with that email already exists                                                            |
| 409    | `event_started`        | RSVP to an event that has already started                                                            |
| 409    | `already_going`        | RSVP to an event you're already going to                                                             |
| 409    | `event_full`           | RSVP to a full event                                                                                 |
| 409    | `capacity_below_rsvps` | Lowering capacity below the number of people going                                                   |
| 409    | `conflict`             | The change breaks a database constraint                                                              |
| 422    | `validation_error`     | The request is invalid; `fields` maps each invalid field to its message, and `_form` holds errors that involve several fields |

All 401 responses include a `WWW-Authenticate: Bearer` header.

## Repository layout

```
gather/
├─ docker-compose.yml        # local PostgreSQL 16
├─ api/
│  ├─ app/
│  │  ├─ main.py             # FastAPI app, CORS, routers, error handlers, /health
│  │  ├─ config.py           # settings loaded from environment
│  │  ├─ db.py               # engine, session factory, Base
│  │  ├─ deps.py             # database session and current-user dependencies
│  │  ├─ errors.py           # AppError and the shared error response format
│  │  ├─ models.py           # User, Event, RSVP
│  │  ├─ schemas.py          # Pydantic request and response models
│  │  ├─ routers/
│  │  │  ├─ auth.py          # /auth endpoints
│  │  │  ├─ events.py        # /events and RSVP endpoints
│  │  │  └─ me.py            # /me/events
│  │  ├─ security.py         # Argon2 password hashing and JWT creation
│  │  └─ seed.py             # local-only seed data
│  ├─ migrations/            # Alembic environment and versions
│  ├─ scripts/race_rsvp.py   # concurrency check for RSVPs (needs the API running)
│  ├─ sql/practice.sql       # hand-written practice queries
│  ├─ requests.http          # example API requests
│  ├─ alembic.ini
│  ├─ requirements.txt
│  └─ .env.example
└─ web/
   ├─ src/                   # React app
   ├─ vercel.json            # SPA rewrite
   └─ .env.example
```

## Local setup

### Prerequisites

Python 3.12, Node 22 LTS, Docker Desktop and Git.

The commands below are for Git Bash, WSL, macOS or Linux. In PowerShell, activate the virtual environment with `.venv\Scripts\Activate.ps1`.

### 1. Start the database

```bash
docker compose up -d
```

### 2. Run the API

```bash
cd api
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head
python -m app.seed
fastapi dev app/main.py
```

The API runs at http://localhost:8000, with interactive docs at http://localhost:8000/docs.

### 3. Run the web app

In a new terminal:

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

The app runs at http://localhost:5173 and should show **API: ok**.

### Seeded accounts

| Email             | Password    |
| ----------------- | ----------- |
| amira@example.com | password123 |
| ben@example.com   | password123 |
| chen@example.com  | password123 |

These exist only in the local database. Log in with any of them to get a token for testing.

## Environment variables

### API (`api/.env`)

| Variable       | Example                                                    | Secret | Notes                                                                                                     |
| -------------- | ---------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | `postgresql+psycopg://gather:gather@localhost:5432/gather` | Yes    | In production, the Neon connection string with the `postgresql+psycopg://` prefix and `?sslmode=require`. |
| `JWT_SECRET`   | `change-me`                                                | Yes    | Signs access tokens. Production needs a random value of at least 32 bytes: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it logs everyone out. |
| `CORS_ORIGINS` | `["http://localhost:5173"]`                                | No     | JSON list of allowed frontend origins, no trailing slashes. Defaults to `["http://localhost:5173"]`.      |

### Web (`web/.env`)

| Variable       | Example                 | Secret | Notes                                                                                                                                           |
| -------------- | ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `VITE_API_URL` | `http://localhost:8000` | No     | Built into the JavaScript bundle at build time and readable by anyone. Never put secrets in `VITE_` variables. Changing it requires a redeploy. |

## Database tasks

All commands run from `api/` with the virtual environment active.

| Task                                     | Command                                                                                                    |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Apply migrations                         | `alembic upgrade head`                                                                                     |
| Create a migration after changing models | `alembic revision --autogenerate -m "describe the change"`, then review the generated file before applying |
| Seed local data                          | `python -m app.seed`                                                                                       |
| Full local reset                         | `alembic downgrade base && alembic upgrade head && python -m app.seed`                                     |
| Open a SQL shell                         | `docker compose exec db psql -U gather -d gather`                                                          |
| Run the practice queries                 | `docker compose exec -T db psql -U gather -d gather < sql/practice.sql`                                    |

> **Warning:** the seed script and the full reset delete all data in the target database. The seed script refuses to run unless `DATABASE_URL` points at `localhost` or `127.0.0.1`.

## Deployment

| Service | Settings                                                                                                                                |
| ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Neon    | PostgreSQL project; connection string stored only in Render's environment.                                                              |
| Render  | Root directory `api`; build `pip install -r requirements.txt`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; branch `main`. |
| Vercel  | Root directory `web`; framework Vite; build `npm run build`; output `dist`; production branch `main`.                                   |

Merging to `main` redeploys both the API and the web app.

The production database is not migrated automatically yet. After merging a migration, apply it to Neon by hand from `api/`:

```bash
DATABASE_URL="<neon connection string>" alembic upgrade head
```

The variable applies to that one command only, so `api/.env` stays pointed at the local database. Never run `app.seed` against Neon; it refuses anyway. Production has no seeded users, so create accounts with `POST /auth/register`. Automatic migrations on deploy are planned for milestone 6.

## Development workflow

- `main` is protected; all changes arrive through pull requests.
- One feature branch per milestone (for example `feat/schema`), created from an up-to-date `main`.
- Small, single-purpose commits.

```bash
git switch main && git pull
git switch -c feat/<name>
```

## Design decisions

- **FastAPI instead of Django or Supabase**, so that validation, authentication and queries are written explicitly rather than provided by a framework.
- **Constraints in the database as well as in code**, because application-level validation can be bypassed while database constraints cannot.
- **UUID primary keys generated by Postgres**, so ids are not guessable and do not depend on application code.
- **Migrations reviewed by hand**, because Alembic's autogenerate does not detect every change (for example, later changes to check constraints).
- **Argon2 for password hashing**, a slow, salted algorithm designed for passwords.
- **Short-lived JWT access tokens (15 minutes)**, so the API can check identity without a session table, and a leaked token stops working quickly. Refresh tokens are a planned extension.
- **One login error for unknown email and wrong password**, with a dummy hash check on unknown emails, so neither the message nor the response time reveals which emails have accounts.
- **Row locks for capacity checks**, because checking a count and then inserting is a race condition: without the lock, two simultaneous RSVPs can both take the last seat.
- **Ownership checked after existence (404 before 403)**, so the error order is predictable for clients.
- **One error format for every failure**, so the frontend can show field-level messages without handling each endpoint separately.
- **Limit/offset pagination**, which is simple and fine at this data size. It can switch to cursor pagination if the lists grow large.
