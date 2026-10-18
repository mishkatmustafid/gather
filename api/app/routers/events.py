import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Response, Query
from sqlalchemy import Select, func, or_, select

from app.deps import DbSession, OptionalUser, CurrentUser
from app.models import Event, RSVP, User
from app.schemas import EventOut, EventPage, EventCreate, EventUpdate
from app.errors import AppError


router = APIRouter(prefix="/events", tags=["events"])

# ---------- shared helpers ----------

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

def load_event(db, event_id: uuid.UUID) -> Event:
    event = db.get(Event, event_id)
    if event is None:
        raise AppError(404, "event_not_found", "No event with that id.")
    return event

def load_event_out(db, event_id: uuid.UUID, user: User | None) -> EventOut:
    row = db.execute(events_with_counts().where(Event.id == event_id)).first()
    if row is None:
        raise AppError(404, "event_not_found", "No event with that id.")
    event, rsvp_count = row
    i_am_going = user is not None and db.get(RSVP,  (user.id, event_id)) is not None
    return to_out(event, rsvp_count, i_am_going)

def load_owned_event(db, event_id: uuid.UUID, user: User) -> Event:
    event = load_event(db, event_id)
    if event.owner_id != user.id:
        raise AppError(403, "not_owner", "Only the host can change this event.")
    return event

# ---------- routes ----------

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



@router.get("/{event_id}", response_model=EventOut)
def get_event(event_id: uuid.UUID, db: DbSession, user: OptionalUser):
    return load_event_out(db, event_id, user)

@router.post("", status_code=201, response_model=EventOut)
def create_event(body: EventCreate, user: CurrentUser, db: DbSession, response: Response):
    # owner = db.scalars(select(User)).first() # Temporary: first user is owner, will replace with logged-in user
    event = Event(**body.model_dump(), owner_id=user.id)
    db.add(event)
    db.commit()
    db.refresh(event)
    response.headers["Location"] = f"/events/{event.id}"
    return to_out(event, 0)

@router.patch("/{event_id}", response_model=EventOut)
def update_event(event_id: uuid.UUID, body: EventUpdate, db: DbSession, user: CurrentUser):
    event = load_owned_event(db, event_id, user)
    changes = body.model_dump(exclude_unset=True)
    for field, value in changes.items():
        setattr(event, field, value)
    if event.ends_at <= event.starts_at:
        raise AppError(422, "validation_error", "End time must be after the start time")
    db.commit()
    return load_event_out(db, event_id, user)

@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: uuid.UUID, db: DbSession, user: CurrentUser):
    db.delete(load_owned_event(db, event_id, user))
    db.commit()

@router.post("/{event_id}/rsvp", status_code=201)
def rsvp(event_id: uuid.UUID, db: DbSession, user: CurrentUser):
    # Locks this event's row until commit, so concurrent RSVPs queue up here
    event = db.scalar(select(Event).where(Event.id == event_id).with_for_update())
    if event is None:
        raise AppError(404, "event_not_found", "No event with that id.")
    if event.starts_at <= datetime.now(timezone.utc):
        raise AppError(409, "event_started", "This event has already started.")
    if db.get(RSVP, (user.id, event.id)):
        raise AppError(409, "already_going", "You're already going to this event.")
    going = db.scalar(select(func.count()).select_from(RSVP).where(RSVP.event_id == event_id))
    if going >= event.capacity:
        raise AppError(409, "event_full", "This event is full.")
    db.add(RSVP(user_id=user.id, event_id=event.id))
    db.commit() # Release the lock
    return {"status": "going"}

@router.delete("/{event_id}/rsvp", status_code=204)
def cancel_rsvp(event_id: uuid.UUID, db: DbSession, user: CurrentUser):
    rsvp = db.get(RSVP, (user.id, event_id))
    if rsvp is None:
        raise AppError(404, "not_going", "You aren't going to this event.")
    db.delete(rsvp)
    db.commit()