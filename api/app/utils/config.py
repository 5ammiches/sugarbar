from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    genius_client_access_token: str = ""
    genius_client_id: str = ""
    genius_client_secret: str = ""
    musixmatch_profile_path: str = ""
    youtube_api_key: str = ""
    youtube_cookies_path: str = ""
    cf_client_id: str = ""
    cf_client_secret: str = ""

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


@lru_cache
def get_settings() -> Settings:
    return Settings()
