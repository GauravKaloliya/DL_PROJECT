# C.O.G.N.I.T. Image Description Study

C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) is a full-stack research platform for running an image-description study. Participants review a sequence of images, write detailed descriptions, rate complexity, and provide feedback. The system includes survey and attention-check images to support research quality and advances understanding of how humans describe visual content and how AI can better model this cognitive process.

## Highlights

- Participant onboarding (details, consent, payment simulation)
- Survey and main image trials with attention checks
- Minimum 60-word descriptions with rating/feedback validation
- Privacy-preserving IP hashing and audit logging
- Interactive API documentation (available at root `/` endpoint)
- Focus on advancing image-text understanding and generation systems

## Tech Stack

- **Frontend:** React 18 + Vite 5 (SPA)
- **Backend:** Python Flask 3 (REST API)
- **Storage:** SQLite database for participants, consent, submissions, and audit logs

## Repository Structure

- `frontend/`: React application
- `backend/`: Flask API and SQLite database
- `backend/images/`: Unified image library (`survey/` holds normal, survey, and attention images)
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
API documentation is available at `http://localhost:5000/` (root endpoint).

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

- `GET /` - API documentation (root endpoint)
- `GET /api/health` - Health check endpoint
- `GET /api/images/random` (type: `normal`, `survey`, `attention`)
- `GET /api/images/<image_id>` (image IDs use the `survey/<filename>` format)
- `POST /api/participants` - Create participant
- `GET /api/participants/<participant_id>`
- `POST /api/consent` - Record consent
- `GET /api/consent/<participant_id>`
- `POST /api/submit` - Submit description/rating
- `GET /api/submissions/<participant_id>`
- `GET /api/security/info`
- `GET /api/reward/<participant_id>` - Get reward status
- `POST /api/reward/select/<participant_id>` - Check reward eligibility

## Images

Add or replace images in the unified library:

- `backend/images/survey/`

Normal, survey, and attention-check images live together in the same folder. Attention-check images use the `attention-` filename prefix, while survey practice images should match the survey names configured in the backend.

## Data Storage

- **SQLite database:** `backend/COGNIT.db`
- Stores participants, consent records, submissions, audit logs, and performance metrics.

## Application Flow

1. **Consent Form**: Participants read and acknowledge consent
2. **User Details**: Demographics and contact information collection
3. **Survey Trials**: Initial image set for practice/warmup
4. **Main Trials**: Primary image description phase with attention checks
5. **Completion**: Reward eligibility check and completion confirmation

## Security Highlights

- CORS restrictions with explicit origins
- Rate limiting on all endpoints
- Security headers (CSP, HSTS, X-Frame-Options, etc.)
- IP hashing for privacy-preserving analytics
- Input validation and sanitization
- Comprehensive audit logging

## Research Purpose

C.O.G.N.I.T. collects human image descriptions to advance AI model training for:
- Better image-text understanding
- Improved visual content generation
- Enhanced cognitive modeling of visual processing
- Research in multimodal AI systems

## Support

For questions about the study or API usage, contact the development team.

---

**C.O.G.N.I.T.: Cognitive Network for Image & Text Modeling**