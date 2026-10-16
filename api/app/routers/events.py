import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Response, Query
from sqlalchemy import Select, func, or_, select

from app.deps import DbSession, OptionalUser
from app.models import Event, RSVP, User
from app.schemas import EventOut, EventPage, EventCreate, EventUpdate
from app.errors import AppError


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
    stmt = select(Event)
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

# def load_event(db, event_id: uuid.UUID) -> Event:
#     event = db.get(Event, event_id)
#     if event is None:
#         raise AppError(404, "event_not_found", "No event with that id.")
#     return event

def load_event_out(db, event_id: uuid.UUID, user: User | None) -> EventOut:
    row = db.execute(events_with_counts().where(Event.id == event_id)).first()
    if row is None:
        raise AppError(404, "event_not_found", "No event with that id.")
    event, rsvp_count = row
    i_am_going = user is not None and db.get(RSVP,  (user.id, event_id)) is not None
    return to_out(event, rsvp_count, i_am_going)

@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: uuid.UUID, db: DbSession, user: OptionalUser):
    row = db.execute(events_with_counts().where(Event.id == event_id)).first()
    if row is None:
        raise AppError(404, "event_not_found", "No event with that id.")
    return to_out(*row)

@router.post("", status_code=201, response_model=EventOut)
def create_event(body: EventCreate, db: DbSession, response: Response):
    owner = db.scalars(select(User)).first() # Temporary: first user is owner, will replace with logged-in user
    event = Event(**body.model_dump(), owner_id=owner.id)
    db.add(event)
    db.commit()
    db.refresh(event)
    response.headers["Location"] = f"/events/{event.id}"
    return to_out(event, 0)

@router.patch("/{event_id}", response_model=EventOut)
def update_event(event_id: uuid.UUID, body: EventUpdate, db: DbSession):
    event = load_event_out(db, event_id, None)
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(event, field, value)
    if event.ends_at <= event.starts_at:
        raise AppError(422, "validation_error", "End time must be after the start time")
    db.commit()
    return get_event(event_id, db, None)

@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: uuid.UUID, db: DbSession):
    db.delete(load_event_out(db, event_id, None))
    db.commit()