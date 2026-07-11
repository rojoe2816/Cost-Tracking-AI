from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    attribution_service_token: str = "dev-token-insecure"
    artifacts_dir: Path = Path("artifacts")
    model_data_path: Path = Path("data/base_training.jsonl")
    holdout_data_path: Path = Path("data/holdout_test.jsonl")
    max_input_chars: int = 8_000


settings = Settings()
