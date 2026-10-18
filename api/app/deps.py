import uuid, jwt
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.config import settings
from app.errors import AppError
from app.models import User
from app.security import ALGORITHM

bearer = HTTPBearer(auto_error=False)
CHALLENGE = {"WWW-Authenticate": "Bearer"}


def get_db():
    with SessionLocal() as db:
        yield db  # closed (and rolled back if uncommitted) after the response


DbSession = Annotated[Session, Depends(get_db)]


def get_optional_user(
    db: DbSession,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User | None:
    if creds is None:
        return None
    try:
        payload = jwt.decode(
            creds.credentials, settings.jwt_secret, algorithms=[ALGORITHM]
        )
    except jwt.ExpiredSignatureError:
        raise AppError(
            401, "token_expired", "Your session has expired. Log in again.", CHALLENGE
        )
    except jwt.InvalidTokenError:
        raise AppError(401, "invalid_token", "Log in again", CHALLENGE)
    user = db.get(User, uuid.UUID(payload["sub"]))
    if user is None:
        raise AppError(401, "invalid_token", "Log in again.", CHALLENGE)
    return user


def get_current_user(user: Annotated[User | None, Depends(get_optional_user)]) -> User:
    if user is None:
        raise AppError(401, "not_authenticated", "Log in to do that.", CHALLENGE)
    return user


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
