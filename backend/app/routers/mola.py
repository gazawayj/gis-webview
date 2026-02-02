from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_mola_features():
    # Example MOLA feature
    return [{
        "type": "Feature",
        "geometry": {"type": "Point", "coordinates": [0, 0]},
        "properties": {"name": "Prime Meridian Center"}
    }]
