from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from src.agent.tools.quiz_generator import generate_quiz
from src.api.schemas import QuizGenerateRequest, QuizResponse
from src.storage.postgres import LearningSpace, get_db_session

router = APIRouter(prefix="/tools", tags=["Learning Tools"])


@router.post("/quiz", response_model=QuizResponse)
async def create_quiz(
    request: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
):
    if not await db.get(LearningSpace, request.space_id):
        raise HTTPException(status_code=404, detail="Learning space not found.")
    try:
        return await generate_quiz(request.space_id, request.prompt.strip())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
