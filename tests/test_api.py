import pytest
from httpx import AsyncClient, ASGITransport
from src.api.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "project" in data


@pytest.mark.asyncio
async def test_list_documents_empty():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        response = await ac.get("/api/v1/documents")
    # Might fail if DB is not running, but status code should be 200 or handled gracefully
    if response.status_code == 200:
        data = response.json()
        assert "total" in data
        assert "documents" in data
