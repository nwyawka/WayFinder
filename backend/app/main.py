"""
Wayfinder - Smart Commute Optimizer
FastAPI backend with ML-based traffic prediction and aggressive rerouting
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes, commutes
from app.services.scheduler import start_scheduler, stop_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup and shutdown events."""
    # Startup: begin background traffic polling
    await start_scheduler()
    yield
    # Shutdown: clean up
    await stop_scheduler()


app = FastAPI(
    title="Wayfinder",
    description="ML-powered commute optimizer with aggressive rerouting",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API routes
app.include_router(routes.router, prefix="/api/routes", tags=["routes"])
app.include_router(commutes.router, prefix="/api/commutes", tags=["commutes"])


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "wayfinder"}
