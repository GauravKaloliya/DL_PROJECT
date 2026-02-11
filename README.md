# Image Description Study (C.O.G.N.I.T.)

C.O.G.N.I.T. (Cognitive Observation & Generalized Narrative Inquiry Tool) is a full-stack research platform for running an image-description study. Participants describe visual scenes, rate them, and provide feedback.

## Tech Stack

- **Frontend:** React 18 + Vite 5 (SPA)
- **Backend:** Python Flask 3 (REST API)
- **Storage:** SQLite database for submissions and participant data

## Repository Structure

- `frontend/`: React application
- `backend/`: Flask API and SQLite database
- `backend/images/`: Image library (`normal/`, `survey/`, `attention/`)
- `backend/data/`: Data directory

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

## API Documentation

- **Backend JSON docs:** `GET /api/docs`
- **Frontend viewer:** `/api/docs`

## Key Endpoints

### Public

- `GET /api/health` - Health check endpoint
- `GET /api/images/random` (type: `normal`, `survey`, `attention`)
- `GET /api/images/<image_id>`
- `POST /api/participants` - Create participant
- `GET /api/participants/<participant_id>`
- `POST /api/consent` - Record consent
- `GET /api/consent/<participant_id>`
- `POST /api/submit` - Submit description/rating
- `GET /api/submissions/<participant_id>`
- `GET /api/security/info`
- `GET /api/docs` - API documentation

## Images

Add or replace images in:

- `backend/images/normal/`
- `backend/images/survey/`
- `backend/images/attention/`

The repository includes SVG scenes in `normal/` to expand the study catalog.

## Data Storage

- **Participants, Submissions, Consent:** SQLite database at `backend/COGNIT.db`

## Security Highlights

- CORS restrictions with explicit origins
- Rate limiting on all endpoints
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- IP hashing for privacy-preserving analytics
