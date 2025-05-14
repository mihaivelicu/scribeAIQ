# backend/config.py
import os
from pathlib import Path
from dotenv import load_dotenv, find_dotenv   # pip install python-dotenv

# 1) Load .env if it exists anywhere up the tree -------------------
load_dotenv(find_dotenv())   # no error if the file doesn't exist

# 2) Helper --------------------------------------------------------
def must_get(var: str) -> str:
    value = os.getenv(var)
    if not value:
        raise RuntimeError(f"Environment variable '{var}' is required.")
    return value

# 3) Config values -------------------------------------------------
DATABASE_URI         = must_get("DATABASE_URI")
OPENAI_API_KEY       = must_get("OPENAI_API_KEY")
AUDIO_UPLOAD_FOLDER  = os.getenv("AUDIO_UPLOAD_FOLDER",
                                 "/var/www/scrib/audio_uploads")
