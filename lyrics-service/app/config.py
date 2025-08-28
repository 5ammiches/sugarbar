from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    genius_client_access_token: str = ""
    genius_client_id: str = ""
    genius_client_secret: str = ""
    musixmatch_profile_path: str = ""

    model_config = SettingsConfigDict(env_file=".env")
