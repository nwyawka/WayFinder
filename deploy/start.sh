#!/bin/bash
set -e

echo "Starting Wayfinder..."

# Start FastAPI backend in background
cd /app
echo "Starting uvicorn..."
uvicorn app.main:app --host 127.0.0.1 --port 8000 &

# Wait for backend to be ready
sleep 3

# Test nginx config
echo "Testing nginx config..."
nginx -t

# Start nginx in foreground
echo "Starting nginx on port 80..."
nginx -g 'daemon off;'
