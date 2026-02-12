# Image Categorization Removal Summary

This document summarizes all changes made to remove image categorization from the C.O.G.N.I.T. platform.

## Overview
Removed the `category` column from the images table and all related categorization logic from the API, frontend, database schema, and documentation. Images are now served randomly without categorization.

## Changes Made

### 1. Database Schema (`backend/schema.sql`)
- Removed `category VARCHAR(100)` column from the `images` table
- Removed `idx_images_category` index
- Updated `vw_image_coverage` view to exclude category from SELECT and GROUP BY clauses

### 2. Backend API (`backend/app.py`)

#### Functions Modified:
- **`_populate_images()`**: Removed category determination logic; now inserts all images without categorization
- **`_create_indexes()`**: Removed `idx_images_category` index creation
- **`_create_views()`**: Updated `vw_image_coverage` view definition
- **`migrate_database_schema()`**: Removed category column from table creation
- **`get_images_from_db()`**: Simplified to remove type filtering; now returns all images
- **`build_image_payload()`**: Removed is_survey and is_attention fields from response
- **`random_image()` endpoint**: Removed `type` query parameter; now returns random image from all available images
- **Submit endpoint**: Removed category logic when inserting new images

#### API Documentation:
- Updated `/api/images/random` endpoint documentation
- Removed type parameter description
- Removed is_survey and is_attention from response schema

### 3. API Documentation (`backend/templates/api_docs.html`)
- Removed type parameter table from `/api/images/random` endpoint
- Updated response example to remove is_survey and is_attention fields
- Updated all code examples (JavaScript, Python, cURL) to remove type parameter
- Updated submission examples to remove is_survey and is_attention fields

### 4. Database Initialization (`backend/init_db.py`)
- **`populate_images()`**: Removed category determination logic; now processes all images without categorization

### 5. Frontend (`frontend/src/App.jsx`)

#### Functions Modified:
- **`fetchImage()`**: Removed type parameter; now determines is_survey based on current stage and is_attention based on image_id pattern
- **Removed `getNextType()`**: No longer needed
- **`handleSubmit()`**: Added fallback values for is_survey and is_attention
- **`handlePaymentComplete()`**: Updated to call fetchImage() without type parameter
- **`handleNext()`**: Updated to call fetchImage() without type parameter
- **`handleSurveyContinue()`**: Updated to call fetchImage() without type parameter

## Behavior Changes

### Before:
- Images were categorized as "normal", "survey", or "attention"
- Frontend requested specific image types via `?type=normal|survey|attention` query parameter
- API returned is_survey and is_attention flags in the response
- Database stored category for each image

### After:
- Images are no longer categorized in the database
- API returns a random image from all available images
- Frontend determines is_survey based on the current stage (survey vs trial)
- Frontend determines is_attention by checking if image_id contains "attention"
- Database no longer stores category information

## Migration Notes

For existing databases with the category column:
1. The column will remain in the database (schema changes don't auto-drop columns)
2. New deployments will have the updated schema without category
3. The application will work with both schemas (ignores category if present)

To completely remove the category column from an existing database, run:
```sql
ALTER TABLE images DROP COLUMN IF EXISTS category;
```

## API Changes

### `/api/images/random` Endpoint
**Before:**
```
GET /api/images/random?type=normal
Response:
{
  "image_id": "survey/aurora-lake.svg",
  "image_url": "/api/images/survey/aurora-lake.svg",
  "is_survey": false,
  "is_attention": false
}
```

**After:**
```
GET /api/images/random
Response:
{
  "image_id": "aurora-lake.svg",
  "image_url": "/api/images/aurora-lake.svg"
}
```

## Testing Recommendations

1. Test image retrieval to ensure random images are returned
2. Verify survey flow still works correctly
3. Test attention check detection based on image_id patterns
4. Verify submissions are still saved correctly
5. Check that existing functionality is not broken

## Files Modified
- `backend/schema.sql`
- `backend/app.py`
- `backend/init_db.py`
- `backend/templates/api_docs.html`
- `frontend/src/App.jsx`
