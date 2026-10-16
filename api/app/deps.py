from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from app.db import SessionLocal

def get_db():
  with SessionLocal() as db:
    yield db # closed (and rolled back if uncommitted) after the response

DbSession = Annotated[Session, Depends(get_db)]