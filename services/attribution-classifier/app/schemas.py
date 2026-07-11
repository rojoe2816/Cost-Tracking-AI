from __future__ import annotations

from typing import Optional
from pydantic import BaseModel, Field, field_validator


class ClassifyRequest(BaseModel):
    text: str = Field(..., min_length=1, description="Text to classify")
    allowedWorkflows: Optional[list[str]] = Field(
        None, description="Restrict workflow prediction to these labels"
    )
    allowedTaskTypes: Optional[list[str]] = Field(
        None, description="Restrict task-type prediction to these labels"
    )

    @field_validator("text")
    @classmethod
    def text_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("text must not be blank")
        return v


class LabelScore(BaseModel):
    label: str
    confidence: float = Field(..., ge=0.0, le=1.0)


class AlternativesBundle(BaseModel):
    workflow: list[LabelScore]
    taskType: list[LabelScore]


class ClassifyResponse(BaseModel):
    workflowExternalId: str
    workflowLabel: str
    taskType: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    alternatives: AlternativesBundle
    modelVersion: str
    requiresReview: bool


class TrainResponse(BaseModel):
    modelVersion: str
    trainingSamples: int
    durationSeconds: float


class EvaluateResponse(BaseModel):
    modelVersion: str
    holdoutSamples: int
    workflowAccuracy: float
    workflowMacroF1: float
    workflowTop2Accuracy: float
    taskTypeAccuracy: float
    taskTypeMacroF1: float
    taskTypeTop2Accuracy: float


class HealthResponse(BaseModel):
    status: str
    modelVersion: Optional[str] = None
