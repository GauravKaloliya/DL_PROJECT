# Image Description Study

This project contains a React + Vite frontend and a Flask backend that serve an image description study workflow. The backend stores submissions in an append-only CSV file and serves local images.

## Repository Structure

- `frontend/`: React + Vite application
- `backend/`: Flask API and CSV storage
- `backend/images/`: Local images grouped into `normal/`, `practice/`, and `attention/`

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend runs on `http://localhost:5000` by default.

### Environment Variables

- `MIN_WORD_COUNT` (default: 20)
- `TOO_FAST_SECONDS` (default: 5)
- `ADMIN_API_KEY` (default: changeme)
- `IP_HASH_SALT` (default: local-salt)

### Admin Endpoints

- `GET /api/stats` (requires `X-API-KEY` header or `api_key` query param)
- `GET /admin/download` (requires API key)

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend.

## Images

Place images inside the following folders:

- `backend/images/normal/`
- `backend/images/practice/`
- `backend/images/attention/`

Sample SVGs are included to get you started.
