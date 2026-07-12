# Attribution Classifier Service

A FastAPI microservice that classifies free-text task descriptions into workflow and task-type categories using TF-IDF + Logistic Regression.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Liveness check |
| POST | `/v1/classify` | Bearer token | Classify text |
| POST | `/v1/train` | Bearer token | Retrain model on current data |
| POST | `/v1/evaluate` | Bearer token | Evaluate model on holdout set |

## Setup

```bash
python3 -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

## Running

```bash
# Train model first
npm run train          # or: .venv/bin/python -m app.training

# Start server
npm run start          # or: uvicorn app.main:app --port 8100

# Run tests
npm run test

# Evaluate holdout metrics
npm run evaluate
```

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ATTRIBUTION_SERVICE_TOKEN` | Yes | — | Bearer token for protected endpoints |
| `ARTIFACTS_DIR` | No | `./artifacts` | Where trained models are stored |
| `MODEL_DATA_PATH` | No | `./data/base_training.jsonl` | Training data path |
| `HOLDOUT_DATA_PATH` | No | `./data/holdout_test.jsonl` | Holdout evaluation data path |

## Classification Response

```json
{
  "workflowExternalId": "blog-drafting",
  "workflowLabel": "Blog Drafting",
  "taskType": "research_note",
  "confidence": 0.87,
  "alternatives": {
    "workflow": [{"label": "seo-research", "confidence": 0.08}],
    "taskType": [{"label": "client_update", "confidence": 0.05}]
  },
  "modelVersion": "v1-20260711T152400Z",
  "requiresReview": false
}
```

`requiresReview` is `true` when `confidence < 0.65`.

## Model Architecture

- **Features**: TF-IDF over word unigrams+bigrams and character 2–4-grams (FeatureUnion)
- **Classifier**: `CalibratedClassifierCV(LogisticRegression(C=1.0, max_iter=1000, random_state=42))`
- Two independent pipelines: one for workflow, one for task_type
- Artifacts stored atomically under `artifacts/` and gitignored
