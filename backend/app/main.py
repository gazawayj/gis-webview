import os
import json
import socket
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import Client, types
from app.routers.mola import router as mola_router

# --- PythonAnywhere IPv4 patch (optional, guarded) ---
if os.getenv("PYTHONANYWHERE_SITE"):
    _old_getaddrinfo = socket.getaddrinfo

    def new_getaddrinfo(*args, **kwargs):
        return [r for r in _old_getaddrinfo(*args, **kwargs) if r[0] == socket.AF_INET]

    socket.getaddrinfo = new_getaddrinfo

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gazawayj.github.io", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()

SYSTEM_PROMPT = """
You are a GIS assistant. When a user asks for a location on Earth, Mars, or the Moon,
return ONLY a JSON object with this EXACT schema in degrees:
{ "name": string, "lat": float, "lon": float, "planet": "earth" | "mars" | "moon" }
If not found, return {"error": "location not found"}.
"""

def get_client() -> Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY not set")

    return Client(
        api_key=api_key,
        http_options=types.HttpOptions(
            client_args={"proxy": "http://proxy.server:3128"},
            async_client_args={"proxy": "http://proxy.server:3128"},
        ),
    )

@router.get("/search")
def ai_search(q: str):
    try:
        client = get_client()
        response = client.models.generate_content(
            model="gemini-2.5-flash-lite",
            contents=q,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json",
            ),
        )
        return json.loads(response.text) # type: ignore
    except Exception as e:
        print(f"CRITICAL AI SEARCH ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))

app.include_router(router, prefix="/search", tags=["search"])
app.include_router(mola_router, prefix="/mola", tags=["mola"])


@app.get("/")
def root():
    return {"message": "GIS Backend is running"}
