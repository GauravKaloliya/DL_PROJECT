# Image Description Study

This project contains a React + Vite frontend and a Flask backend that serve an image description study workflow. The backend stores submissions in an append-only CSV file and serves local images.

## Author

**Gaurav Kaloliya** - Innovating Cognitive Research Tools

## Repository Structure

- `frontend/`: React + Vite application
- `backend/`: Flask API and CSV storage
- `backend/images/`: Local images grouped into `normal/`, `survey/`, and `attention/`

## Backend Setup

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python app.py
```

The backend runs on `http://localhost:5000` by default.

### Security Features

The backend now includes comprehensive security measures:

- **Rate Limiting**: 200 requests/day, 50 requests/hour (default), with stricter limits for admin endpoints
- **CORS Restrictions**: Limited to specific origins for enhanced security
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, CSP, HSTS, Referrer-Policy
- **IP Hashing**: SHA-256 hashing with salt for anonymous data collection
- **API Key Protection**: Required for all admin endpoints
- **Request Validation**: Content type checking and header validation
- **CSRF Protection**: Available for form submissions

### Security Endpoints

- `GET /api/security/info` - Get security configuration information
- `GET /admin/security/audit` - Run security audit (requires API key)

### Environment Variables

- `MIN_WORD_COUNT` (default: 20)
- `TOO_FAST_SECONDS` (default: 5)
- `ADMIN_API_KEY` (default: changeme)
- `IP_HASH_SALT` (default: local-salt)

### Admin Endpoints

- `GET /api/stats` (requires `X-API-KEY` header or `api_key` query param)
- `GET /admin/download` (requires API key)
- `GET /admin/csv-data` (requires API key, rate limited)
- `GET /admin/security/audit` (requires API key, rate limited)

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
- `backend/images/survey/`
- `backend/images/attention/`

Sample SVGs are included to get you started.

## Enhanced Features

### User Data Collection
The application now collects comprehensive demographic data:

- **Required Fields**: Age group, native language, prior experience
- **Optional Fields**: Education level, gender, country of residence, device type, screen size

### Admin Panel Enhancements

1. **Security Tab**: Comprehensive security overview and controls
2. **Enhanced Settings**: API key management, security settings, and system information
3. **Data Explorer**: Search and pagination for large datasets
4. **Security Audit**: Run comprehensive security checks
5. **Rate Limiting**: Visual display of current rate limits

### UI/UX Improvements

- **Consent Page**: Enhanced checkbox styling with detailed consent information
- **Dropdowns**: Custom styled select elements with proper icons
- **Admin Login**: Improved login panel with gradient header
- **Security Indicators**: Visual status indicators for security features
- **Responsive Design**: Improved mobile responsiveness

### Security Best Practices

1. **Rate Limiting**: Prevents brute force attacks
2. **CORS Restrictions**: Limits cross-origin requests
3. **Security Headers**: Protects against common web vulnerabilities
4. **IP Hashing**: Ensures user privacy
5. **API Key Protection**: Secures admin endpoints
6. **Request Validation**: Prevents malicious requests
