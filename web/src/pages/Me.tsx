import { useQuery } from "@tanstack/react-query";
import { useRef, type KeyboardEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EventCard from "../components/EventCard";
import { errorMessage, fetchMyEvents, keys } from "../lib/queries";
import type { GatherEvent } from "../lib/types";
import { usePageTitle } from "../lib/usePageTitle";

type Tab = "hosting" | "going";

const TABS: { id: Tab; label: string; role: "hosting" | "attending" }[] = [
  { id: "hosting", label: "Hosting", role: "hosting" },
  { id: "going", label: "Going", role: "attending" },
];

// Split when the response arrives (not during render), so the page renders the same every time
function splitByTime(events: GatherEvent[]) {
  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.ends_at).getTime() > now);
  const past = events
    .filter((e) => new Date(e.ends_at).getTime() <= now)
    .reverse(); // most recent first
  return { upcoming, past };
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] focus-visible:ring-offset-2";

export default function Me() {
  usePageTitle("My events");
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get("tab") === "going" ? "going" : "hosting";
  const apiRole = TABS.find((t) => t.id === tab)!.role;

  function selectTab(next: Tab) {
    // replace: switching tabs shouldn't add history entries
    setParams(next === "hosting" ? {} : { tab: next }, { replace: true });
  }

  // ---- data: each tab has its own cache entry, so switching back is instant ----
  const { data, error, isPending, refetch, isRefetching } = useQuery({
    queryKey: keys.myEvents(apiRole),
    queryFn: ({ signal }) => fetchMyEvents(apiRole, signal),
    select: splitByTime, // derive upcoming/past from the cached list
  });

  // ---- keyboard support for the tab list (WAI-ARIA tabs pattern) ----
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({
    hosting: null,
    going: null,
  });

  function onTabKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    const index = TABS.findIndex((t) => t.id === tab);
    let nextIndex: number | null = null;
    if (e.key === "ArrowRight") nextIndex = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft")
      nextIndex = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") nextIndex = 0;
    else if (e.key === "End") nextIndex = TABS.length - 1;
    if (nextIndex === null) return;
    e.preventDefault();
    const next = TABS[nextIndex].id;
    selectTab(next);
    tabRefs.current[next]?.focus();
  }

  const upcoming = data?.upcoming ?? [];
  const past = data?.past ?? [];

  return (
    <div className='py-4'>
      <h1 className='text-3xl font-bold'>My events</h1>

      <div
        role='tablist'
        aria-label='My events'
        className='mt-6 flex gap-1 border-b border-black/10'
      >
        {TABS.map((t) => {
          const selected = t.id === tab;
          return (
            <button
              key={t.id}
              ref={(el) => {
                tabRefs.current[t.id] = el;
              }}
              id={`tab-${t.id}`}
              type='button'
              role='tab'
              aria-selected={selected}
              aria-controls={`panel-${t.id}`}
              tabIndex={selected ? 0 : -1} // only the active tab is in the Tab order; arrows move between tabs
              onClick={() => selectTab(t.id)}
              onKeyDown={onTabKeyDown}
              className={`-mb-px min-h-11 rounded-t border-b-2 px-4 font-medium ${focusRing} ${
                selected
                  ? "border-[#3B5BDB] text-[#3B5BDB]"
                  : "border-transparent text-black/60 hover:text-black"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div
        role='tabpanel'
        id={`panel-${tab}`}
        aria-labelledby={`tab-${tab}`}
        aria-busy={isPending}
        tabIndex={0}
        className={`mt-6 rounded ${focusRing}`}
      >
        {isPending && <p className='text-black/60'>Loading…</p>}

        {error && !data && (
          <div
            role='alert'
            className='rounded border border-red-300 bg-red-50 p-4 text-red-800'
          >
            <p>{errorMessage(error)}</p>
            <button
              type='button'
              onClick={() => refetch()}
              disabled={isRefetching}
              className={`mt-2 min-h-11 rounded border border-red-400 px-3 ${focusRing}`}
            >
              {isRefetching ? "Retrying…" : "Try again"}
            </button>
          </div>
        )}

        {data && upcoming.length === 0 && past.length === 0 && (
          <div className='rounded border border-dashed border-black/20 p-6 text-center'>
            {tab === "hosting" ? (
              <p>
                You aren't hosting anything yet.{" "}
                <Link to='/events/new' className='text-[#3B5BDB] underline'>
                  Create an event
                </Link>
              </p>
            ) : (
              <p>
                Nothing booked yet.{" "}
                <Link to='/' className='text-[#3B5BDB] underline'>
                  Browse events
                </Link>
              </p>
            )}
          </div>
        )}

        {upcoming.length > 0 && (
          <section aria-labelledby='upcoming-heading'>
            <h2 id='upcoming-heading' className='mb-3 text-lg font-bold'>
              Upcoming{" "}
              <span className='font-normal text-black/60'>
                ({upcoming.length})
              </span>
            </h2>
            <ul className='grid gap-3'>
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          </section>
        )}

        {past.length > 0 && (
          <section
            aria-labelledby='past-heading'
            className={upcoming.length > 0 ? "mt-8" : ""}
          >
            <h2
              id='past-heading'
              className='mb-3 text-lg font-bold text-black/70'
            >
              Past{" "}
              <span className='font-normal text-black/60'>({past.length})</span>
            </h2>
            <ul className='grid gap-3 opacity-75'>
              {past.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
