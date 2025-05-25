# Story Stream Weaver - Polling Fix

## Problem Identified

The polling functionality was failing to get the status of generated stories due to the following issues:

### 1. Authentication Method Mismatch
- **POST request** (start generation): Used `supabase.functions.invoke()` with service role
- **GET request** (status polling): Used direct `fetch()` with anon key
- This inconsistency caused authentication issues when trying to poll for status

### 2. In-Memory Storage Limitation
- The original polling function used `Map()` for storing task status
- Supabase Edge Functions can have cold starts or run on multiple instances
- Task data could be lost between POST and GET requests

### 3. Missing Database Table
- No persistent storage for task status across function invocations

## Solution Implemented

### 1. Fixed Authentication Consistency
- Updated `usePollingGeneration.ts` to use `supabase.functions.invoke()` for both POST and GET requests
- This ensures consistent authentication using the service role key

### 2. Added Database-Backed Storage
- Created `generation_tasks` table for persistent task storage
- Updated the polling function to use both in-memory cache and database storage
- Tasks persist across function cold starts and multiple instances

### 3. Improved Error Handling
- Better error messages and logging
- Graceful fallback from memory to database storage

## Setup Instructions

### 1. Create the Database Table
Run the SQL script in your Supabase SQL editor:

```bash
# Copy the content from create_generation_tasks_table.sql
# and run it in your Supabase project's SQL editor
```

### 2. Deploy the Updated Function
If you have Supabase CLI installed:

```bash
supabase functions deploy generate-story-polling
```

Or deploy through the Supabase dashboard by uploading the updated function code.

### 3. Test the Fix
1. Open your application
2. Switch to "Polling" mode
3. Generate a story
4. Verify that the progress updates work correctly
5. Check that the story completes successfully

## Key Changes Made

### Frontend (`src/hooks/usePollingGeneration.ts`)
- Changed GET requests to use `supabase.functions.invoke()` instead of direct `fetch()`
- Consistent authentication method for both POST and GET operations

### Backend (`supabase/functions/generate-story-polling/index.ts`)
- Added database table support for persistent task storage
- Improved request handling to support both direct API calls and `supabase.functions.invoke()`
- Added proper error handling and logging
- Implemented cleanup mechanism for old tasks

### Database Schema (`src/integrations/supabase/types.ts`)
- Added TypeScript types for the new `generation_tasks` table

## Testing

The polling functionality should now work correctly:
- ✅ Task creation and status storage
- ✅ Progress updates during generation
- ✅ Proper error handling
- ✅ Task completion and cleanup
- ✅ Persistence across function restarts

If you continue to experience issues, check the Supabase function logs for detailed error messages. 