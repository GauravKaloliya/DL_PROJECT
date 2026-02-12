#!/bin/bash

# C.O.G.N.I.T. Vercel Setup Helper Script
# This script helps verify your setup before deploying to Vercel

set -e

echo "=============================================="
echo "C.O.G.N.I.T. Vercel Deployment Setup Helper"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track if any checks fail
CHECKS_PASSED=true

# Check if running from project root
if [ ! -f "VERCEL_DEPLOYMENT.md" ]; then
    echo -e "${RED}✗ Error: Please run this script from the project root directory${NC}"
    exit 1
fi

echo "Step 1: Checking prerequisites..."
echo "-----------------------------------"

# Check for Git
if command -v git &> /dev/null; then
    echo -e "${GREEN}✓ Git is installed${NC}"
else
    echo -e "${RED}✗ Git is not installed${NC}"
    CHECKS_PASSED=false
fi

# Check for Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓ Node.js is installed ($NODE_VERSION)${NC}"
else
    echo -e "${RED}✗ Node.js is not installed${NC}"
    CHECKS_PASSED=false
fi

# Check for Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "${GREEN}✓ Python is installed ($PYTHON_VERSION)${NC}"
else
    echo -e "${RED}✗ Python 3 is not installed${NC}"
    CHECKS_PASSED=false
fi

# Check for Vercel CLI (optional)
if command -v vercel &> /dev/null; then
    VERCEL_VERSION=$(vercel --version)
    echo -e "${GREEN}✓ Vercel CLI is installed ($VERCEL_VERSION)${NC}"
else
    echo -e "${YELLOW}⚠ Vercel CLI is not installed (optional, but recommended)${NC}"
    echo -e "${YELLOW}  Install with: npm i -g vercel${NC}"
fi

echo ""
echo "Step 2: Checking project structure..."
echo "--------------------------------------"

# Check backend files
BACKEND_FILES=(
    "backend/app.py"
    "backend/wsgi.py"
    "backend/requirements.txt"
    "backend/vercel.json"
    "backend/schema.sql"
    "backend/init_db.py"
)

for file in "${BACKEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file exists${NC}"
    else
        echo -e "${RED}✗ $file is missing${NC}"
        CHECKS_PASSED=false
    fi
done

# Check frontend files
FRONTEND_FILES=(
    "frontend/package.json"
    "frontend/vite.config.js"
    "frontend/vercel.json"
    "frontend/.env.production"
)

for file in "${FRONTEND_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✓ $file exists${NC}"
    else
        echo -e "${RED}✗ $file is missing${NC}"
        CHECKS_PASSED=false
    fi
done

echo ""
echo "Step 3: Checking configuration..."
echo "----------------------------------"

# Check .env.production
if [ -f "frontend/.env.production" ]; then
    API_BASE=$(grep "VITE_API_BASE" frontend/.env.production | cut -d'=' -f2)
    if [ -n "$API_BASE" ]; then
        echo -e "${YELLOW}⚠ VITE_API_BASE is set to: $API_BASE${NC}"
        echo -e "${YELLOW}  Update this after deploying your backend${NC}"
    else
        echo -e "${YELLOW}⚠ VITE_API_BASE is not set in .env.production${NC}"
    fi
fi

# Check if images exist
if [ -d "backend/images" ]; then
    IMAGE_COUNT=$(find backend/images -type f \( -name "*.jpg" -o -name "*.png" -o -name "*.jpeg" \) | wc -l)
    if [ "$IMAGE_COUNT" -gt 0 ]; then
        echo -e "${GREEN}✓ Found $IMAGE_COUNT image(s) in backend/images${NC}"
    else
        echo -e "${YELLOW}⚠ No images found in backend/images${NC}"
        echo -e "${YELLOW}  Add images before deploying${NC}"
    fi
else
    echo -e "${YELLOW}⚠ backend/images directory not found${NC}"
fi

echo ""
echo "Step 4: Generating helpful information..."
echo "------------------------------------------"

# Generate a random secret key
SECRET_KEY=$(openssl rand -hex 32 2>/dev/null || echo "PLEASE_GENERATE_SECRET_KEY")
IP_HASH_SALT=$(openssl rand -hex 16 2>/dev/null || echo "PLEASE_GENERATE_SALT")

echo ""
echo "Environment variables to set in Vercel:"
echo ""
echo "Backend Environment Variables:"
echo "------------------------------"
echo "DATABASE_URL=<your-neon-database-url>"
echo "SECRET_KEY=$SECRET_KEY"
echo "CORS_ORIGINS=<your-frontend-url>"
echo "MIN_WORD_COUNT=60"
echo "TOO_FAST_SECONDS=5"
echo "IP_HASH_SALT=$IP_HASH_SALT"
echo "FLASK_DEBUG=0"
echo ""

echo "Frontend Environment Variables:"
echo "-------------------------------"
echo "VITE_API_BASE=<your-backend-url>"
echo ""

echo "=============================================="
echo "Summary"
echo "=============================================="

if [ "$CHECKS_PASSED" = true ]; then
    echo -e "${GREEN}✓ All checks passed!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Create a Neon PostgreSQL database"
    echo "2. Deploy backend to Vercel (root directory: backend)"
    echo "3. Set backend environment variables in Vercel"
    echo "4. Deploy frontend to Vercel (root directory: frontend)"
    echo "5. Update frontend/.env.production with backend URL"
    echo "6. Initialize database: python backend/init_db.py <database-url>"
    echo "7. Update backend CORS_ORIGINS with frontend URL"
    echo ""
    echo "See VERCEL_DEPLOYMENT.md for detailed instructions."
else
    echo -e "${RED}✗ Some checks failed. Please fix the issues above.${NC}"
    exit 1
fi

echo ""
echo "Save the environment variables shown above!"
echo "You'll need them when deploying to Vercel."
echo ""
