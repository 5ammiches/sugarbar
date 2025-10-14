from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    genius_client_access_token: str = ""
    genius_client_id: str = ""
    genius_client_secret: str = ""
    musixmatch_profile_path: str = ""
    youtube_api_key: str = ""

    model_config = SettingsConfigDict(env_file=".env")

@lru_cache
def get_settings() -> Settings:
    return Settings()
