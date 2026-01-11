#!/bin/bash
set -e

# Start FastAPI backend in background
cd /app
uvicorn app.main:app --host 127.0.0.1 --port 8000 &

# Wait for backend to be ready
sleep 3

# Start nginx in foreground
nginx -g 'daemon off;'
