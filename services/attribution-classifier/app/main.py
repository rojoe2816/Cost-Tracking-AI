"""FastAPI application."""
from __future__ import annotations

import logging
import time
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, HTTPException, status

from app.auth import require_token
from app.config import settings
from app.evaluate import evaluate as run_evaluate
from app.model import get_active_model
from app.schemas import (
    AlternativesBundle,
    ClassifyRequest,
    ClassifyResponse,
    EvaluateResponse,
    HealthResponse,
    LabelScore,
    TrainResponse,
)
from app.storage import active_version
from app.training import load_or_train, train_from_file

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_or_train()
    yield


app = FastAPI(title="Attribution Classifier", version="0.1.0", lifespan=lifespan)


@app.get("/health", response_model=HealthResponse, tags=["ops"])
def health() -> HealthResponse:
    model = get_active_model()
    return HealthResponse(
        status="ok",
        modelVersion=model.version if model else None,
    )


@app.post(
    "/v1/classify",
    response_model=ClassifyResponse,
    dependencies=[Depends(require_token)],
    tags=["inference"],
)
def classify(req: ClassifyRequest) -> ClassifyResponse:
    if len(req.text) > settings.max_input_chars:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Input exceeds maximum length of {settings.max_input_chars} characters",
        )

    model = get_active_model()
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not available — run /v1/train first",
        )

    result = model.predict(
        req.text,
        allowed_workflows=req.allowedWorkflows,
        allowed_task_types=req.allowedTaskTypes,
    )

    alts = result["alternatives"]
    return ClassifyResponse(
        workflowExternalId=result["workflowExternalId"],
        workflowLabel=result["workflowLabel"],
        taskType=result["taskType"],
        confidence=result["confidence"],
        alternatives=AlternativesBundle(
            workflow=[LabelScore(**a) for a in alts["workflow"]],
            taskType=[LabelScore(**a) for a in alts["taskType"]],
        ),
        modelVersion=result["modelVersion"],
        requiresReview=result["requiresReview"],
    )


@app.post(
    "/v1/train",
    response_model=TrainResponse,
    dependencies=[Depends(require_token)],
    tags=["admin"],
)
def train() -> TrainResponse:
    model, duration = train_from_file()
    return TrainResponse(
        modelVersion=model.version,
        trainingSamples=model.n_samples,
        durationSeconds=round(duration, 3),
    )


@app.post(
    "/v1/evaluate",
    response_model=EvaluateResponse,
    dependencies=[Depends(require_token)],
    tags=["admin"],
)
def evaluate_endpoint() -> EvaluateResponse:
    model = get_active_model()
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not available — run /v1/train first",
        )
    metrics = run_evaluate(model)
    return EvaluateResponse(**metrics)


def serve() -> None:
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8100, reload=False)


if __name__ == "__main__":
    serve()
