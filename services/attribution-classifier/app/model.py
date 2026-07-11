"""TF-IDF + Logistic Regression attribution classifier."""
from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import FeatureUnion, Pipeline
from sklearn.preprocessing import LabelEncoder
from sklearn.feature_extraction.text import TfidfVectorizer

logger = logging.getLogger(__name__)

REQUIRES_REVIEW_THRESHOLD = 0.65
TOP_N_ALTERNATIVES = 3


def _make_pipeline() -> Pipeline:
    tfidf = FeatureUnion([
        ("word", TfidfVectorizer(
            analyzer="word",
            ngram_range=(1, 2),
            sublinear_tf=True,
            max_features=30_000,
            min_df=1,
        )),
        ("char", TfidfVectorizer(
            analyzer="char_wb",
            ngram_range=(2, 4),
            sublinear_tf=True,
            max_features=30_000,
            min_df=1,
        )),
    ])
    base_lr = LogisticRegression(
        C=8.0,
        max_iter=2_000,
        random_state=42,
        solver="lbfgs",
        class_weight="balanced",
    )
    clf = CalibratedClassifierCV(base_lr, cv=3, method="sigmoid")
    return Pipeline([("tfidf", tfidf), ("clf", clf)])


class AttributionModel:
    """Holds two independent pipelines: workflow and task_type."""

    def __init__(self) -> None:
        self.workflow_pipeline: Pipeline | None = None
        self.task_type_pipeline: Pipeline | None = None
        self.workflow_classes: list[str] = []
        self.task_type_classes: list[str] = []
        self.version: str = ""
        self.n_samples: int = 0

    # ------------------------------------------------------------------
    # Training
    # ------------------------------------------------------------------

    def train(self, records: list[dict[str, Any]]) -> str:
        texts = [r["text"] for r in records]
        workflows = [r["workflow"] for r in records]
        task_types = [r["task_type"] for r in records]

        self.workflow_pipeline = _make_pipeline()
        self.workflow_pipeline.fit(texts, workflows)
        self.workflow_classes = list(self.workflow_pipeline.named_steps["clf"].classes_)

        self.task_type_pipeline = _make_pipeline()
        self.task_type_pipeline.fit(texts, task_types)
        self.task_type_classes = list(self.task_type_pipeline.named_steps["clf"].classes_)

        self.n_samples = len(records)
        self.version = self._make_version(records)
        logger.info(
            "Model trained: %d samples, %d workflows, %d task_types, version=%s",
            self.n_samples,
            len(self.workflow_classes),
            len(self.task_type_classes),
            self.version,
        )
        return self.version

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def predict(
        self,
        text: str,
        allowed_workflows: list[str] | None = None,
        allowed_task_types: list[str] | None = None,
    ) -> dict[str, Any]:
        if not self.workflow_pipeline or not self.task_type_pipeline:
            raise RuntimeError("Model not trained yet")

        wf_proba = self.workflow_pipeline.predict_proba([text])[0]
        tt_proba = self.task_type_pipeline.predict_proba([text])[0]

        wf_label, wf_conf, wf_alts = self._top_label(
            wf_proba, self.workflow_classes, allowed_workflows
        )
        tt_label, tt_conf, tt_alts = self._top_label(
            tt_proba, self.task_type_classes, allowed_task_types
        )

        confidence = float(min(wf_conf, tt_conf))

        return {
            "workflowExternalId": wf_label,
            "workflowLabel": _to_display(wf_label),
            "taskType": tt_label,
            "confidence": round(confidence, 4),
            "alternatives": {
                "workflow": wf_alts,
                "taskType": tt_alts,
            },
            "modelVersion": self.version,
            "requiresReview": confidence < REQUIRES_REVIEW_THRESHOLD,
        }

    # ------------------------------------------------------------------
    # Evaluation helpers
    # ------------------------------------------------------------------

    def predict_batch_workflow(self, texts: list[str]) -> np.ndarray:
        return self.workflow_pipeline.predict(texts)

    def predict_batch_task_type(self, texts: list[str]) -> np.ndarray:
        return self.task_type_pipeline.predict(texts)

    def predict_proba_workflow(self, texts: list[str]) -> np.ndarray:
        return self.workflow_pipeline.predict_proba(texts)

    def predict_proba_task_type(self, texts: list[str]) -> np.ndarray:
        return self.task_type_pipeline.predict_proba(texts)

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    @staticmethod
    def _top_label(
        proba: np.ndarray,
        classes: list[str],
        allowed: list[str] | None,
    ) -> tuple[str, float, list[dict]]:
        pairs = sorted(zip(classes, proba.tolist()), key=lambda x: -x[1])
        if allowed:
            allowed_set = set(allowed)
            valid = [(lbl, c) for lbl, c in pairs if lbl in allowed_set]
            if not valid:
                valid = pairs  # fall back to unconstrained
            pairs = valid
        top_label, top_conf = pairs[0]
        alts = [
            {"label": lbl, "confidence": round(c, 4)}
            for lbl, c in pairs[1 : TOP_N_ALTERNATIVES + 1]
        ]
        return top_label, float(top_conf), alts

    @staticmethod
    def _make_version(records: list[dict]) -> str:
        digest = hashlib.sha256(
            json.dumps(records[:5], sort_keys=True).encode()
        ).hexdigest()[:8]
        ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        return f"v1-{ts}-{digest}"


# Module-level singleton loaded on startup
_active: AttributionModel | None = None
_active_version: str | None = None


def get_active_model() -> AttributionModel | None:
    return _active


def set_active_model(model: AttributionModel) -> None:
    global _active, _active_version
    _active = model
    _active_version = model.version


def _to_display(slug: str) -> str:
    return slug.replace("-", " ").replace("_", " ").title()
