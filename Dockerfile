# Stage 1: Build Next.js Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend

COPY finly-app/package*.json ./
RUN npm ci

COPY finly-app/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Stage 2: Unified Container (FastAPI + Next.js + Supervisor)
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies, curl, nodejs and supervisor
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    supervisor \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install Backend Python dependencies
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir -r ./backend/requirements.txt

# Copy Backend source code
COPY backend/ ./backend/

# Copy Frontend build artifacts
COPY --from=frontend-builder /app/frontend/.next/standalone ./frontend/
COPY --from=frontend-builder /app/frontend/.next/static ./frontend/.next/static
COPY --from=frontend-builder /app/frontend/public ./frontend/public

# Create directories for persistent data and logs
RUN mkdir -p /app/data /app/woob_data /var/log/supervisor

# Copy Supervisor configuration
COPY supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Environment variables
ENV DATABASE_URL="sqlite:///./data/finly.db" \
    SYNC_INTERVAL_HOURS="6" \
    CORS_ORIGINS="*" \
    BACKEND_INTERNAL_URL="http://127.0.0.1:8000" \
    NEXT_PUBLIC_API_URL="/api/v1" \
    PORT="3000" \
    HOSTNAME="0.0.0.0" \
    PYTHONUNBUFFERED="1"

EXPOSE 3000

CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]
