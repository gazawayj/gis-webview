from typing import List, Dict, Any
from pydantic import BaseModel

class Geometry(BaseModel):
    type: str
    coordinates: Any

class Feature(BaseModel):
    type: str = "Feature"
    geometry: Geometry
    properties: Dict[str, Any]

class FeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[Feature]
