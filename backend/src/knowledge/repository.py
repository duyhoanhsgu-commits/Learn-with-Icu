from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.knowledge.extractor import KnowledgeExtraction
from src.knowledge.graph import KnowledgeGraph
from src.knowledge.models import Concept, ConceptEdge, ConceptSource
from src.storage.postgres import Document, DocumentChunk, LearningSpace


def normalize_concept_name(value: str) -> str:
    return " ".join(value.casefold().split())


class KnowledgeRepository:
    async def get_concepts(self, db: AsyncSession, space_id: str) -> list[Concept]:
        result = await db.execute(
            select(Concept).where(Concept.space_id == space_id).order_by(Concept.difficulty, Concept.name)
        )
        return list(result.scalars().all())

    async def get_concept(
        self, db: AsyncSession, concept_id: str, space_id: str | None = None
    ) -> Concept | None:
        query = select(Concept).where(Concept.id == concept_id)
        if space_id:
            query = query.where(Concept.space_id == space_id)
        return (await db.execute(query)).scalar_one_or_none()

    async def get_edges(self, db: AsyncSession, space_id: str) -> list[ConceptEdge]:
        result = await db.execute(select(ConceptEdge).where(ConceptEdge.space_id == space_id))
        return list(result.scalars().all())

    async def get_prerequisites(
        self, db: AsyncSession, concept_id: str, space_id: str
    ) -> list[Concept]:
        result = await db.execute(
            select(Concept)
            .join(ConceptEdge, ConceptEdge.source_concept_id == Concept.id)
            .where(
                ConceptEdge.space_id == space_id,
                ConceptEdge.target_concept_id == concept_id,
                ConceptEdge.relation == "prerequisite_of",
                Concept.space_id == space_id,
            )
        )
        return list(result.scalars().all())

    async def get_next_concepts(
        self, db: AsyncSession, concept_id: str, space_id: str
    ) -> list[Concept]:
        result = await db.execute(
            select(Concept)
            .join(ConceptEdge, ConceptEdge.target_concept_id == Concept.id)
            .where(
                ConceptEdge.space_id == space_id,
                ConceptEdge.source_concept_id == concept_id,
                ConceptEdge.relation == "prerequisite_of",
                Concept.space_id == space_id,
            )
        )
        return list(result.scalars().all())

    async def get_related_concepts(
        self, db: AsyncSession, concept_id: str, space_id: str
    ) -> list[Concept]:
        edges = await db.execute(
            select(ConceptEdge).where(
                ConceptEdge.space_id == space_id,
                or_(
                    ConceptEdge.source_concept_id == concept_id,
                    ConceptEdge.target_concept_id == concept_id,
                ),
            )
        )
        ids = {
            edge.target_concept_id if edge.source_concept_id == concept_id else edge.source_concept_id
            for edge in edges.scalars().all()
        }
        if not ids:
            return []
        result = await db.execute(
            select(Concept).where(Concept.space_id == space_id, Concept.id.in_(ids))
        )
        return list(result.scalars().all())

    async def get_concept_sources(
        self, db: AsyncSession, concept_id: str, space_id: str
    ) -> list[DocumentChunk]:
        result = await db.execute(
            select(DocumentChunk)
            .join(ConceptSource, ConceptSource.chunk_id == DocumentChunk.id)
            .join(Document, Document.id == DocumentChunk.document_id)
            .where(ConceptSource.concept_id == concept_id, Document.space_id == space_id)
            .order_by(DocumentChunk.document_id, DocumentChunk.chunk_index)
        )
        return list(result.scalars().all())

    async def graph(self, db: AsyncSession, space_id: str) -> KnowledgeGraph:
        return KnowledgeGraph(
            await self.get_concepts(db, space_id),
            await self.get_edges(db, space_id),
            space_id,
        )

    async def persist_extraction(
        self,
        db: AsyncSession,
        space_id: str,
        extraction: KnowledgeExtraction,
    ) -> list[Concept]:
        if await db.get(LearningSpace, space_id) is None:
            raise ValueError("Learning space not found.")

        requested_chunks = {
            chunk_id for concept in extraction.concepts for chunk_id in concept.source_chunk_ids
        }
        allowed_chunks: set[str] = set()
        if requested_chunks:
            result = await db.execute(
                select(DocumentChunk.id)
                .join(Document, Document.id == DocumentChunk.document_id)
                .where(Document.space_id == space_id, DocumentChunk.id.in_(requested_chunks))
            )
            allowed_chunks = set(result.scalars().all())

        existing = {item.name_key: item for item in await self.get_concepts(db, space_id)}
        for candidate in extraction.concepts:
            key = normalize_concept_name(candidate.name)
            concept = existing.get(key)
            if concept is None:
                concept = Concept(
                    space_id=space_id,
                    name=candidate.name,
                    name_key=key,
                    summary=candidate.summary,
                    difficulty=candidate.difficulty,
                )
                db.add(concept)
                existing[key] = concept
            else:
                if candidate.summary:
                    concept.summary = candidate.summary
                concept.difficulty = candidate.difficulty
        await db.flush()

        source_result = await db.execute(
            select(ConceptSource.concept_id, ConceptSource.chunk_id)
            .join(Concept, Concept.id == ConceptSource.concept_id)
            .where(Concept.space_id == space_id)
        )
        existing_sources = set(source_result.all())
        for candidate in extraction.concepts:
            concept = existing[normalize_concept_name(candidate.name)]
            for chunk_id in candidate.source_chunk_ids:
                key = (concept.id, chunk_id)
                if chunk_id in allowed_chunks and key not in existing_sources:
                    db.add(ConceptSource(concept_id=concept.id, chunk_id=chunk_id))
                    existing_sources.add(key)

        edge_result = await db.execute(
            select(
                ConceptEdge.source_concept_id,
                ConceptEdge.target_concept_id,
                ConceptEdge.relation,
            ).where(ConceptEdge.space_id == space_id)
        )
        existing_edges = set(edge_result.all())
        for relation in extraction.relations:
            source = existing.get(normalize_concept_name(relation.source))
            target = existing.get(normalize_concept_name(relation.target))
            if source is None or target is None or source.id == target.id:
                continue
            key = (source.id, target.id, relation.relation)
            if key not in existing_edges:
                db.add(ConceptEdge(
                    space_id=space_id,
                    source_concept_id=source.id,
                    target_concept_id=target.id,
                    relation=relation.relation,
                ))
                existing_edges.add(key)
        await db.flush()
        return list(existing.values())


knowledge_repository = KnowledgeRepository()
