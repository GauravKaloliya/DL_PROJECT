"""
WSGI entry point for Vercel deployment
This file is required for Vercel's Python runtime
"""
from app import app

# Vercel expects the WSGI application to be named 'app' or 'application'
application = app

if __name__ == "__main__":
    app.run()
