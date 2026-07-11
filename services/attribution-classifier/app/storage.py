"""Atomic artifact storage: write to temp file, then rename."""
from __future__ import annotations

import os
import tempfile
from pathlib import Path

import joblib

from app.config import settings

_ACTIVE_FILENAME = "model_active.joblib"
_VERSION_FILENAME = "model_version.txt"


def artifacts_dir() -> Path:
    d = Path(settings.artifacts_dir)
    d.mkdir(parents=True, exist_ok=True)
    return d


def save_model(payload: object, version: str) -> Path:
    """Atomically persist *payload* and record *version*."""
    d = artifacts_dir()
    # Write model
    model_path = d / _ACTIVE_FILENAME
    with tempfile.NamedTemporaryFile(dir=d, suffix=".tmp", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        joblib.dump(payload, tmp_path, compress=3)
        os.replace(tmp_path, model_path)
    except Exception:
        tmp_path.unlink(missing_ok=True)
        raise
    # Write version marker
    version_path = d / _VERSION_FILENAME
    with tempfile.NamedTemporaryFile(
        dir=d, suffix=".tmp", mode="w", delete=False
    ) as tmp:
        tmp.write(version)
        tmp_path2 = Path(tmp.name)
    try:
        os.replace(tmp_path2, version_path)
    except Exception:
        Path(tmp_path2).unlink(missing_ok=True)
        raise
    return model_path


def load_model() -> tuple[object, str] | tuple[None, None]:
    """Return (payload, version) or (None, None) if no model stored yet."""
    d = artifacts_dir()
    model_path = d / _ACTIVE_FILENAME
    version_path = d / _VERSION_FILENAME
    if not model_path.exists():
        return None, None
    version = version_path.read_text().strip() if version_path.exists() else "unknown"
    payload = joblib.load(model_path)
    return payload, version


def active_version() -> str | None:
    d = artifacts_dir()
    p = d / _VERSION_FILENAME
    return p.read_text().strip() if p.exists() else None
