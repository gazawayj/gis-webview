from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Add this import
from app.routers import mola

app = FastAPI(title="GIS API")

# Add this block right after 'app' is defined
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # For testing; change to your GitHub URL later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(mola.router, prefix="/mola")

@app.get("/")
def root():
    return {"status": "API running!"}