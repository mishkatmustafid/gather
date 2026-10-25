import { ApiError, api } from "./api";
import { fromParamForDate } from "./dates";
import type { GatherEvent, Page } from "./types";

// ---- query keys: one place, so invalidation can't drift out of sync ----
// Anything under ["events"] or ["me"] can be refreshed with one invalidateQueries call.
export const keys = {
  events: ["events"] as const,
  eventLists: ["events", "list"] as const,
  eventList: (params: { q: string; fromDate: string; page: number }) =>
    ["events", "list", params] as const,
  // The viewer is part of the key because i_am_going depends on who is asking
  event: (id: string, viewerId: string) =>
    ["events", "detail", id, viewerId] as const,
  me: ["me"] as const,
  myEvents: (role: "hosting" | "attending") => ["me", "events", role] as const,
};

export const PAGE_SIZE = 10;

// ---- fetchers: TanStack Query passes an AbortSignal, so stale requests are cancelled for us ----
export function fetchEventPage(
  q: string,
  fromDate: string,
  page: number,
  signal: AbortSignal,
) {
  const qs = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String((page - 1) * PAGE_SIZE),
    from: fromParamForDate(fromDate),
  });
  if (q) qs.set("q", q);
  return api<Page<GatherEvent>>(`/events?${qs}`, { signal });
}

export function fetchEvent(id: string, signal: AbortSignal) {
  return api<GatherEvent>(`/events/${id}`, { signal });
}

export function fetchMyEvents(
  role: "hosting" | "attending",
  signal: AbortSignal,
) {
  return api<GatherEvent[]>(`/me/events?role=${role}`, { signal });
}

// ---- helpers ----
export function isNotFound(error: unknown) {
  // 422 = the id in the URL isn't even a valid UUID
  return (
    error instanceof ApiError && (error.status === 404 || error.status === 422)
  );
}

export function errorMessage(error: unknown) {
  return error instanceof ApiError
    ? error.message
    : "Couldn't reach the server. Check your connection.";
}
