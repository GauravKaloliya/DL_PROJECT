# Image Description Study (C.O.G.N.I.T.)

C.O.G.N.I.T. (Cognitive Observation & Generalized Narrative Inquiry Tool) is a full-stack research platform for running an image-description study. Participants describe visual scenes, rate them, and provide feedback. Admins can authenticate, review statistics, and export data.

## Tech Stack

- **Frontend:** React 18 + Vite 5 (SPA)
- **Backend:** Python Flask 3 (REST API)
- **Storage:** CSV submissions log + SQLite admin database

## Repository Structure

- `frontend/`: React application
- `backend/`: Flask API, SQLite DB, and CSV storage
- `backend/images/`: Image library (`normal/`, `survey/`, `attention/`)
- `backend/data/`: Submission CSV

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend runs on `http://localhost:5000`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and communicates with the backend API. Set `VITE_API_BASE` if the backend is hosted elsewhere.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `MIN_WORD_COUNT` | `30` | Minimum words required in a description |
| `TOO_FAST_SECONDS` | `5` | Flags submissions as too fast below this duration |
| `IP_HASH_SALT` | `local-salt` | Salt for anonymizing IP addresses |
| `SECRET_KEY` | auto-generated | Flask session secret |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` | empty | Optional email config |

## Admin Authentication

Admins authenticate with username/password to receive a session token. Include the token in the `X-SESSION-TOKEN` header for protected endpoints.

Default admin (for local development):

- **Username:** `Gaurav`
- **Password:** `Gaurav@0809`

## API Documentation

- **Backend JSON docs:** `GET /api/docs`
- **Frontend viewer:** `/api/docs`

## Key Endpoints

### Public

- `GET /api/images/random` (type: `normal`, `survey`, `attention`)
- `GET /api/images/<image_id>`
- `POST /api/submit`
- `GET /api/pages/home` / `about` / `contact` / `faq`
- `GET /api/security/info`

### Admin (requires `X-SESSION-TOKEN`)

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `POST /api/admin/change-password`
- `GET /api/stats`
- `GET /admin/download`
- `GET /admin/csv-data`
- `DELETE /admin/settings/csv-delete`
- `GET /admin/security/audit`

## Images

Add or replace images in:

- `backend/images/normal/`
- `backend/images/survey/`
- `backend/images/attention/`

The repository now includes 30+ additional SVG scenes in `normal/` to expand the study catalog.

## Data Storage

- **Submissions:** Append-only CSV at `backend/data/submissions.csv`
- **Admin Users/Sessions:** SQLite database at `backend/COGNIT.db`

## Security Highlights

- CORS restrictions with explicit origins
- Rate limiting on public/admin endpoints
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- IP hashing for privacy-preserving analytics
