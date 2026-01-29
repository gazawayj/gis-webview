import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.routers import mola

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(mola.router, prefix="/api") 

# 1. Get the absolute path to the directory where main.py lives (backend/app/)
current_dir = os.path.dirname(os.path.abspath(__file__))
# 2. Construct the path to the tiles directory (backend/tiles/)
tiles_path = os.path.join(current_dir, "..", "tiles")

# 3. Mount the directory
app.mount("/tiles", StaticFiles(directory=tiles_path), name="tiles")

@app.get("/")
async def root():
    return {"message": "GIS Backend is running", "tiles_path": tiles_path}

if __name__ == "__main__":
    import uvicorn
    # Use the string "main:app" to support hot-reloading
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)

