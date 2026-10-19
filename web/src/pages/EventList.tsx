import { Link, useSearchParams } from "react-router-dom";
import type { GatherEvent, Page } from "../lib/types";
import { fromParamForDate, todayDateValue } from "../lib/dates";
import { useEffect, useState } from "react";
import { api, ApiError } from "../lib/api";
import EventCard from "../components/EventCard";

const PAGE_SIZE = 10;
const DEBOUNCE_MS = 300;

type Result = { key: string; data?: Page<GatherEvent>; error?: string };

export default function EventList() {
  const [params, setParams] = useSearchParams();

  // --- state that lives in the URL ---
  const q = params.get("q") ?? "";
  const fromDate = params.get("from") ?? todayDateValue();
  const page = Math.max(1, Number(params.get("page")) || 1);

  function updateParams(
    changes: Record<string, string | null>,
    replace = false,
  ) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(changes)) {
          if (v) next.set(k, v);
          else next.delete(k);
        }
        return next;
      },
      { replace },
    );
  }

  // --- search box: types instantly, updates the URL after a pause ---
  const [search, setSearch] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q != syncedQ) {
    // q changed from outside the box (Back button, "Clear search"): show it in the box
    setSyncedQ(q);
    setSearch(q);
  }

  useEffect(() => {
    const term = search.trim();
    if (term === q) return;
    const timer = setTimeout(() => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (term) next.set("q", term);
          else next.delete("q");
          next.delete("page"); // a new search starts at page 1
          return next;
        },
        { replace: true }, // typing shouldn't add one history entry per pause
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, q, setParams]);

  // --- data fetching ---
  const [reloads, setReloads] = useState(0);
  const requestKey = `${q}|${fromDate}|${page}|${reloads}`;
  const [result, setResult] = useState<Result>({ key: "" });

  useEffect(() => {
    const controller = new AbortController();
    const key = `${q}|${fromDate}|${page}|${reloads}`;
    const qs = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String((page - 1) * PAGE_SIZE),
      from: fromParamForDate(fromDate),
    });
    if (q) qs.set("q", q);

    api<Page<GatherEvent>>(`/events?${qs}`, { signal: controller.signal })
      .then((data) => setResult({ key, data }))
      .catch((err) => {
        if (controller.signal.aborted) return; // a newer request replaced this one
        const message =
          err instanceof ApiError
            ? err.message
            : "Couldn't reach the server. Check your connection.";
        setResult({ key, error: message });
      });

    return () => controller.abort();
  }, [q, fromDate, page, reloads]);

  // Anything not matching the current URL is stale, so we're still loading
  const current = result.key === requestKey ? result : null;
  const totalPages = current?.data
    ? Math.max(1, Math.ceil(current.data.total / PAGE_SIZE))
    : 1;

  return (
    <div className='py-4'>
      <h1 className='text-3xl font-bold'>Upcoming events</h1>

      {/* ---- filters ---- */}
      <div className='mt-4 flex flex-wrap items-end gap-3'>
        <div className='flex min-w-0 flex-1 flex-col gap-1'>
          <label htmlFor='search' className='text-sm font-medium'>
            Search
          </label>
          <input
            id='search'
            type='search'
            placeholder='Title or location'
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className='min-h-11 rounded border border-black/20 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
          />
        </div>
        <div className='flex flex-col gap-1'>
          <label htmlFor='from' className='text-sm font-medium'>
            From
          </label>
          <input
            id='from'
            type='date'
            min={todayDateValue()}
            value={fromDate}
            onChange={(e) =>
              updateParams({
                from:
                  e.target.value === todayDateValue() ? null : e.target.value,
                page: null,
              })
            }
            className='min-h-11 rounded border border-black/20 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
          />
        </div>
      </div>

      {/* ---- results ---- */}
      <div className='mt-6' aria-live='polite' aria-busy={!current}>
        {!current && <p className='text-black/60'>Loading events…</p>}

        {current?.error && (
          <div
            role='alert'
            className='rounded border border-red-300 bg-red-50 p-4 text-red-800'
          >
            <p>{current.error}</p>
            <button
              type='button'
              onClick={() => setReloads((n) => n + 1)}
              className='mt-2 min-h-11 rounded border border-red-400 px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
            >
              Try again
            </button>
          </div>
        )}

        {current?.data && current.data.items.length === 0 && (
          <div className='rounded border border-dashed border-black/20 p-6 text-center'>
            {page > 1 ? (
              <p>
                There's no page {page}.{" "}
                <button
                  type='button'
                  onClick={() => updateParams({ page: null })}
                  className='text-[#3B5BDB] underline'
                >
                  Go to the first page
                </button>
              </p>
            ) : q ? (
              <p>
                No events match “{q}”.{" "}
                <button
                  type='button'
                  onClick={() => updateParams({ q: null, page: null })}
                  className='text-[#3B5BDB] underline'
                >
                  Clear search
                </button>
              </p>
            ) : (
              <p>
                No upcoming events yet.{" "}
                <Link to='/events/new' className='text-[#3B5BDB] underline'>
                  Create one
                </Link>
              </p>
            )}
          </div>
        )}

        {current?.data && current.data.items.length > 0 && (
          <>
            <p className='mb-3 text-sm text-black/60'>
              Showing {(page - 1) * PAGE_SIZE + 1}–
              {(page - 1) * PAGE_SIZE + current.data.items.length} of{" "}
              {current.data.total} events
            </p>
            <ul className='grid gap-3'>
              {current.data.items.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </ul>

            {totalPages > 1 && (
              <nav
                aria-label='Pagination'
                className='mt-6 flex items-center justify-center gap-4'
              >
                <button
                  type='button'
                  disabled={page <= 1}
                  onClick={() =>
                    updateParams({
                      page: page - 1 > 1 ? String(page - 1) : null,
                    })
                  }
                  className='min-h-11 rounded px-3 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
                >
                  ‹ Prev
                </button>
                <span>
                  {page} / {totalPages}
                </span>
                <button
                  type='button'
                  disabled={page >= totalPages}
                  onClick={() => updateParams({ page: String(page + 1) })}
                  className='min-h-11 rounded px-3 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
                >
                  Next ›
                </button>
              </nav>
            )}
          </>
        )}
      </div>
    </div>
  );
}
