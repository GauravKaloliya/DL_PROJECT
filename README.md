# C.O.G.N.I.T. Image Description Study

C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) is a full-stack research platform for running image-description studies. Participants review a sequence of images, write detailed descriptions, rate complexity, and provide feedback. The system includes survey and attention-check images to support research quality, along with a priority user system and reward mechanism.

## Highlights

- **Participant Onboarding**: Complete registration flow with demographics capture, consent management, and payment simulation
- **Multi-Phase Study**: Survey phase with introductory images followed by main trials with attention checks
- **Quality Validation**: Minimum 60-word descriptions with rating/feedback validation and attention check verification
- **Priority User System**: Track participant engagement through word counts and survey rounds to identify priority users
- **Reward Mechanism**: Randomized reward selection with higher probability for priority-eligible participants
- **Privacy & Security**: IP hashing, comprehensive audit logging, and security headers
- **Interactive API Documentation**: HTML-based API documentation at the root path

## Tech Stack

- **Frontend**: React 18 + Vite 5 (SPA)
- **Backend**: Python Flask 3 (REST API)
- **Storage**: SQLite database with enhanced schema including participants, submissions, consent records, priority users, and rewards tables

## Repository Structure

```
.
├── backend/
│   ├── app.py                 # Main Flask application
│   ├── schema.sql             # Database schema definition
│   ├── COGNIT.db              # SQLite database (auto-generated)
│   ├── requirements.txt      # Python dependencies
│   ├── images/                # Image library
│   │   ├── normal/           # Main study images
│   │   ├── survey/           # Introductory survey images
│   │   └── attention/        # Attention check images
│   ├── data/                 # Local data directory
│   └── templates/            # HTML templates
│       └── api_docs.html     # API documentation template
└── frontend/
    ├── src/
    │   ├── App.jsx           # Main React application
    │   ├── pages/            # Page components
    │   ├── components/       # Reusable components
    │   └── utils/            # Utility functions
    └── package.json          # Node dependencies
```

## Database Schema

### Core Tables

- **participants**: Stores participant demographic information, consent status, and metadata
- **submissions**: Records all image descriptions with word counts, ratings, and feedback
- **consent_records**: Tracks consent timestamps and participant agreement
- **images**: Catalog of available images with metadata
- **priority_users**: Manages user engagement metrics and priority eligibility
- **rewards**: Tracks reward selection and payment status
- **audit_log**: Comprehensive security and activity logging
- **performance_metrics**: Endpoint performance tracking

### Priority User System

The priority user system tracks participant engagement through:
- **Total Words**: Cumulative word count across all submissions
- **Survey Rounds**: Number of survey phase completions
- **Priority Eligibility**: Automatically assigned when participant reaches 500+ total words OR completes 3+ survey rounds

Priority-eligible users receive a 15% reward selection probability compared to the standard 5% for all participants.

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend runs on `http://localhost:5000`.

API Documentation is available at: `http://localhost:5000/`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and connects to the backend API.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `MIN_WORD_COUNT` | `60` | Minimum words required in a description |
| `TOO_FAST_SECONDS` | `5` | Flags submissions as too fast below this duration |
| `IP_HASH_SALT` | `local-salt` | Salt for anonymizing IP addresses |
| `SECRET_KEY` | auto-generated | Flask session secret |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated list of allowed CORS origins |

## Key Endpoints

### System Health
- `GET /` - API Documentation (HTML)
- `GET /api/health` - Health check endpoint
- `GET /api/security/info` - Detailed security information

### Participant Management
- `POST /api/participants` - Create a new participant
- `GET /api/participants/<participant_id>` - Get participant details

### Consent Management
- `POST /api/consent` - Record participant consent
- `GET /api/consent/<participant_id>` - Get consent status

### Image & Submission
- `GET /api/images/random?type=normal|survey|attention` - Get a random image
- `GET /api/images/<image_id>` - Serve image file
- `POST /api/submit` - Submit description and rating

### Rewards
- `GET /api/reward/<participant_id>` - Get reward status and eligibility
- `POST /api/reward/select/<participant_id>` - Check and select for reward

### Data Retrieval
- `GET /api/submissions/<participant_id>` - Get all submissions for a participant

## Study Flow

1. **Consent Phase**: Participant reviews and accepts the research consent form
2. **Registration**: Participant provides demographic information (name, email, age, location, etc.)
3. **Payment Simulation**: Simulates payment processing before study begins
4. **Survey Phase**: Participant completes 3-5 introductory survey images
5. **Main Trials**: Participant completes 15 main image descriptions with:
   - Random normal images (75% probability)
   - Attention check images (25% probability, or every 15 trials)
   - Minimum 60-word requirement per description
   - Complexity rating (1-10 scale)
   - Short feedback comments
6. **Completion**: Final page with summary and reward check

## Adding Images

Place images in the appropriate directories:

```
backend/images/
├── normal/       # Main study images (use natural scenes)
├── survey/       # Introductory survey images (simpler images)
└── attention/    # Attention check images with specific details
```

Supported formats: JPG, JPEG, PNG, GIF, WebP

For attention checks, ensure the image contains a distinctive feature or object that can be referenced in instructions (e.g., "Include the word 'bicycle' in your description").

## Data Storage

- **SQLite Database**: `backend/COGNIT.db`
  - Stores all participant data, submissions, consent records, and metadata
  - Automatic backups created during database regeneration
  - Includes comprehensive indexes for optimal query performance

## Security Features

- **CORS**: Strict origin-based restrictions with explicit whitelist
- **Rate Limiting**: Per-endpoint limits to prevent abuse
- **Security Headers**: CSP, HSTS, X-Frame-Options, and more
- **IP Hashing**: SHA-256 hashing with configurable salt for privacy
- **Input Validation**: Comprehensive validation on all user inputs
- **Audit Logging**: Automatic logging of all critical actions
- **Injection Protection**: Heuristic checks for SQL injection attempts

## Priority & Reward System

### Priority Eligibility
Participants become priority-eligible when they reach:
- 500+ total words across all submissions, OR
- 3+ completed survey rounds

### Reward Selection
- Standard participants: 5% selection probability
- Priority-eligible participants: 15% selection probability
- Reward amount: $10 (configurable)
- Status tracking: pending → approved → paid → rejected

## Development

### Database Migration

To migrate existing data to the new schema:
```bash
cd backend
python app.py  # Automatic migration on startup
```

### Regenerating Database

To completely regenerate the database from schema:
```bash
cd backend
python app.py --regenerate-db
```

### Running Tests

```bash
# Backend tests
cd backend
python -m pytest tests/

# Frontend tests
cd frontend
npm test
```

## License

See LICENSE file for details.

## Credits

Created by Gaurav Kaloliya

## Contact

For questions or support:
- Research Team: research@cognit.org
- GitHub Issues: https://github.com/your-repo/cognit/issues
