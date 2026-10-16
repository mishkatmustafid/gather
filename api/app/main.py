from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings

from app.routers import events

from app.errors import register_error_handlers

app = FastAPI(title="Gather API", version="0.1.0")

app.include_router(events.router)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

register_error_handlers(app)

@app.get("/health")
def health():
    return {"status": "ok"}