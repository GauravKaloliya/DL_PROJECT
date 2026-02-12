#!/bin/bash

# Production URL Test Script
# This script tests the production deployment URLs for C.O.G.N.I.T.

set -e

FRONTEND_URL="${FRONTEND_URL:-https://cognit-weld.vercel.app}"
BACKEND_URL="${BACKEND_URL:-$FRONTEND_URL}"

echo "=============================================="
echo "C.O.G.N.I.T. Production URL Test"
echo "=============================================="
echo ""
echo "Frontend URL: $FRONTEND_URL"
echo "Backend URL:  $BACKEND_URL"
echo ""
echo "=============================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_count=0
pass_count=0
fail_count=0

# Test function
test_endpoint() {
    local name=$1
    local url=$2
    local expected_type=$3
    local description=$4

    test_count=$((test_count + 1))
    echo "Test $test_count: $name"
    echo "URL: $url"
    echo "Expected: $expected_type"
    echo "Description: $description"

    response=$(curl -s -w "\n%{http_code}" "$url" 2>&1)
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)

    if [ "$http_code" = "200" ]; then
        if [ "$expected_type" = "HTML" ]; then
            if echo "$body" | grep -q "<!DOCTYPE html>" || echo "$body" | grep -q "<html"; then
                echo -e "${GREEN}✓ PASS${NC}: Received HTML as expected"
                pass_count=$((pass_count + 1))
            else
                echo -e "${RED}✗ FAIL${NC}: Expected HTML but got different content"
                echo "Response preview:"
                echo "$body" | head -5
                fail_count=$((fail_count + 1))
            fi
        elif [ "$expected_type" = "JSON" ]; then
            if echo "$body" | jq empty 2>/dev/null; then
                echo -e "${GREEN}✓ PASS${NC}: Received valid JSON"
                echo "Response:"
                echo "$body" | jq .
                pass_count=$((pass_count + 1))
            else
                echo -e "${RED}✗ FAIL${NC}: Expected JSON but got HTML or invalid response"
                echo "Response preview (first 200 chars):"
                echo "$body" | head -c 200
                echo ""
                fail_count=$((fail_count + 1))
            fi
        fi
    else
        echo -e "${RED}✗ FAIL${NC}: HTTP $http_code (expected 200)"
        fail_count=$((fail_count + 1))
    fi
    echo ""
    echo "----------------------------------------------"
    echo ""
}

# Test Frontend
echo "=== FRONTEND TESTS ==="
echo ""

test_endpoint \
    "Frontend Home Page" \
    "$FRONTEND_URL" \
    "HTML" \
    "Should load the React application home page"

# Test API Endpoints
echo "=== BACKEND API TESTS ==="
echo ""

test_endpoint \
    "API Health Check" \
    "$BACKEND_URL/api/health" \
    "JSON" \
    "Should return health status with database and images status"

test_endpoint \
    "API Documentation" \
    "$BACKEND_URL/api/docs" \
    "JSON" \
    "Should return API documentation JSON"

test_endpoint \
    "Random Image Endpoint" \
    "$BACKEND_URL/api/images/random" \
    "JSON" \
    "Should return random image data"

# Test additional endpoints (may fail if no data)
test_endpoint \
    "Security Info Endpoint" \
    "$BACKEND_URL/api/security/info" \
    "JSON" \
    "Should return security configuration"

# Summary
echo "=============================================="
echo "TEST SUMMARY"
echo "=============================================="
echo "Total Tests: $test_count"
echo -e "${GREEN}Passed: $pass_count${NC}"
echo -e "${RED}Failed: $fail_count${NC}"
echo ""

if [ $fail_count -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo "Production deployment is working correctly!"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo "Please check the failed tests above."
    echo ""
    echo "Common issues:"
    echo "1. Backend not deployed - API endpoints return HTML instead of JSON"
    echo "2. CORS misconfiguration - Frontend cannot access backend"
    echo "3. Environment variables not set - Backend cannot connect to database"
    echo ""
    echo "See PRODUCTION_URL_STATUS_REPORT.md for detailed analysis."
    exit 1
fi
