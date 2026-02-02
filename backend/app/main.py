import os
import json
import socket
import signal
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.routers.mola import router as mola_router

# -------------------------------------------------------------------
# PythonAnywhere IPv4 fix (DNS only)
# -------------------------------------------------------------------
if os.getenv("PYTHONANYWHERE_SITE"):
    _old_getaddrinfo = socket.getaddrinfo

    def new_getaddrinfo(*args, **kwargs):
        return [
            r for r in _old_getaddrinfo(*args, **kwargs)
            if r[0] == socket.AF_INET
        ]

    socket.getaddrinfo = new_getaddrinfo

# -------------------------------------------------------------------
# FastAPI app
# -------------------------------------------------------------------
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gazawayj.github.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

# -------------------------------------------------------------------
# Gemini system prompt
# -------------------------------------------------------------------
SYSTEM_PROMPT = """
You are a GIS assistant. When a user asks for a location on Earth, Mars, or the Moon,
return ONLY a JSON object with this EXACT schema in degrees:
{ "name": string, "lat": float, "lon": float, "planet": "earth" | "mars" | "moon" }
If not found, return {"error": "location not found"}.
"""

# -------------------------------------------------------------------
# Timeout protection (prevents uWSGI harakiri)
# -------------------------------------------------------------------
class GeminiTimeout(Exception):
    pass


def _timeout_handler(signum, frame):
    raise GeminiTimeout()


def run_with_timeout(func, seconds=8):
    signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(seconds)
    try:
        return func()
    finally:
        signal.alarm(0)

# -------------------------------------------------------------------
# Lazy Gemini client
# -------------------------------------------------------------------
def get_gemini_client():
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    # Lazy import 
    from google.genai import Client

    return Client(api_key=api_key)

# -------------------------------------------------------------------
# Search endpoint
# -------------------------------------------------------------------
@router.get("/")
def ai_search(q: str):
    try:
        def call_gemini():
            client = get_gemini_client()

            response = client.models.generate_content(
                model="gemini-2.5-flash",
                contents=q,
                config={
                    "system_instruction": SYSTEM_PROMPT,
                    "response_mime_type": "application/json",
                },
            )
            return response

        response = run_with_timeout(call_gemini, seconds=8)

        raw = response.text.strip()
        if raw.startswith("```"):
            raw = raw.replace("```json", "").replace("```", "").strip()

        return json.loads(raw)

    except GeminiTimeout:
        raise HTTPException(
            status_code=504,
            detail="Gemini request timed out"
        )

    except Exception as e:
        print(f"CRITICAL AI SEARCH ERROR: {e}")
        raise HTTPException(
            status_code=500,
            detail=str(e)
        )

# -------------------------------------------------------------------
# Routers
# -------------------------------------------------------------------
app.include_router(router, prefix="/search", tags=["search"])
app.include_router(mola_router, prefix="/mola", tags=["mola"])

# -------------------------------------------------------------------
# Root
# -------------------------------------------------------------------
@app.get("/")
def root():
    return {"message": "GIS Backend is running"}
