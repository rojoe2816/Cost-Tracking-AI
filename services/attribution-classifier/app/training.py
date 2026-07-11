"""Training entrypoint.

Run as:  python -m app.training
Or via:  npm run train
"""
from __future__ import annotations

import json
import logging
import sys
import time
from pathlib import Path

from app.config import settings
from app.model import AttributionModel, set_active_model
from app.storage import save_model, load_model

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def load_jsonl(path: Path) -> list[dict]:
    records = []
    with open(path) as f:
        for lineno, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError as e:
                logger.warning("Skipping bad JSON at %s:%d — %s", path, lineno, e)
    return records


def train_from_file(data_path: Path | None = None) -> tuple[AttributionModel, float]:
    path = data_path or settings.model_data_path
    records = load_jsonl(path)
    if not records:
        raise ValueError(f"No training records found in {path}")

    logger.info("Loaded %d training records from %s", len(records), path)
    model = AttributionModel()
    t0 = time.perf_counter()
    version = model.train(records)
    duration = time.perf_counter() - t0
    logger.info("Training complete in %.2fs — version=%s", duration, version)

    save_model(model, version)
    set_active_model(model)
    logger.info("Model saved to %s", settings.artifacts_dir)
    return model, duration


def load_or_train() -> AttributionModel:
    """Load existing model or train from scratch."""
    payload, version = load_model()
    if payload is not None:
        logger.info("Loaded existing model version=%s", version)
        set_active_model(payload)
        return payload
    logger.info("No existing model found — training from %s", settings.model_data_path)
    model, _ = train_from_file()
    return model


def main() -> None:
    try:
        model, duration = train_from_file()
        print(f"Training complete: version={model.version}, samples={model.n_samples}, duration={duration:.2f}s")
    except Exception as e:
        logger.error("Training failed: %s", e)
        sys.exit(1)


if __name__ == "__main__":
    main()
