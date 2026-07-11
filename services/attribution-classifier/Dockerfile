FROM python:3.12-slim

WORKDIR /service

COPY pyproject.toml .
RUN pip install --no-cache-dir -e .

COPY app/ app/
COPY data/ data/

ENV ATTRIBUTION_SERVICE_TOKEN=changeme
ENV ARTIFACTS_DIR=/service/artifacts
ENV MODEL_DATA_PATH=/service/data/base_training.jsonl

RUN mkdir -p /service/artifacts

EXPOSE 8100

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8100"]
