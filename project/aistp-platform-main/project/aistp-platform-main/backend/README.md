# Backend Setup

Django REST API for the AISTP platform.

## Requirements
- Python 3.11+
- pip / venv

## 1. Install dependencies

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## 2. Configure environment

Copy the example env file and fill in your own values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `DJANGO_SECRET_KEY` | Django secret key (any random string for dev) |
| `DJANGO_DEBUG` | `1` for dev, `0` for production |
| `DJANGO_ALLOWED_HOSTS` | Comma-separated hosts, e.g. `localhost,127.0.0.1` |
| `DATABASE_URL` | Full DB connection string (see below) |
| `JWT_ACCESS_TOKEN_LIFETIME_HOURS` | JWT access token lifetime |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Google Gemini API credentials |

## 3. Database

The project reads `DATABASE_URL` via `dj-database-url`
(`aistp/settings.py`) and supports two modes:

### PostgreSQL (Supabase) — staging/production
Set `DATABASE_URL` in `.env` to your Supabase Postgres connection string:

```
DATABASE_URL=postgresql://user:password@host:5432/aistp_db
```

`psycopg2-binary` is already included in `requirements.txt`.

### SQLite — local development
Leave `DATABASE_URL` unset (or remove it from `.env`) and the app falls
back to a local SQLite file at `backend/db.sqlite3` automatically — no
extra setup needed. This is the quickest way to get the API running
locally without a Postgres instance.

## 4. Run migrations & start the server

```bash
python manage.py migrate
python manage.py createsuperuser   # optional
python manage.py runserver
```

The API will be available at `http://localhost:8000/`.

## Tests

```bash
pytest
```
