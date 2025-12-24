from fastapi import FastAPI
from routers import mola

app = FastAPI(title="GIS API")

app.include_router(mola.router, prefix="/mola")

@app.get("/")
def root():
    return {"status": "API running!"}
