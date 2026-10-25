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
| 5. Frontend  | Event list, detail, forms, auth flow                             | ✅ Done |
| 6. Hardening | Tests, CI, automatic migrations on deploy                        | ⏳ Next |

## Architecture

```mermaid
flowchart LR
  Browser -->|loads static files| Web[React + Vite on Vercel]
  Browser -->|HTTPS JSON requests| API[FastAPI on Render]
  API -->|SQL over TLS| DB[(PostgreSQL on Neon)]
```

- **Vercel** serves the built frontend as static files. No application code runs there; `web/vercel.json` sends every path to `index.html` so React Router can handle deep links.
- **Render** runs the FastAPI app and holds all secrets. It is the only service that connects to the database.
- **Neon** hosts PostgreSQL. The browser never connects to it directly.

The browser calls the API directly from a different origin, so the API only accepts requests from origins listed in `CORS_ORIGINS`.

## Tech stack

| Layer                | Tools                                                                        |
| -------------------- | ---------------------------------------------------------------------------- |
| Database             | PostgreSQL 16, SQLAlchemy 2.0, Alembic                                       |
| API                  | Python 3.12, FastAPI, Pydantic, pydantic-settings, pwdlib (Argon2), PyJWT    |
| Web                  | React 19, TypeScript, Vite, Tailwind CSS 4, React Router 7, TanStack Query 5 |
| Local infrastructure | Docker Compose                                                               |
| Hosting              | Vercel (web), Render (API), Neon (database)                                  |

## Frontend

### Pages

| Path               | Access    | What it does                                                                              |
| ------------------ | --------- | ----------------------------------------------------------------------------------------- |
| `/`                | Public    | Upcoming events with search, a "from" date filter and pagination, all kept in the URL     |
| `/events/:id`      | Public    | Event details, capacity bar and RSVP; the host also sees Edit and Delete                  |
| `/events/new`      | Logged in | Create an event                                                                           |
| `/events/:id/edit` | Host only | Edit an event; anyone else sees "You can't edit this event"                               |
| `/me`              | Logged in | Events you're hosting (`/me`) or going to (`/me?tab=going`), split into upcoming and past |
| `/login`           | Public    | Log in; returns to the page you came from via `?next=`                                    |
| `/register`        | Public    | Create an account and log straight in                                                     |

Logged-out visitors who open a protected page are sent to `/login?next=…` and brought back after logging in. `?next=` only accepts paths on this site, so it can't redirect somewhere else.

### How it works

- **Auth state:** `AuthContext` stores the access token in `localStorage`, restores the session on load by calling `/auth/me`, and clears it on logout or when the token is rejected.
- **Server state:** TanStack Query fetches and caches all API data. Query keys and fetchers live in `src/lib/queries.ts`:
  - Data stays fresh for 30 seconds, so Back, tab switches and opening Edit from an event page are instant.
  - The event detail key includes the viewer's id, because `i_am_going` depends on who is asking.
  - After an RSVP, create, edit or delete, the affected queries are invalidated or updated directly, so every page shows the new data.
  - 4xx responses are never retried; network errors and 5xx responses are retried once.
  - Logging out removes the cached "my events" data.
- **URL as state:** search, date filter, page and the active tab are query parameters, so refreshing, sharing a link and the Back button all work. Typing in the search box updates the URL after a 300 ms pause, without adding a history entry for every keystroke.
- **Forms:** `EventForm` is shared by create and edit. Validation in `src/lib/eventForm.ts` mirrors the API's rules, and server errors appear under the matching field. `datetime-local` values are converted to UTC ISO strings before sending.
- **Every data view** has loading, empty and error states, with "Try again" on errors.

### Accessibility

- Every input has a label; errors are linked with `aria-describedby` and marked with `aria-invalid`.
- Visible focus rings throughout, a "Skip to main content" link, and keyboard-operable tabs on `/me` (arrow keys, Home, End).
- Touch targets are at least 44 px tall, and layouts work down to 360 px wide.
- Text colours meet WCAG AA contrast (4.5:1).
- Each page sets its own browser tab title, for example "Board games night · Gather".

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

