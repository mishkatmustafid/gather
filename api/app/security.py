from pwdlib import PasswordHash
from datetime import datetime, timedelta, timezone
import jwt
from app.config import settings

password_hash = PasswordHash.recommended()  # Argon2

ALGORITHM = "HS256"
ACCESS_TTL = timedelta(minutes=15)
DUMMY_HASH = password_hash.hash("not-a-real-password")


def create_access_token(user_id) -> str:
    now = datetime.now(timezone.utc)
    payload = {"sub": str(user_id), "iat": now, "exp": now + ACCESS_TTL}
    return jwt.encode(payload, settings.jwt_secret, algorithm=ALGORITHM)
