from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.agent.tools.mindmap_generator import generate_mindmap
from src.agent.tools.quiz_generator import generate_quiz
from src.api.schemas import (
    LearningToolGenerateRequest,
    MindMapResponse,
    QuizGenerateRequest,
    QuizResponse,
)
from src.storage.postgres import LearningSpace, LearningTool, get_db_session

router = APIRouter(prefix="/tools", tags=["Learning Tools"])


def _quiz_response(tool: LearningTool) -> QuizResponse:
    questions = tool.content.get("questions", [])
    return QuizResponse(
        id=tool.id,
        space_id=tool.space_id,
        title=tool.title,
        prompt=tool.prompt,
        question_count=len(questions),
        questions=questions,
        created_at=tool.created_at,
    )


def _mindmap_response(tool: LearningTool) -> MindMapResponse:
    return MindMapResponse(
        id=tool.id,
        space_id=tool.space_id,
        title=tool.title,
        prompt=tool.prompt,
        root=tool.content["root"],
        created_at=tool.created_at,
    )


@router.get("", response_model=list[QuizResponse | MindMapResponse])
async def list_tools(
    space_id: str = Query(...),
    tool_type: str = Query(default="quiz", pattern="^(quiz|mindmap)$"),
    db: AsyncSession = Depends(get_db_session),
):
    if not await db.get(LearningSpace, space_id):
        raise HTTPException(status_code=404, detail="Learning space not found.")
    result = await db.execute(
        select(LearningTool)
        .where(LearningTool.space_id == space_id, LearningTool.tool_type == tool_type)
        .order_by(LearningTool.created_at.desc())
    )
    serializer = _quiz_response if tool_type == "quiz" else _mindmap_response
    return [serializer(tool) for tool in result.scalars().all()]


@router.post("/quiz", response_model=QuizResponse)
async def create_quiz(
    request: QuizGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
):
    if not await db.get(LearningSpace, request.space_id):
        raise HTTPException(status_code=404, detail="Learning space not found.")
    try:
        quiz = await generate_quiz(request.space_id, request.prompt.strip())
        tool = LearningTool(
            id=quiz.id,
            space_id=request.space_id,
            tool_type="quiz",
            title=quiz.title,
            prompt=quiz.prompt,
            content={"questions": [question.model_dump() for question in quiz.questions]},
        )
        db.add(tool)
        await db.commit()
        await db.refresh(tool)
        return _quiz_response(tool)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.post("/mindmap", response_model=MindMapResponse)
async def create_mindmap(
    request: LearningToolGenerateRequest,
    db: AsyncSession = Depends(get_db_session),
):
    if not await db.get(LearningSpace, request.space_id):
        raise HTTPException(status_code=404, detail="Learning space not found.")
    try:
        mindmap = await generate_mindmap(request.space_id, request.prompt.strip())
        tool = LearningTool(
            id=mindmap.id,
            space_id=request.space_id,
            tool_type="mindmap",
            title=mindmap.title,
            prompt=mindmap.prompt,
            content={"root": mindmap.root.model_dump()},
        )
        db.add(tool)
        await db.commit()
        await db.refresh(tool)
        return _mindmap_response(tool)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc


@router.delete("/{tool_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_tool(tool_id: str, db: AsyncSession = Depends(get_db_session)):
    tool = await db.get(LearningTool, tool_id)
    if not tool:
        raise HTTPException(status_code=404, detail="Learning tool not found.")
    await db.delete(tool)
    await db.commit()
