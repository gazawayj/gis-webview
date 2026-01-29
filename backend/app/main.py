import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Enable CORS so your webview can access the tiles
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_methods=["*"],
    allow_headers=["*"],
)

# This makes them accessible at http://localhost:8000/tiles/{z}/{x}/{y}.png
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Point to the tiles folder relative to main.py
tiles_path = os.path.join(os.path.dirname(BASE_DIR), "tiles")

app.mount("/tiles", StaticFiles(directory=tiles_path), name="tiles")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
