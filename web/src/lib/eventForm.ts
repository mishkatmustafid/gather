import { fromInputValue, toInputValue } from "./dates";
import type { GatherEvent } from "./types";

export type EventValues = {
  title: string;
  description: string;
  location: string;
  starts_at: string; // "YYYY-MM-DDTHH:mm" — what <input type="datetime-local"> uses
  ends_at: string;
  capacity: string; // inputs give strings; converted to a number on submit
};

export type EventPayload = {
  title: string;
  description: string | null;
  location: string;
  starts_at: string; // ISO with time zone, as the API requires
  ends_at: string;
  capacity: number;
};

export type EventErrors = Partial<Record<keyof EventValues | "_form", string>>;

export const emptyEventValues: EventValues = {
  title: "",
  description: "",
  location: "",
  starts_at: "",
  ends_at: "",
  capacity: "",
};

export function eventToValues(event: GatherEvent): EventValues {
  return {
    title: event.title,
    description: event.description ?? "",
    location: event.location,
    starts_at: toInputValue(event.starts_at),
    ends_at: toInputValue(event.ends_at),
    capacity: String(event.capacity),
  };
}

// Mirrors the API's rules, so most mistakes are caught without a round trip
export function validateEvent(v: EventValues): EventErrors {
  const e: EventErrors = {};
  const title = v.title.trim();
  if (title.length < 3) e.title = "Title must be at least 3 characters.";
  else if (title.length > 120)
    e.title = "Keep the title to 120 characters or fewer.";
  if (!v.location.trim()) e.location = "Add a location.";
  else if (v.location.trim().length > 200)
    e.location = "Keep the location to 200 characters or fewer.";
  if (!v.starts_at) e.starts_at = "Choose a start time.";
  if (!v.ends_at) e.ends_at = "Choose an end time.";
  if (v.starts_at && v.ends_at && v.ends_at <= v.starts_at)
    e.ends_at = "End must be after start.";
  const capacity = Number(v.capacity);
  if (!Number.isInteger(capacity) || capacity < 1)
    e.capacity = "Capacity must be a whole number, at least 1.";
  else if (capacity > 10_000)
    e.capacity = "Capacity can't be more than 10,000.";
  return e;
}

export function toPayload(v: EventValues): EventPayload {
  return {
    title: v.title.trim(),
    description: v.description.trim() || null,
    location: v.location.trim(),
    starts_at: fromInputValue(v.starts_at),
    ends_at: fromInputValue(v.ends_at),
    capacity: Number(v.capacity),
  };
}

// Server error codes that belong to one field rather than the whole form
export const FIELD_FOR_CODE: Record<string, keyof EventValues> = {
  capacity_below_rsvps: "capacity",
};
