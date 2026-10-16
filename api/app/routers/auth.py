from fastapi import APIRouter
from sqlalchemy import select

from app.deps import DbSession
from app.errors import AppError
from app.models import User
from app.schemas import UserCreate, UserOut
from app.security import password_hash

router = APIRouter(prefix='/auth', tags=["auth"])

@router.post("/register", status_code=201, response_model=UserOut)
def register(body: UserCreate, db: DbSession):
  email = body.email.strip().lower()
  if db.scalar(select(User).where(User.email == email)):
    raise AppError(409, "email_taken", "An account with that email already exists.")
  user = User(
    email = email,
    password_hash = password_hash.hash(body.password),
    display_name = body.display_name.strip()
  )
  db.add(user)
  db.commit()
  return user