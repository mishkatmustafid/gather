from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import IntegrityError

class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, headers: dict | None = None):
        self.status, self.code, self.message, self.headers = status, code, message, headers

def body(code: str, message: str, fields: dict | None = None) -> dict:
    err = {"code": code, "message": message}
    if fields:
        err["fields"] = fields
    return {"error": err}

def register_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def app_error(_: Request, exc: AppError):
        return JSONResponse(body(exc.code, exc.message), exc.status, headers=exc.headers)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, exc: RequestValidationError):
        fields = {}
        for e in exc.errors():
            key = ".".join(str(p) for p in e["loc"][1:]) or "_form"
            fields[key] = e["msg"].removeprefix("Value error, ")
        return JSONResponse(body("validation_error", "Some fields are invalid.", fields), 422)

    @app.exception_handler(IntegrityError)
    async def integrity_error(_: Request, exc: IntegrityError):
        return JSONResponse(body("conflict", "That conflicts with existing data."), 409)