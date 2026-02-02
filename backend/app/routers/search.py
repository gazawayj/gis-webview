from fastapi import APIRouter, HTTPException
from app.services.gemini import ai_search

router = APIRouter()

@router.get("/")
async def search_query(q: str):
    try:
        response = ai_search(q)
        return {"query": q, "results": response}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
