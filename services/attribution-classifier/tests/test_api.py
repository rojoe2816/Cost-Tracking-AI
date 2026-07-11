"""Integration tests for the attribution classifier API."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient

# ── isolate artifacts to a temp dir so tests don't pollute the real store ──
_TMP_DIR = tempfile.mkdtemp(prefix="attr_test_artifacts_")

os.environ.setdefault("ATTRIBUTION_SERVICE_TOKEN", "test-token-abc")
os.environ["ARTIFACTS_DIR"] = _TMP_DIR

from app.main import app  # noqa: E402  (must come after env setup)
from app.training import train_from_file  # noqa: E402

DATA_DIR = Path(__file__).parent.parent / "data"
TOKEN = "test-token-abc"
BAD_TOKEN = "wrong-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
BAD_AUTH = {"Authorization": f"Bearer {BAD_TOKEN}"}


# ── fixtures ──────────────────────────────────────────────────────────────────


@pytest.fixture(scope="session", autouse=True)
def train_model():
    """Train a real model once for the entire test session."""
    with patch("app.config.settings.attribution_service_token", TOKEN), \
         patch("app.config.settings.artifacts_dir", Path(_TMP_DIR)):
        train_from_file(DATA_DIR / "base_training.jsonl")


@pytest_asyncio.fixture
async def client():
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as c:
        yield c


# ── /health ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_health_no_auth(client: AsyncClient):
    r = await client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"


@pytest.mark.asyncio
async def test_health_has_model_version(client: AsyncClient):
    r = await client.get("/health")
    body = r.json()
    assert body["modelVersion"] is not None
    assert body["modelVersion"].startswith("v1-")


# ── /v1/classify — auth ────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_classify_missing_token(client: AsyncClient):
    r = await client.post("/v1/classify", json={"text": "hello"})
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_classify_invalid_token(client: AsyncClient):
    r = await client.post(
        "/v1/classify", json={"text": "hello"}, headers=BAD_AUTH
    )
    assert r.status_code == 401


# ── /v1/classify — input validation ───────────────────────────────────────────


@pytest.mark.asyncio
async def test_classify_empty_text(client: AsyncClient):
    r = await client.post("/v1/classify", json={"text": ""}, headers=AUTH)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_classify_blank_whitespace(client: AsyncClient):
    r = await client.post("/v1/classify", json={"text": "   "}, headers=AUTH)
    assert r.status_code == 422


@pytest.mark.asyncio
async def test_classify_oversized_input(client: AsyncClient):
    r = await client.post(
        "/v1/classify", json={"text": "x" * 9_000}, headers=AUTH
    )
    assert r.status_code == 422


# ── /v1/classify — output shape ────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_classify_returns_expected_fields(client: AsyncClient):
    r = await client.post(
        "/v1/classify",
        json={"text": "Drafted the blog post on content marketing strategy, still need to add the conclusion."},
        headers=AUTH,
    )
    assert r.status_code == 200
    body = r.json()
    assert "workflowExternalId" in body
    assert "workflowLabel" in body
    assert "taskType" in body
    assert "confidence" in body
    assert "alternatives" in body
    assert "modelVersion" in body
    assert "requiresReview" in body


@pytest.mark.asyncio
async def test_classify_confidence_bounds(client: AsyncClient):
    r = await client.post(
        "/v1/classify",
        json={"text": "Sent the project status update to the client with all milestone progress."},
        headers=AUTH,
    )
    body = r.json()
    conf = body["confidence"]
    assert 0.0 <= conf <= 1.0


@pytest.mark.asyncio
async def test_classify_requires_review_flag_type(client: AsyncClient):
    r = await client.post(
        "/v1/classify",
        json={"text": "Wrote keyword research analysis comparing top competitors."},
        headers=AUTH,
    )
    body = r.json()
    assert isinstance(body["requiresReview"], bool)


@pytest.mark.asyncio
async def test_classify_alternatives_structure(client: AsyncClient):
    r = await client.post(
        "/v1/classify",
        json={"text": "Completed the SEO audit and found 23 issues with crawl budget."},
        headers=AUTH,
    )
    body = r.json()
    alts = body["alternatives"]
    assert "workflow" in alts
    assert "taskType" in alts
    for item in alts["workflow"]:
        assert "label" in item
        assert "confidence" in item
        assert 0.0 <= item["confidence"] <= 1.0
    for item in alts["taskType"]:
        assert "label" in item
        assert "confidence" in item
        assert 0.0 <= item["confidence"] <= 1.0


# ── /v1/classify — label filtering ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_classify_allowed_workflows_respected(client: AsyncClient):
    allowed = ["blog-drafting", "seo-research"]
    r = await client.post(
        "/v1/classify",
        json={
            "text": "Processed the Q3 vendor invoices and found two billing discrepancies.",
            "allowedWorkflows": allowed,
        },
        headers=AUTH,
    )
    body = r.json()
    assert body["workflowExternalId"] in allowed


@pytest.mark.asyncio
async def test_classify_allowed_task_types_respected(client: AsyncClient):
    allowed = ["client_update", "research_note"]
    r = await client.post(
        "/v1/classify",
        json={
            "text": "Ran keyword research and identified 40 low-competition targets.",
            "allowedTaskTypes": allowed,
        },
        headers=AUTH,
    )
    body = r.json()
    assert body["taskType"] in allowed


@pytest.mark.asyncio
async def test_classify_empty_allowed_list_falls_back(client: AsyncClient):
    """An empty allowedWorkflows list should not crash — model falls back to unconstrained."""
    r = await client.post(
        "/v1/classify",
        json={"text": "Completed the first draft of the blog article.", "allowedWorkflows": []},
        headers=AUTH,
    )
    assert r.status_code == 200


# ── /v1/classify — known patterns ────────────────────────────────────────────


@pytest.mark.asyncio
async def test_classify_blog_drafting(client: AsyncClient):
    r = await client.post(
        "/v1/classify",
        json={"text": "Finished the third revision of the article. The introduction and conclusion are polished but the middle section needs more supporting evidence before final review."},
        headers=AUTH,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["workflowExternalId"] == "blog-drafting"


@pytest.mark.asyncio
async def test_classify_seo_research(client: AsyncClient):
    r = await client.post(
        "/v1/classify",
        json={"text": "Keyword analysis complete. Found 28 high-intent queries with search volume above 1,000 and difficulty below 40. Competitors are ranking for most of them with thin content."},
        headers=AUTH,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["workflowExternalId"] == "seo-research"


@pytest.mark.asyncio
async def test_classify_meeting_summary(client: AsyncClient):
    r = await client.post(
        "/v1/classify",
        json={"text": "Meeting recap: discussed Q3 roadmap, assigned owners to the five open action items, and scheduled a follow-up for next Thursday."},
        headers=AUTH,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["workflowExternalId"] == "meeting-summary"


# ── /v1/train ─────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_train_requires_auth(client: AsyncClient):
    r = await client.post("/v1/train")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_train_returns_version(client: AsyncClient):
    r = await client.post("/v1/train", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    assert "modelVersion" in body
    assert body["trainingSamples"] > 0
    assert body["durationSeconds"] >= 0


# ── /v1/evaluate ──────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_evaluate_requires_auth(client: AsyncClient):
    r = await client.post("/v1/evaluate")
    assert r.status_code in (401, 403)


@pytest.mark.asyncio
async def test_evaluate_returns_metrics(client: AsyncClient):
    r = await client.post("/v1/evaluate", headers=AUTH)
    assert r.status_code == 200
    body = r.json()
    for key in (
        "workflowAccuracy",
        "workflowMacroF1",
        "workflowTop2Accuracy",
        "taskTypeAccuracy",
        "taskTypeMacroF1",
        "taskTypeTop2Accuracy",
    ):
        assert key in body
        assert 0.0 <= body[key] <= 1.0


@pytest.mark.asyncio
async def test_evaluate_f1_above_threshold(client: AsyncClient):
    """Smoke test that the model meets minimum quality bar."""
    r = await client.post("/v1/evaluate", headers=AUTH)
    body = r.json()
    assert body["workflowMacroF1"] >= 0.50, f"workflow F1 too low: {body['workflowMacroF1']}"
    assert body["taskTypeMacroF1"] >= 0.50, f"task_type F1 too low: {body['taskTypeMacroF1']}"
