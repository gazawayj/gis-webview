from fastapi import FastAPI
from app.routers import mola, search

app = FastAPI(title="GIS WebView Backend")

# Include routers
app.include_router(mola.router, prefix="/mola", tags=["MOLA"])
app.include_router(search.router, prefix="/search", tags=["Search"])

@app.get("/")
async def root():
    return {"message": "GIS WebView backend is running"}
