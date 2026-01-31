import os
import json
from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from google.genai import Client
from google.genai import types
from app.routers import mola
import socket

# Universal IPv4 Patch: Prevents hangs by forcing Python to ignore IPv6
_old_getaddrinfo = socket.getaddrinfo
def new_getaddrinfo(*args, **kwargs):
    responses = _old_getaddrinfo(*args, **kwargs)
    return [r for r in responses if r[0] == socket.AF_INET]
socket.getaddrinfo = new_getaddrinfo


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://gazawayj.github.io"],
    allow_methods=["*"],
    allow_headers=["*"],
)

bootstrapApplication(AppComponent, {
  providers: [
    provideHttpClient()
  ]
}).catch(err => console.error(err));

# --- FIXED CLIENT INITIALIZATION ---
client = Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options=types.HttpOptions(
        client_args={
            "proxy": "http://proxy.server:3128", # standard PythonAnywhere proxy
        },
        async_client_args={
            "proxy": "http://proxy.server:3128",
        },
    ),
    )

router = APIRouter()

SYSTEM_PROMPT = """
You are a GIS assistant. When a user asks for a location on Earth, Mars, or the Moon,
return ONLY a JSON object with this EXACT schema in degrees:
{ "name": string, "lat": float, "lon": float, "planet": "earth" | "mars" | "moon" }
If not found, return {"error": "location not found"}.
"""
import requests
username = 'gazawayj'
token = 'ad4d35f12a99b2746049d4ee9a1424dafebc3f5c'

response = requests.get(
    'https://www.pythonanywhere.com/api/v0/user/{username}/cpu/'.format(
        username=username
    ),
    headers={'Authorization': 'Token {token}'.format(token=token)}
)
if response.status_code == 200:
    print('CPU quota info:')
    print(response.content)
else:
    print('Got unexpected status code {}: {!r}'.format(response.status_code, response.content))

@router.get("/search")
def ai_search(q: str):
    try:
        response = client.models.generate_content(
            # CHANGE THIS: Use a standard instruction-tuned ID
            model='gemini-2.5-flash-lite',
            contents=q,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                response_mime_type="application/json"
            )
        )
        return json.loads(response.text)
    except Exception as e:
        # This print will show up in your PythonAnywhere Error Log
        print(f"CRITICAL AI SEARCH ERROR: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Register routers
app.include_router(router)
app.include_router(mola.router, prefix="/mola")

@app.get("/")
def root():
    return {"message": "GIS Backend is running"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)