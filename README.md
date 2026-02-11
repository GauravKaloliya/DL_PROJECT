# C.O.G.N.I.T. Image Description Study

C.O.G.N.I.T. (Cognitive Observation & Generalized Narrative Inquiry Tool) is a full-stack research platform for running an image-description study. Participants review a sequence of images, write detailed descriptions, rate complexity, and provide feedback. The system includes survey and attention-check images to support research quality.

## Highlights

- Participant onboarding (details, consent, payment simulation)
- Survey and main image trials with attention checks
- Minimum 60-word descriptions with rating/feedback validation
- Privacy-preserving IP hashing and audit logging
- Interactive API documentation (`/api/docs`)

## Tech Stack

- **Frontend:** React 18 + Vite 5 (SPA)
- **Backend:** Python Flask 3 (REST API)
- **Storage:** SQLite database for participants, consent, submissions, and audit logs

## Repository Structure

- `frontend/`: React application
- `backend/`: Flask API and SQLite database
- `backend/images/`: Image library (`normal/`, `survey/`, `attention/`)
- `backend/data/`: Local data directory

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

The frontend runs on `http://localhost:5173` and connects to the backend API. Set `VITE_API_BASE` if the backend is hosted elsewhere.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `MIN_WORD_COUNT` | `60` | Minimum words required in a description |
| `TOO_FAST_SECONDS` | `5` | Flags submissions as too fast below this duration |
| `IP_HASH_SALT` | `local-salt` | Salt for anonymizing IP addresses |
| `SECRET_KEY` | auto-generated | Flask session secret |

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

## Data Storage

- **SQLite database:** `backend/COGNIT.db`
- Stores participants, consent records, submissions, audit logs, and performance metrics.

## Security Highlights

- CORS restrictions with explicit origins
- Rate limiting on all endpoints
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- IP hashing for privacy-preserving analytics
