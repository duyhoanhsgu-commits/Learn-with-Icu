import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.agent.context import (
    FixedContextTooLongError,
    LongTermMemoryNotFoundError,
    SpaceNotFoundError,
    long_term_memory_store,
    space_context_memory,
)
from src.api.schemas import (
    LearningSpaceCreate,
    LearningSpaceResponse,
    LongTermMemoryPayload,
    LongTermMemoryResponse,
    KnowledgeGraphEdgeResponse,
    KnowledgeGraphNodeResponse,
    KnowledgeGraphResponse,
    LearnerConceptStateResponse,
    LearnerStateResponse,
    LearningPathItemResponse,
    LearningPathResponse,
    SpaceContextResponse,
    SpaceContextUpdate,
    SpaceContextUpdateResponse,
)
from src.storage.object_store import object_store
from src.storage.postgres import Document, LearningSpace, get_db_session
from src.storage.vector_store import vector_store
from src.knowledge import knowledge_repository
from src.learner import learner_repository, mastery_status
from src.tutor import tutor_planner, tutor_policy

router = APIRouter(prefix="/spaces", tags=["Learning Spaces"])


@router.get("", response_model=list[LearningSpaceResponse])
async def list_spaces(db: AsyncSession = Depends(get_db_session)):
    result = await db.execute(select(LearningSpace).order_by(LearningSpace.created_at.asc()))
    return list(result.scalars().all())


@router.post("", response_model=LearningSpaceResponse, status_code=status.HTTP_201_CREATED)
async def create_space(payload: LearningSpaceCreate, db: AsyncSession = Depends(get_db_session)):
    space = LearningSpace(id=str(uuid.uuid4()), name=payload.name.strip(), color=payload.color)
    db.add(space)
    await db.commit()
    await db.refresh(space)
    return space


async def _require_space(db: AsyncSession, space_id: str) -> LearningSpace:
    space = await db.get(LearningSpace, space_id)
    if space is None:
        raise HTTPException(status_code=404, detail="Learning space not found.")
    return space


async def _learning_overlay(db: AsyncSession, space_id: str, learner_id: str):
    await _require_space(db, space_id)
    concepts = await knowledge_repository.get_concepts(db, space_id)
    states = await learner_repository.list(db, learner_id, space_id)
    return concepts, {item.concept_id: item for item in states}


@router.get("/{space_id}/knowledge-graph", response_model=KnowledgeGraphResponse)
async def get_knowledge_graph(
    space_id: str,
    learner_id: str = Query(default="default_session", min_length=1, max_length=160),
    db: AsyncSession = Depends(get_db_session),
):
    concepts, states = await _learning_overlay(db, space_id, learner_id)
    edges = await knowledge_repository.get_edges(db, space_id)
    nodes = []
    for concept in concepts:
        state = states.get(concept.id)
        sources = await knowledge_repository.get_concept_sources(db, concept.id, space_id)
        mastery = state.mastery if state else 0.0
        nodes.append(KnowledgeGraphNodeResponse(
            id=concept.id,
            name=concept.name,
            summary=concept.summary,
            difficulty=concept.difficulty,
            mastery=mastery,
            confidence=state.confidence if state else 0.0,
            status=mastery_status(mastery),
            source_chunk_ids=[item.id for item in sources],
        ))
    return KnowledgeGraphResponse(
        space_id=space_id,
        learner_id=learner_id,
        nodes=nodes,
        edges=[
            KnowledgeGraphEdgeResponse(
                source=edge.source_concept_id,
                target=edge.target_concept_id,
                relation=edge.relation,
            )
            for edge in edges
        ],
    )


@router.get("/{space_id}/learner-state", response_model=LearnerStateResponse)
async def get_learner_state(
    space_id: str,
    learner_id: str = Query(default="default_session", min_length=1, max_length=160),
    db: AsyncSession = Depends(get_db_session),
):
    concepts, states = await _learning_overlay(db, space_id, learner_id)
    return LearnerStateResponse(
        space_id=space_id,
        learner_id=learner_id,
        concepts=[
            LearnerConceptStateResponse(
                concept_id=concept.id,
                name=concept.name,
                mastery=states[concept.id].mastery if concept.id in states else 0.0,
                confidence=states[concept.id].confidence if concept.id in states else 0.0,
                status=mastery_status(states[concept.id].mastery if concept.id in states else 0.0),
                correct_count=states[concept.id].correct_count if concept.id in states else 0,
                wrong_count=states[concept.id].wrong_count if concept.id in states else 0,
                last_reviewed_at=states[concept.id].last_reviewed_at if concept.id in states else None,
                assessment_pending=bool(states[concept.id].pending_question) if concept.id in states else False,
            )
            for concept in concepts
        ],
    )


