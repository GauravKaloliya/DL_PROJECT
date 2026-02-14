# Multi-stage Dockerfile for C.O.G.N.I.T. application
# Builds frontend and serves it alongside backend API

# Stage 1: Build frontend
FROM node:18-slim AS frontend-builder

WORKDIR /app/frontend

# Copy package files
COPY frontend/package.json frontend/package-lock.json ./

# Install dependencies
RUN npm ci

# Copy frontend source and build
COPY frontend/ ./
RUN npm run build

# Stage 2: Serve frontend and backend
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    curl \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Copy frontend build
COPY --from=frontend-builder /app/frontend/dist ./frontend-dist

# Configure nginx to serve frontend and proxy API to backend
# Use PORT env var (Render provides this), fallback to 8080
COPY <<EOF /etc/nginx/nginx.conf
worker_processes 1;
daemon off;
error_log /dev/stdout warn;
pid /dev/null;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    access_log /dev/stdout;
    
    server {
        listen \${PORT:-8080};
        
        # Serve static files from frontend
        location / {
            root /app/frontend-dist;
            try_files \$uri \$uri/ /index.html;
        }
        
        # Proxy API requests to backend
        location /api/ {
            proxy_pass http://localhost:5000/api/;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }
    }
}
EOF

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port (PORT env var, default 8080)
ENV PORT=8080
EXPOSE 8080

# Health check (check API health endpoint)
HEALTHCHECK --interval=30s --timeout=30s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

# Start both services using gunicorn for the Flask backend
CMD sh -c "cd backend && gunicorn --bind 0.0.0.0:5000 --workers 2 --timeout 120 'app:app' & nginx -g 'daemon off;'"
