# C.O.G.N.I.T. - Cognitive Observation Study

This project contains a React + Vite frontend with a Flask backend that serves an image description study workflow. The backend stores submissions in an append-only CSV file and serves local images. Includes a full-featured admin panel with pagination, search, and analytics.

## 🎨 Features

- **Facebook-inspired UI**: Clean, professional interface using Facebook's color palette (#1877F2)
- **Dark Mode Support**: Automatic theme switching with persistent preferences
- **Full Admin Panel**: Complete dashboard at `/admin` with:
  - Real-time statistics and analytics
  - Paginated submission viewer
  - Search and filter capabilities
  - Sortable data tables
  - CSV export functionality
- **Robust API**: Paginated endpoints with error handling and retry logic
- **NASA-TLX Integration**: Task load assessment for each trial
- **Attention Checks**: Built-in validation mechanisms
- **Responsive Design**: Mobile-friendly interface

## 🏗️ Repository Structure

- `frontend/`: React + Vite application
- `backend/`: Flask API and CSV storage
- `backend/images/`: Local images grouped into `normal/`, `practice/`, and `attention/`

## 🚀 Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The backend runs on `http://localhost:5000` by default.

### Environment Variables

Create a `.env` file in the backend directory (see `.env.example`):

- `MIN_WORD_COUNT` (default: 30) - Minimum words required in descriptions
- `TOO_FAST_SECONDS` (default: 5) - Flag submissions completed too quickly
- `ADMIN_API_KEY` (default: changeme) - **Change this in production!**
- `IP_HASH_SALT` (default: local-salt) - Salt for hashing IP addresses

### API Endpoints

**Public Endpoints:**
- `GET /api/images/random?type={normal|practice|attention}` - Get random image
- `GET /api/images/<path>` - Serve image file
- `POST /api/submit` - Submit trial response
- `GET /api/health` - Health check endpoint

**Admin Endpoints (require API key):**
- `GET /api/stats?api_key=<key>` - Get study statistics
- `GET /api/submissions?page=<n>&per_page=<n>&api_key=<key>` - Paginated submissions
- `GET /api/submissions/<participant_id>?api_key=<key>` - Get participant data
- `GET /api/submissions/search?q=<query>&api_key=<key>` - Search submissions
- `GET /admin/download?api_key=<key>` - Download CSV

## 💻 Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:5173` and proxies API requests to the backend.

### Environment Variables

Create a `.env.local` file in the frontend directory:

```env
VITE_API_BASE=http://localhost:5000
```

### Routes

- `/` - Main study interface (participant view)
- `/admin` - Admin dashboard (requires API key)

## 📊 Admin Panel

Access the admin panel at `http://localhost:5173/admin`

**Features:**
- 📈 Real-time statistics dashboard
- 🔍 Search submissions by description, participant, or image
- 🎯 Filter by type (Normal/Practice/Attention)
- ↕️ Sort by any column
- 📄 View detailed submission information
- 📥 Download complete dataset as CSV
- 🔄 Real-time refresh capability

**Default API Key:** `changeme` (change in production!)

## 🖼️ Images

Place images inside the following folders:

- `backend/images/normal/` - Regular trial images
- `backend/images/practice/` - Practice trial images
- `backend/images/attention/` - Attention check images

Sample SVGs are included to get you started.

## 🎨 Color Scheme

**Light Mode:**
- Primary: #1877F2 (Facebook Blue)
- Secondary: #42B72A (Success Green)
- Background: #F0F2F5
- Card: #FFFFFF
- Text: #050505
- Border: #DADDE1

**Dark Mode:**
- Background: #18191A
- Card: #242526
- Primary: #2D88FF
- Text: #E4E6EB
- Border: #3E4042

## 📦 Data Storage

Submissions are stored in `backend/data/submissions.csv` with the following fields:

- Timestamp, Participant ID, Session ID
- Image details and description
- Word count, rating, feedback
- Time spent, practice/attention flags
- NASA-TLX ratings (6 dimensions)
- User agent and hashed IP

## 🔐 Security Notes

- Change `ADMIN_API_KEY` in production
- Use environment variables for sensitive data
- IP addresses are hashed with a salt
- CORS is enabled - configure appropriately for production

## 📝 Development

**Frontend:**
```bash
npm run dev     # Development server
npm run build   # Production build
npm run preview # Preview production build
```

**Backend:**
```bash
python app.py   # Development server with debug mode
```

## 🧪 Testing

The application includes:
- Error boundaries for graceful error handling
- Retry logic for failed API requests
- Loading states for all async operations
- Input validation on both frontend and backend
- Offline detection and warnings

## 📄 License

See LICENSE file for details.