| Method | Path             | Auth | Description                                     | Success   |
| ------ | ---------------- | ---- | ----------------------------------------------- | --------- |
| `POST` | `/auth/register` | —    | Create an account; email is stored lowercased   | 201 user  |
| `POST` | `/auth/login`    | —    | Exchange email and password for an access token | 200 token |
| `GET`  | `/auth/me`       | Yes  | The current user                                | 200 user  |

Passwords must be 8–128 characters. User responses never include the password hash.

### Events

| Method   | Path                | Auth     | Description                                                                  | Success |
| -------- | ------------------- | -------- | ---------------------------------------------------------------------------- | ------- |
| `GET`    | `/events`           | —        | List events with RSVP counts, ordered by start time                          | 200     |
| `GET`    | `/events/{id}`      | Optional | One event with its RSVP count; `i_am_going` is set when a token is sent      | 200     |
| `POST`   | `/events`           | Yes      | Create an event owned by the current user; `Location` header points at it    | 201     |
| `PATCH`  | `/events/{id}`      | Host     | Update only the fields sent                                                  | 200     |
| `DELETE` | `/events/{id}`      | Host     | Delete an event and its RSVPs                                                | 204     |
| `POST`   | `/events/{id}/rsvp` | Yes      | RSVP to an event                                                             | 201     |
| `DELETE` | `/events/{id}/rsvp` | Yes      | Cancel your RSVP                                                             | 204     |
| `GET`    | `/me/events`        | Yes      | Events you host (`?role=hosting`, the default) or attend (`?role=attending`) | 200     |

"Host" means the user who created the event; anyone else gets 403.

`GET /events` accepts these query parameters:

| Parameter | Default | Description                                           |
| --------- | ------- | ----------------------------------------------------- |
| `q`       | —       | Case-insensitive search in title and location         |
| `from`    | —       | Only events starting at or after this time (ISO 8601) |
| `limit`   | `20`    | Page size, 1–50                                       |
| `offset`  | `0`     | Number of events to skip                              |

It returns a page:

```json
{
  "items": [
    {
      "id": "…",
      "title": "Board games night",
      "rsvp_count": 12,
      "i_am_going": false,
      "…": "…"
    }
  ],
  "total": 42,
  "limit": 20,
  "offset": 0
}
```

Validation rules for create and update: the title is 3–120 characters, the location is 1–200 characters, capacity is 1–10,000, and `starts_at` and `ends_at` must include a timezone, with the end after the start. `PATCH` checks the end-after-start rule against the event's values after the update is applied, and rejects `null` for any field except `description`.

### RSVP and capacity rules

- You can't RSVP to an event that has already started, that you're already going to, or that is full.
- A host can't lower an event's capacity below the number of people already going.
- Both checks lock the event's row (`SELECT … FOR UPDATE`) for the rest of the transaction, so simultaneous requests are handled one at a time and an event can never be oversold. [`api/scripts/race_rsvp.py`](api/scripts/race_rsvp.py) fires concurrent RSVPs at capacity-1 events to verify this.

### Errors

Every error uses the same shape:

```json
{
  "error": {
    "code": "validation_error",
    "message": "Some fields are invalid.",
    "fields": { "title": "String should have at least 3 characters" }
  }
}
```

| Status | `code`                 | When                                                                                                                          |
| ------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| 401    | `bad_credentials`      | Login failed; the same response for an unknown email and a wrong password                                                     |
| 401    | `not_authenticated`    | The endpoint needs a token and none was sent                                                                                  |
| 401    | `token_expired`        | The token has expired; log in again                                                                                           |
| 401    | `invalid_token`        | The token is malformed, tampered with, or its user no longer exists                                                           |
| 403    | `not_owner`            | Only the event's host can change or delete it                                                                                 |
| 404    | `event_not_found`      | No event has that id                                                                                                          |
| 404    | `not_going`            | Cancelling an RSVP you don't have                                                                                             |
| 409    | `email_taken`          | An account with that email already exists                                                                                     |
| 409    | `event_started`        | RSVP to an event that has already started                                                                                     |
| 409    | `already_going`        | RSVP to an event you're already going to                                                                                      |
| 409    | `event_full`           | RSVP to a full event                                                                                                          |
| 409    | `capacity_below_rsvps` | Lowering capacity below the number of people going                                                                            |
| 409    | `conflict`             | The change breaks a database constraint                                                                                       |
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
   ├─ src/
   │  ├─ main.tsx            # router, QueryClientProvider, AuthProvider
   │  ├─ auth/
   │  │  ├─ AuthContext.tsx  # current user, login, logout
   │  │  └─ RequireAuth.tsx  # redirects logged-out users to /login
   │  ├─ components/
   │  │  ├─ Layout.tsx       # header, nav, skip link
   │  │  ├─ EventCard.tsx    # one event in a list
   │  │  ├─ EventForm.tsx    # shared create/edit form
   │  │  └─ FormField.tsx    # labelled input with error message
   │  ├─ lib/
   │  │  ├─ api.ts           # fetch wrapper, token storage, ApiError
   │  │  ├─ queries.ts       # TanStack Query keys and fetchers
   │  │  ├─ queryClient.ts   # cache and retry defaults
   │  │  ├─ eventForm.ts     # form values, validation, payload conversion
   │  │  ├─ dates.ts         # date formatting and conversion
   │  │  ├─ types.ts         # API response types
   │  │  └─ usePageTitle.ts  # sets the browser tab title
   │  └─ pages/              # one component per route
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

