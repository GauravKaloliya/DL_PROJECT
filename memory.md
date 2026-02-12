# C.O.G.N.I.T. Project Memory

## Project Overview

C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) is a full-stack research platform for running image-description studies.

## Tech Stack

- **Frontend**: React 18 SPA built with Vite 5, React Router, Chart.js via react-chartjs-2
- **Backend**: Python Flask 3 REST API with flask-cors and flask-limiter
- **Storage**: SQLite database (COGNIT.db) with comprehensive schema

## Application Flow

1. **Consent Phase**: Participant reviews and accepts research consent form
2. **User Details**: Capture demographic information (username, email, age, gender, location, etc.)
3. **Payment Simulation**: Simulates payment processing before study begins
4. **Survey Phase**: 3-5 introductory survey images
5. **Main Trials**: 15 main trials with random normal (75%) and attention-check (25%) images
6. **Completion**: Final page with summary and reward check

## Database Schema

### Core Tables
- `participants`: User demographics, consent status
- `submissions`: Image descriptions with word counts, ratings, feedback
- `consent_records`: Consent timestamps and agreements
- `images`: Image catalog with metadata
- `priority_users`: Engagement metrics and priority eligibility
- `rewards`: Reward selection and payment status
- `audit_log`: Security and activity logging
- `performance_metrics`: Endpoint performance tracking

### Priority System
- Priority eligibility at 500+ total words OR 3+ survey rounds
- Priority users get 15% reward selection probability vs 5% standard
- Rewards: $10 default amount

## Key Features

- Minimum 60-word descriptions per submission
- Complexity rating (1-10 scale)
- Attention check validation
- IP hashing for privacy (SHA-256 with salt)
- Comprehensive audit logging
- Rate limiting per endpoint
- Security headers (CSP, HSTS, X-Frame-Options)

## API Endpoints

- `GET /` - HTML API Documentation
- `GET /api/health` - Health check
- `GET /api/security/info` - Security configuration
- `POST /api/participants` - Create participant
- `GET /api/participants/<id>` - Get participant details
- `POST /api/consent` - Record consent
- `GET /api/consent/<id>` - Get consent status
- `GET /api/images/random` - Get random image
- `GET /api/images/<id>` - Serve image
- `POST /api/submit` - Submit description
- `GET /api/submissions/<id>` - Get submissions
- `GET /api/reward/<id>` - Get reward status
- `POST /api/reward/select/<id>` - Check/select reward

## Environment Variables

- `MIN_WORD_COUNT` (default: 60)
- `TOO_FAST_SECONDS` (default: 5)
- `IP_HASH_SALT` (default: local-salt)
- `SECRET_KEY` (auto-generated)
- `CORS_ORIGINS` (default: http://localhost:5173)

## Development Commands

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py  # Starts on port 5000
```

### Frontend
```bash
cd frontend
npm install
npm run dev  # Starts on port 5173
```

### Database Migration
```bash
cd backend
python app.py  # Auto-migrates on startup
python app.py --regenerate-db  # Full regeneration from schema.sql
```

## File Structure

```
backend/
├── app.py              # Main Flask app
├── schema.sql          # Database schema
├── COGNIT.db          # SQLite database
├── images/            # Image files (normal/, survey/, attention/)
├── templates/         # HTML templates
│   └── api_docs.html # API docs template
└── requirements.txt   # Python dependencies

frontend/
├── src/
│   ├── App.jsx              # Main app
│   ├── MainApp.jsx          # Router setup
│   ├── pages/              # Page components
│   │   ├── ConsentPage.jsx
│   │   ├── UserDetailsPage.jsx
│   │   ├── PaymentPage.jsx
│   │   ├── TrialPage.jsx
│   │   └── FinishedPage.jsx
│   ├── components/         # Reusable components
│   │   └── ApiDocs.jsx
│   ├── styles.css          # Global styles
│   └── utils/              # Utilities
└── package.json
```

## Important Notes

- No CSV functionality - removed in v4.0.0
- API documentation now served as HTML at root path "/" instead of JSON at "/api/docs"
- Renamed from "Cognitive Observation & Generalized Narrative Inquiry Tool" to "Cognitive Network for Image & Text Modeling" in v4.0.0
- Session state persisted in sessionStorage
- Health check runs every 30 seconds
- All participant actions logged to audit_log table
- Database version tracking in database_metadata table
