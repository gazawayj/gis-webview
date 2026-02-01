from fastapi import APIRouter, HTTPException, status
from app.schemas.geojson import FeatureCollection
from app.db import get_mola_features
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/", response_model=FeatureCollection)
def get_features():
    try:
        features_data = get_mola_features()
        
        if not features_data:
            # 404 is appropriate if the collection exists but is empty/not found
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No MOLA features found in the database."
            )
            
        return FeatureCollection(
            type="FeatureCollection", 
            features=features_data # type: ignore
        )

    except HTTPException as http_exc:
        raise http_exc
    
    except Exception as e:
        logger.error(f"Database error: {str(e)}")
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An internal error occurred while fetching GIS data."
        )
