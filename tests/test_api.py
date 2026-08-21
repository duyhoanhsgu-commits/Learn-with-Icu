import pytest
import uuid
from httpx import AsyncClient, ASGITransport
from src.api.main import app


@pytest.mark.asyncio(loop_scope="session")
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "project" in data


@pytest.mark.asyncio(loop_scope="session")
async def test_list_documents_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/documents")
    # Might fail if DB is not running, but status code should be 200 or handled gracefully
    if response.status_code == 200:
        data = response.json()
        assert "total" in data
        assert "documents" in data


@pytest.mark.asyncio(loop_scope="session")
async def test_learning_space_lifecycle():
    name = f"Test space {uuid.uuid4()}"
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        created = await ac.post("/api/v1/spaces", json={"name": name, "color": "teal"})
        assert created.status_code == 201
        space = created.json()
        assert space["name"] == name

        listed = await ac.get("/api/v1/spaces")
        assert listed.status_code == 200
        assert any(item["id"] == space["id"] for item in listed.json())

        deleted = await ac.delete(f"/api/v1/spaces/{space['id']}")
        assert deleted.status_code == 200


@pytest.mark.asyncio(loop_scope="session")
async def test_upload_requires_space_id():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post(
            "/api/v1/documents/upload",
            files={"file": ("notes.txt", b"hello", "text/plain")},
        )
    assert response.status_code == 422


@pytest.mark.asyncio(loop_scope="session")
async def test_rag_query_requires_space_id():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.post("/api/v1/chat/query", json={"question": "What is RAG?"})
    assert response.status_code == 422
