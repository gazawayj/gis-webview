import os
import json
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import Client
from google.genai import types
from app.routers import mola


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gazawayj.github.io"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- FIXED CLIENT INITIALIZATION ---
client = Client(api_key=os.getenv("GEMINI_API_KEY"))

router = APIRouter()

SYSTEM_PROMPT = """
You are a GIS assistant. When a user asks for a location on Earth, Mars, or the Moon, 
return ONLY a JSON object with this EXACT schema in degrees:
{ "name": string, "lat": float, "lon": float, "planet": "earth" | "mars" | "moon" }
If not found, return {"error": "location not found"}.
"""

@router.get("/search")
async def ai_search(q: str):
    try:
        response = client.models.generate_content(
            model='gemma-3-27b-it',
            contents=q,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"AI Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Register routers
app.include_router(router)
app.include_router(mola.router, prefix="/mola")

@app.get("/")
async def root():
    return {"message": "GIS Backend is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)