import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import EventCard from "../components/EventCard";
import { todayDateValue } from "../lib/dates";
import { errorMessage, fetchEventPage, keys, PAGE_SIZE } from "../lib/queries";
import { usePageTitle } from "../lib/usePageTitle";

const DEBOUNCE_MS = 300;

export default function EventList() {
  usePageTitle("Upcoming events");
  const [params, setParams] = useSearchParams();

  // ---- state that lives in the URL ----
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

  // ---- search box: types instantly, updates the URL after a pause ----
  const [search, setSearch] = useState(q);
  const [syncedQ, setSyncedQ] = useState(q);
  if (q !== syncedQ) {
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
          next.delete("page");
          return next;
        },
        { replace: true },
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search, q, setParams]);

  // ---- data: the URL params are the query key, so any change refetches (and cancels the old request) ----
  const { data, error, isPending, isPlaceholderData, refetch, isRefetching } =
    useQuery({
      queryKey: keys.eventList({ q, fromDate, page }),
      queryFn: ({ signal }) => fetchEventPage(q, fromDate, page, signal),
      placeholderData: keepPreviousData, // keep the previous page on screen while the next one loads
    });
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

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
      <div
        className='mt-6'
        aria-live='polite'
        aria-busy={isPending || isPlaceholderData}
      >
        {isPending && <p className='text-black/60'>Loading events…</p>}

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
              className='mt-2 min-h-11 rounded border border-red-400 px-3 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
            >
              {isRefetching ? "Retrying…" : "Try again"}
            </button>
          </div>
        )}

        {data && data.items.length === 0 && (
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

        {data && data.items.length > 0 && (
          // Dim the old results while the next page or search loads
          <div
            className={
              isPlaceholderData
                ? "opacity-60 transition-opacity"
                : "transition-opacity"
            }
          >
            <p className='mb-3 text-sm text-black/60'>
              Showing {data.offset + 1}–{data.offset + data.items.length} of{" "}
              {data.total} events
            </p>
            <ul className='grid gap-3'>
              {data.items.map((event) => (
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
                  disabled={page >= totalPages || isPlaceholderData}
                  onClick={() => updateParams({ page: String(page + 1) })}
                  className='min-h-11 rounded px-3 disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
                >
                  Next ›
                </button>
              </nav>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
