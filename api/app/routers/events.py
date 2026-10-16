import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Query
from sqlalchemy import Select, func, or_, select

from app.deps import DbSession
from app.models import Event, RSVP
from app.schemas import EventOut, EventPage

router = APIRouter(prefix="/events", tags=["events"])

def events_with_counts() -> Select:
    count = func.count(RSVP.user_id).label("rsvp_count")
    return (
        select(
            Event,
            count,
        )
        .outerjoin(RSVP, RSVP.event_id == Event.id)
        .group_by(Event.id)
    )

def to_out(event: Event, rsvp_count: int, i_am_going: bool = False) -> EventOut:
    return EventOut.model_validate(event).model_copy(update={"rsvp_count": rsvp_count, "i_am_going": i_am_going})

@router.get("", response_model=EventPage)
def list_events(
    db: DbSession,
    q: str | None = None,
    from_: Annotated[datetime | None, Query(alias="from")] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
):
    stmt = events_with_counts()
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Event.title.ilike(like), Event.location.ilike(like)))
    if from_:
        stmt = stmt.where(Event.starts_at >= from_)

    total = db.scalar(select(func.count()).select_from(stmt.subquery()))
    rows = db.execute(stmt.order_by(Event.starts_at).limit(limit).offset(offset)).all()
    return EventPage(
        items = [to_out(e, c) for e, c in rows], total=total, limit=limit, offset=offset
    )