# Gather

A small community events board: people sign up, post events, and RSVP to each other's.

Gather is a full-stack practice build covering relational schema design, migrations, REST API design, password authentication, ownership rules, and a React frontend that handles loading, errors and forms properly.

**Live:** [web](https://gather-three-gilt.vercel.app/) · [API docs](https://gather-1qn0.onrender.com//docs)

## Status

| Milestone    | Scope                                                            | Status  |
| ------------ | ---------------------------------------------------------------- | ------- |
| 1. Skeleton  | Repo, Docker Postgres, FastAPI `/health`, React app, deploys     | ✅ Done |
| 2. Database  | Models, constraints, Alembic migrations, seed data, practice SQL | ✅ Done |
| 3. REST API  | Events CRUD, search, pagination, error format                    | ⏳ Next |
| 4. Auth      | Register, login, JWT, ownership rules, RSVPs                     | ⏳      |
| 5. Frontend  | Event list, detail, forms, auth flow                             | ⏳      |
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
| API                  | Python 3.12, FastAPI, Pydantic, pydantic-settings, pwdlib (Argon2) |
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
  }
```

Rules enforced by the database itself, not only in application code:

- Email addresses are unique.
- A user can RSVP to an event at most once (composite primary key on `rsvps`).
- Deleting a user deletes their events and RSVPs; deleting an event deletes its RSVPs (`ON DELETE CASCADE`).
- Titles are 3–120 characters, events end after they start, and capacity is greater than zero (check constraints).
- `events.starts_at` is indexed for upcoming-event queries.

## Repository layout

```
gather/
├─ docker-compose.yml        # local PostgreSQL 16
├─ api/
│  ├─ app/
│  │  ├─ main.py             # FastAPI app, CORS, /health
│  │  ├─ config.py           # settings loaded from environment
│  │  ├─ db.py               # engine, session factory, Base
│  │  ├─ models.py           # User, Event, Rsvp
│  │  ├─ security.py         # Argon2 password hasher
│  │  └─ seed.py             # local-only seed data
│  ├─ migrations/            # Alembic environment and versions
│  ├─ sql/practice.sql       # hand-written practice queries
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

These exist only in the local database.

## Environment variables

### API (`api/.env`)

| Variable       | Example                                                    | Secret | Notes                                                                                                     |
| -------------- | ---------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL` | `postgresql+psycopg://gather:gather@localhost:5432/gather` | Yes    | In production, the Neon connection string with the `postgresql+psycopg://` prefix and `?sslmode=require`. |
| `JWT_SECRET`   | `change-me`                                                | Yes    | Generate a real value for production: `python -c "import secrets; print(secrets.token_urlsafe(48))"`.     |
| `CORS_ORIGINS` | `http://localhost:5173`                                    | No     | Comma-separated list of allowed frontend origins, no trailing slash.                                      |

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

The production database is not migrated automatically yet. `/health` does not use the database, so this does not affect the current deployment. Automatic migrations on deploy are planned for milestone 6.

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
