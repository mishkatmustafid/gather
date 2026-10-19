const dayFormat = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
});

/** "SAT 14 NOV · 18:00" - the date line on event cards. */
export function formatCardDate(iso: string): string {
  const d = new Date(iso);
  return `${dayFormat.format(d).toUpperCase()} · ${timeFormat.format(d)}`;
}

/** Today's date in the user's time zone as "YYYY-MM-DD", the format <input type="date"> uses. */
export function todayDateValue(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The API's 'from' value for a chosen date: midnight local time on that day,
 * but never earlier than now, so events that already started today are hidden.
 */
export function fromParamForDate(date: string): string {
  const startOfDay = new Date(`${date}T00:00`);
  const now = new Date();
  return (startOfDay > now ? startOfDay : now).toISOString();
}