@router.get("/{space_id}/learning-path", response_model=LearningPathResponse)
async def get_learning_path(
    space_id: str,
    learner_id: str = Query(default="default_session", min_length=1, max_length=160),
    db: AsyncSession = Depends(get_db_session),
):
    concepts, states = await _learning_overlay(db, space_id, learner_id)
    graph = await knowledge_repository.graph(db, space_id)
    mastery = {concept.id: states[concept.id].mastery if concept.id in states else 0.0 for concept in concepts}

    def item(concept):
        value = mastery[concept.id]
        return LearningPathItemResponse(
            concept_id=concept.id,
            name=concept.name,
            mastery=value,
            status=mastery_status(value),
        )

    mastered = [item(concept) for concept in concepts if mastery[concept.id] >= 0.80]
    learning = [item(concept) for concept in concepts if 0.30 <= mastery[concept.id] < 0.80]
    review = [
        item(concept) for concept in concepts
        if concept.id in states
        and mastery[concept.id] < 0.70
        and (states[concept.id].wrong_count > 0 or states[concept.id].last_reviewed_at is not None)
    ]
    recommended = tutor_policy.select_next_concept(graph, mastery)
    diagnostic = tutor_planner.diagnostic_candidates(graph, mastery)
    pending = await learner_repository.pending_assessment(db, learner_id, space_id)
    return LearningPathResponse(
        space_id=space_id,
        learner_id=learner_id,
        mastered=mastered,
        learning=learning,
        recommended_next=[item(recommended)] if recommended else [],
        review=review,
        diagnostic_candidates=[item(concept) for concept in diagnostic],
        diagnostic_pending_concept_id=pending.concept_id if pending else None,
    )


@router.get("/{space_id}/context", response_model=SpaceContextResponse)
async def get_space_context(
    space_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        fixed_context = await space_context_memory.get(db, space_id)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    return SpaceContextResponse(space_id=space_id, fixed_context=fixed_context)


@router.put("/{space_id}/context", response_model=SpaceContextUpdateResponse)
async def update_space_context(
    space_id: str,
    payload: SpaceContextUpdate,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        fixed_context = await space_context_memory.update(
            db,
            space_id,
            payload.fixed_context,
        )
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    except FixedContextTooLongError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return SpaceContextUpdateResponse(
        space_id=space_id,
        fixed_context=fixed_context,
        updated=True,
    )


@router.get(
    "/{space_id}/memories",
    response_model=list[LongTermMemoryResponse],
)
async def list_space_memories(
    space_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await long_term_memory_store.list(db, space_id)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc


@router.post(
    "/{space_id}/memories",
    response_model=LongTermMemoryResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_space_memory(
    space_id: str,
    payload: LongTermMemoryPayload,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await long_term_memory_store.create(
            db,
            space_id,
            **payload.model_dump(),
        )
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc


@router.put(
    "/{space_id}/memories/{memory_id}",
    response_model=LongTermMemoryResponse,
)
async def update_space_memory(
    space_id: str,
    memory_id: str,
    payload: LongTermMemoryPayload,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        return await long_term_memory_store.update(
            db,
            space_id,
            memory_id,
            **payload.model_dump(),
        )
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    except LongTermMemoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Memory not found in this space.") from exc


@router.delete(
    "/{space_id}/memories/{memory_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_space_memory(
    space_id: str,
    memory_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    try:
        await long_term_memory_store.delete(db, space_id, memory_id)
    except SpaceNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Learning space not found.") from exc
    except LongTermMemoryNotFoundError as exc:
        raise HTTPException(status_code=404, detail="Memory not found in this space.") from exc


@router.delete("/{space_id}")
async def delete_space(space_id: str, db: AsyncSession = Depends(get_db_session)):
    space = await db.get(LearningSpace, space_id)
    if not space:
        raise HTTPException(status_code=404, detail="Learning space not found.")
    result = await db.execute(select(Document).where(Document.space_id == space_id))
    for document in result.scalars().all():
        await vector_store.delete_by_document_id(document.id)
        object_store.delete_file(document.file_path.split("/")[-1])
        await db.delete(document)
    await db.flush()
    await db.delete(space)
    await db.commit()
    return {"message": f"Learning space '{space.name}' deleted.", "space_id": space_id}