The app runs at http://localhost:5173 and shows the upcoming seeded events. Log in with one of the seeded accounts below to RSVP or create events.

Other web commands, run from `web/`:

| Command           | What it does                            |
| ----------------- | --------------------------------------- |
| `npm run lint`    | ESLint, including the React hooks rules |
| `npm run build`   | Type-check and build to `dist/`         |
| `npm run preview` | Serve the production build locally      |

### Seeded accounts

| Email             | Password    |
| ----------------- | ----------- |
| amira@example.com | password123 |
| ben@example.com   | password123 |
| chen@example.com  | password123 |

These exist only in the local database. Useful seeded data for trying things out:

- **Chen** hosts "Pottery taster", which is full (Amira and Ben are going).
- **Chen** is going to "Italian conversation".
- The first two events are in the past and show "This event has finished." The third starts at the moment you seed, so for the next three hours it shows "This event has already started."

## Environment variables

### API (`api/.env`)

| Variable       | Example                                                    | Secret | Notes                                                                                                                                                                     |
| -------------- | ---------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | `postgresql+psycopg://gather:gather@localhost:5432/gather` | Yes    | In production, the Neon connection string with the `postgresql+psycopg://` prefix and `?sslmode=require`.                                                                 |
| `JWT_SECRET`   | `change-me`                                                | Yes    | Signs access tokens. Production needs a random value of at least 32 bytes: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it logs everyone out. |
| `CORS_ORIGINS` | `["http://localhost:5173"]`                                | No     | JSON list of allowed frontend origins, no trailing slashes. Defaults to `["http://localhost:5173"]`.                                                                      |

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

| Service | Settings                                                                                                                                    |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Neon    | PostgreSQL project; connection string stored only in Render's environment.                                                                  |
| Render  | Root directory `api`; build `pip install -r requirements.txt`; start `uvicorn app.main:app --host 0.0.0.0 --port $PORT`; branch `main`.     |
| Vercel  | Root directory `web`; framework Vite; build `npm run build`; output `dist`; production branch `main`; `VITE_API_URL` set to the Render URL. |

Merging to `main` redeploys both the API and the web app. Pull requests also get a Vercel preview deployment; add its URL to `CORS_ORIGINS` on Render if you want the preview to reach the API.

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
- **React Router and Vite instead of Next.js**, so routing, data fetching and auth state are handled explicitly in the client rather than by a framework.
- **TanStack Query for server state**, which replaces hand-written loading flags, request cancellation and refetching with cache keys and invalidation.
- **The URL as the source of truth for filters and tabs**, so links can be shared and the Back button behaves as expected.
- **Client validation that mirrors the server**, for fast feedback; the API remains the authority, and its errors are shown in the same places.
- **Exact versions for newly added dependencies**, choosing releases at least two weeks old, to reduce exposure to compromised packages.

## Known limitations

- **Token storage:** the access token is kept in `localStorage`, which any script on the page can read, so an XSS bug could steal it. Moving to an httpOnly refresh-token cookie is a planned extension.
- **Host names:** the API returns only `owner_id`, so event pages show "You're hosting this event" to the host but not the host's name to others.
- **No automated tests yet:** the API and frontend tests, and running them in CI, are milestone 6.
