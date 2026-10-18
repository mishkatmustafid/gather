from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.errors import AppError
from app.models import User
from app.schemas import UserCreate, UserOut, LoginIn, TokenOut
from app.security import password_hash, DUMMY_HASH, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

BAD_LOGIN = AppError(401, "bad_credentials", "Email or password is incorrect.")


@router.post("/register", status_code=201, response_model=UserOut)
def register(body: UserCreate, db: DbSession):
    email = body.email.strip().lower()
    if db.scalar(select(User).where(User.email == email)):
        raise AppError(409, "email_taken", "An account with that email already exists.")
    user = User(
        email=email,
        password_hash=password_hash.hash(body.password),
        display_name=body.display_name.strip(),
    )
    db.add(user)
    db.commit()
    return user


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, db: DbSession):
    user = db.scalar(select(User).where(User.email == body.email.strip().lower()))
    if user is None:
        password_hash.verify(
            body.password, DUMMY_HASH
        )  # in order to keep timing similar
        raise BAD_LOGIN
    if not password_hash.verify(body.password, user.password_hash):
        raise BAD_LOGIN
    return TokenOut(access_token=create_access_token(user.id))


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user
