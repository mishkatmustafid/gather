import uuid
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator

class EventCreate(BaseModel):
  title: str = Field(min_length=3, max_length=120)
  description: str | None = None
  location: str = Field(min_length=1, max_length=200)
  starts_at: AwareDatetime
  ends_at: AwareDatetime
  capacity: int = Field(gt=0, le=10_000)

  @model_validator(mode="after")
  def check_times(self):
    if self.starts_at >= self.ends_at:
      raise ValueError("End time must be after the start time")
    return self

class EventUpdate(BaseModel):
  title: str | None = Field(default=None, min_length=3, max_length=120)
  description: str | None = None
  location: str | None = Field(default=None, min_length=1, max_length=200)
  starts_at: AwareDatetime | None = None
  ends_at: AwareDatetime | None = None
  capacity: int | None = Field(default=None, gt=0, le=10_000)

class EventOut(BaseModel):
  model_config = ConfigDict(from_attributes=True)

  id: uuid.UUID
  owner_id: uuid.UUID
  title: str
  description: str | None
  location: str
  starts_at: AwareDatetime
  ends_at: AwareDatetime
  capacity: int
  rsvp_count: int = 0
  i_am_going: bool = False

class EventPage(BaseModel):
  items: list[EventOut]
  total: int
  limit: int
  offset: int