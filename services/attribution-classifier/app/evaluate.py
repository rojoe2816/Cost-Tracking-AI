"""Evaluation entrypoint.

Run as:  python -m app.evaluate
Or via:  npm run evaluate
"""
from __future__ import annotations

import json
import logging
import sys
from pathlib import Path

import numpy as np
from sklearn.metrics import accuracy_score, f1_score

from app.config import settings
from app.model import AttributionModel
from app.storage import load_model
from app.training import load_jsonl, load_or_train

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def top2_accuracy(proba: np.ndarray, labels: list[str], classes: list[str]) -> float:
    class_to_idx = {c: i for i, c in enumerate(classes)}
    correct = 0
    for prob_row, true_label in zip(proba, labels):
        top2 = np.argsort(prob_row)[-2:]
        true_idx = class_to_idx.get(true_label, -1)
        if true_idx in top2:
            correct += 1
    return correct / len(labels) if labels else 0.0


def evaluate(
    model: AttributionModel,
    holdout_path: Path | None = None,
) -> dict:
    path = holdout_path or settings.holdout_data_path
    records = load_jsonl(path)
    if not records:
        raise ValueError(f"No holdout records found in {path}")

    texts = [r["text"] for r in records]
    wf_true = [r["workflow"] for r in records]
    tt_true = [r["task_type"] for r in records]

    wf_pred = model.predict_batch_workflow(texts).tolist()
    tt_pred = model.predict_batch_task_type(texts).tolist()
    wf_proba = model.predict_proba_workflow(texts)
    tt_proba = model.predict_proba_task_type(texts)

    wf_acc = accuracy_score(wf_true, wf_pred)
    wf_f1 = f1_score(wf_true, wf_pred, average="macro", zero_division=0)
    wf_top2 = top2_accuracy(wf_proba, wf_true, model.workflow_classes)

    tt_acc = accuracy_score(tt_true, tt_pred)
    tt_f1 = f1_score(tt_true, tt_pred, average="macro", zero_division=0)
    tt_top2 = top2_accuracy(tt_proba, tt_true, model.task_type_classes)

    return {
        "modelVersion": model.version,
        "holdoutSamples": len(records),
        "workflowAccuracy": round(wf_acc, 4),
        "workflowMacroF1": round(wf_f1, 4),
        "workflowTop2Accuracy": round(wf_top2, 4),
        "taskTypeAccuracy": round(tt_acc, 4),
        "taskTypeMacroF1": round(tt_f1, 4),
        "taskTypeTop2Accuracy": round(tt_top2, 4),
    }


def main() -> None:
    try:
        payload, version = load_model()
        if payload is None:
            logger.info("No saved model found — training first")
            model = load_or_train()
        else:
            model = payload
        metrics = evaluate(model)
        print(json.dumps(metrics, indent=2))
    except Exception as e:
        logger.error("Evaluation failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
