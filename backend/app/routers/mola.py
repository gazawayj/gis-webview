from fastapi import APIRouter
from app.schemas.geojson import FeatureCollection
from app.db import get_mola_features

router = APIRouter()

@router.get("/", response_model=FeatureCollection)
def get_features():
    return {
    "type": "FeatureCollection",
    "features": get_mola_features()
    }