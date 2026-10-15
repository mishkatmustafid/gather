import sys
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.config import settings
from app.db import SessionLocal
from app.models import User, Event, RSVP
from app.security import password_hash

TITLES = [
    "Board games night", "Park run", "Python study group", "Italian conversation",
    "Book swap", "Pottery taster", "Five-a-side football", "Coding dojo",
    "Photo walk", "Quiz night", "Volunteer litter pick", "Chess club",
]

def main() -> None:
  if not any(h in settings.database_url for h in ("localhost", "127.0.0.1")):
    sys.exit("Refusing to seed non-local database. Edit .env to point to a local database and try again.")

  now = datetime.now(timezone.utc)
  with SessionLocal() as db:
    db.execute(text("TRUNCATE users, events, rsvps CASCADE"))

    pw = password_hash.hash("password123")
    amira = User(email="amira@example.com", password_hash=pw, display_name="Amira")
    ben = User(email="ben@example.com", password_hash=pw, display_name="Ben")
    chen = User(email="chen@example.com", password_hash=pw, display_name="Chen")
    users = [amira, ben, chen]
    db.add_all(users)
    db.flush() # sends INSERTs so the database-generated ids are available

    events = []
    for i, title in enumerate(TITLES):
      start = now + timedelta(days=i-2) # the first two events are in the past
      events.append(Event(
        owner_id=users[i % len(users)].id,
        title=title,
        description=f"Description for {title}",
        location=f"Location for {title}",
        starts_at=start,
        ends_at=start + timedelta(hours=3),
        capacity=2 if i == 5 else 20, # event 5 will be full
      ))
    db.add_all(events)
    db.flush()

    db.add_all([
      RSVP(user_id=amira.id, event_id=events[5].id),
      RSVP(user_id=ben.id, event_id=events[5].id),
      RSVP(user_id=chen.id, event_id=events[3].id),
    ])
    db.commit()
  print(f"Seeded {len(users)} users, {len(events)} events, and 3 RSVPs.")
if __name__ == "__main__":
  main()