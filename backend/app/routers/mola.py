from fastapi import APIRouter

router = APIRouter()

@router.get("/")
def get_features():
    return {
        "type": "FeatureCollection",
        "features": []
    }
