# C.O.G.N.I.T. Image Description Study

C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) is a full-stack research platform for running an image-description study. Participants review a sequence of images, write detailed descriptions, rate complexity, and provide feedback. The system includes survey and attention-check images to support research quality and advances understanding of how humans describe visual content and how AI can better model this cognitive process.

## Highlights

- Participant onboarding (details, consent, payment simulation)
- Survey and main image trials with attention checks
- Minimum 60-word descriptions with rating/feedback validation
- Privacy-preserving IP hashing and audit logging
- Interactive API documentation (available at root `/` endpoint)
- Focus on advancing image-text understanding and generation systems
- Production-ready with PostgreSQL database

## Tech Stack

- **Frontend:** React 18 + Vite 5 (SPA)
- **Backend:** Python Flask 3 (REST API)
- **Storage:** PostgreSQL database for participants, consent, submissions, and audit logs
- **Deployment:** Render.com

## Repository Structure

- `frontend/`: React application
- `backend/`: Flask API and PostgreSQL database
- `backend/images/`: Image library (`normal/`, `survey/`, `attention/`)
- `backend/data/`: Local data directory

## Getting Started

### Backend (Local Development)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Set up PostgreSQL database
# Option 1: Using Docker
docker run --name cognit-postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=cognit -p 5432:5432 -d postgres:15

# Option 2: Local PostgreSQL
# Create database 'cognit' in your PostgreSQL instance

# Set environment variables
export DATABASE_URL="postgresql://postgres:postgres@localhost:5432/cognit"
export SECRET_KEY="your-secret-key-here"

# Initialize database
python app.py --regenerate-db

# Run the server
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

### Backend

| Variable | Default | Description |
| --- | --- | --- |
| `DATABASE_URL` | Required | PostgreSQL connection string (e.g., `postgresql://user:pass@host:port/db`) |
| `MIN_WORD_COUNT` | `60` | Minimum words required in a description |
| `TOO_FAST_SECONDS` | `5` | Flags submissions as too fast below this duration |
| `IP_HASH_SALT` | `local-salt` | Salt for anonymizing IP addresses |
| `SECRET_KEY` | auto-generated | Flask session secret |
| `CORS_ORIGINS` | `http://localhost:5173` + `WEBSITE_URL` | Comma-separated list of allowed origins. If not set, defaults to localhost + WEBSITE_URL |

### Frontend

| Variable | Default | Description |
| --- | --- | --- |
| `VITE_API_BASE` | `http://localhost:5000/api` | Backend API base URL |

## Deployment

### Render.com

For traditional server-based deployment:

**Quick Steps:**
1. Create PostgreSQL database on Render
2. Deploy backend as Web Service (from `backend/` directory)
3. Deploy frontend as Static Site (from `frontend/` directory)
4. Database initializes automatically on first backend start

**Configuration:**
The project includes `render.yaml` for automated deployment. Simply connect your repository to Render and it will detect the configuration automatically.

## Key Endpoints

### Public

- `GET /` - API documentation (root endpoint)
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
- `GET /api/reward/<participant_id>` - Get reward status
- `POST /api/reward/select/<participant_id>` - Check reward eligibility

## Images

Add or replace images in:

- `backend/images/normal/`
- `backend/images/survey/`
- `backend/images/attention/`

## Database Schema

The PostgreSQL schema includes:

- **participants**: User details and consent
- **consent_records**: Consent tracking
- **submissions**: Image descriptions and ratings
- **images**: Image metadata
- **audit_log**: Security and activity logs
- **performance_metrics**: Performance tracking
- **Views**: `vw_participant_summary`, `vw_submission_stats`, `vw_image_coverage`, `vw_submission_quality`
- **Triggers**: Automatic audit logging on inserts

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
- PostgreSQL with parameterized queries (SQL injection protection)

## Research Purpose

C.O.G.N.I.T. collects human image descriptions to advance AI model training for:
- Better image-text understanding
- Improved visual content generation
- Enhanced cognitive modeling of visual processing
- Research in multimodal AI systems

## Development Notes

- Migrated from SQLite to PostgreSQL for production scalability
- Uses SQLAlchemy ORM for database operations
- Implements connection pooling for performance
- Database migrations handled via SQL scripts
- Deployed on Render.com

## Troubleshooting

### Database Connection Issues

- Verify `DATABASE_URL` is correctly set
- Check PostgreSQL instance is running and accessible
- Ensure database exists and credentials are correct
- Check firewall/security group settings

### Frontend-Backend Connection

- **"Unable to connect to the server" error**: This is typically a CORS issue. The backend now automatically includes `WEBSITE_URL` in allowed origins when `CORS_ORIGINS` is not explicitly set. Make sure `WEBSITE_URL` is set to your frontend domain (e.g., `https://www.cognit.online`).
- If you need to explicitly set origins, use `CORS_ORIGINS=https://www.cognit.online,https://app.cognit.online`
- Check `VITE_API_BASE` points to correct backend URL (leave empty for same-origin requests)
- Ensure backend is running and accessible

## Support

For questions about the study or API usage, contact the development team.

---

**C.O.G.N.I.T.: Cognitive Network for Image & Text Modeling**