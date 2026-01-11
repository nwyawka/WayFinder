# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wayfinder is a smart commute optimization app that uses ML-based traffic prediction to provide aggressive rerouting recommendations. Unlike standard navigation apps (Google Maps, Waze) that have conservative rerouting thresholds, Wayfinder alerts you when alternate routes save even small amounts of time (configurable, default 2 minutes).

## Architecture

```
wayfinder/
├── backend/           # FastAPI Python backend
│   ├── app/
│   │   ├── api/       # REST endpoints (routes.py, commutes.py)
│   │   ├── services/  # Business logic (routing, traffic, storage)
│   │   └── ml/        # ML prediction (predictor, features, model)
│   └── data/          # JSON file storage (created at runtime)
└── frontend/          # React + Vite + TypeScript
    └── src/
        ├── components/
        ├── pages/
        └── lib/       # API client
```

### Key Design Decisions

- **ML Prediction**: Uses Gradient Boosting to predict traffic multipliers based on temporal features (hour, day, rush hour) and current conditions. Falls back to heuristics when no training data exists.
- **Multi-source Traffic**: Aggregates data from TomTom and HERE APIs to cross-reference and reduce false positives.
- **Aggressive Rerouting**: The threshold for suggesting route changes is configurable (default 2 min vs Google's ~5 min).
- **File-based Storage**: Uses JSON files for MVP simplicity - swap to PostgreSQL for production.

## Development Commands

### Backend

```bash
cd backend

# Setup virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Copy and configure environment
cp .env.example .env
# Edit .env with your API keys (TomTom, HERE)

# Run development server
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Run development server (proxies /api to backend)
npm run dev

# Build for production
npm run build
```

### Running Both

From the project root, run backend and frontend in separate terminals:
- Terminal 1: `cd backend && uvicorn app.main:app --reload`
- Terminal 2: `cd frontend && npm run dev`

Access at http://localhost:5173

## API Endpoints

- `POST /api/commutes/` - Create a saved commute
- `GET /api/commutes/` - List all commutes
- `POST /api/commutes/{id}/start` - Start tracking, returns route options with ML predictions
- `POST /api/commutes/{id}/history/{history_id}/end` - End tracking, records actual duration
- `GET /api/commutes/{id}/patterns` - Get historical patterns and recommendations
- `POST /api/routes/calculate` - Calculate routes between arbitrary points

## ML Model Details

The prediction pipeline in `backend/app/ml/`:

1. **Feature Extraction** (`features.py`): Extracts 16 features including cyclical time encoding, rush hour flags, current traffic level, and route characteristics.

2. **Model** (`model.py`): GradientBoostingRegressor predicting a duration multiplier (e.g., 1.3 = 30% longer than base estimate).

3. **Predictor** (`predictor.py`): Orchestrates prediction, falls back to heuristics when untrained.

4. **Patterns** (`patterns.py`): Analyzes commute history to find best/worst days and times.

## Traffic Data Sources

The app is designed for the US East Coast. Available free-tier APIs:
- **TomTom** (2,500 req/day): Real-time flow + incidents
- **HERE** (250k tx/month): Comprehensive traffic data
- **511NY, PennDOT**: State DOT open data (requires registration)
- **OSRM**: Fallback routing without traffic (free, unlimited)

## Key Files for Common Tasks

| Task | Files |
|------|-------|
| Add new traffic source | `backend/app/services/traffic.py` |
| Modify rerouting logic | `backend/app/api/routes.py` (line ~80) |
| Add ML features | `backend/app/ml/features.py` |
| Change UI theme | `frontend/tailwind.config.js` |
| Add map overlays | `frontend/src/pages/ActiveCommute.tsx` |
