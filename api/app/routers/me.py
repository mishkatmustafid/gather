from typing import Literal

from fastapi import APIRouter
from sqlalchemy import select

from app.deps import CurrentUser, DbSession
from app.models import RSVP, Event
from app.routers.events import events_with_counts, to_out
from app.schemas import EventOut

router = APIRouter(prefix="/me", tags=["me"])

@router.get("/events", response_model=list[EventOut])
def get_my_events(db: DbSession, user: CurrentUser, role: Literal["hosting", "attending"] = "hosting"):
  my_rsvp_ids = select(RSVP.event_id).where(RSVP.user_id == user.id)

  stmt = events_with_counts() # Query has not run yet
  if role == "hosting":
    stmt = stmt.where(Event.owner_id == user.id)
  else:
    stmt = stmt.where(Event.id.in_(my_rsvp_ids))

  rows = db.execute(stmt.order_by(Event.starts_at)).all()
  going = set(db.scalars(my_rsvp_ids))
  return [to_out(e, c, i_am_going=e.id in going) for e, c in rows]