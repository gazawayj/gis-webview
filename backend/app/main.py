import os
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from app.routers import mola

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

router = APIRouter()
genai.configure(api_key=os.getenv("GEMINI_API_KEY")) 

SYSTEM_PROMPT = """
You are a GIS assistant. When a user asks for a location on Earth, Mars, or the Moon, 
return ONLY a JSON object with the following keys: 
{ "name": string, "lat": float, "lon": float, "planet": "earth" | "mars" | "moon" }.
If you don't know the location, return {"error": "location not found"}.
"""



# 1. Get the absolute path to the directory where main.py lives (backend/app/)
current_dir = os.path.dirname(os.path.abspath(__file__))
# 2. Construct the path to the tiles directory (backend/tiles/)

model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=SYSTEM_PROMPT)

@router.get("/search")
async def ai_search(q: str):
    response = model.generate_content(q)
    try:
        # Assuming Gemini returns valid JSON based on system instructions
        return eval(response.text) 
    except:
        raise HTTPException(status_code=400, detail="AI returned invalid format")

@app.get("/")
async def root():
    return {"message": "GIS Backend is running"}

if __name__ == "__main__":
    import uvicorn
    # Use the string "main:app" to support hot-reloading
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

