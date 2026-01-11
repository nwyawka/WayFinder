# Multi-stage build for Wayfinder

# Stage 1: Build frontend
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Stage 2: Production image
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    nginx \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir flexpolyline

# Copy backend
COPY backend/app ./app

# Copy frontend build
COPY --from=frontend-build /app/frontend/dist /var/www/html

# Copy nginx config and ensure it's enabled
COPY deploy/nginx.conf /etc/nginx/sites-available/default
RUN ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

# Copy startup script
COPY deploy/start.sh /start.sh
RUN chmod +x /start.sh

# Create data directory
RUN mkdir -p /app/data

EXPOSE 80

CMD ["/start.sh"]
