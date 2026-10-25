import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatEventRange } from "../lib/dates";
import { errorMessage, fetchEvent, isNotFound, keys } from "../lib/queries";
import type { GatherEvent } from "../lib/types";
import { usePageTitle } from "../lib/usePageTitle";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] focus-visible:ring-offset-2";

export default function EventDetail() {
  const { id = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`;

  // ---- load the event; the viewer is in the key, so logging in/out refetches i_am_going ----
  const {
    data: event,
    error,
    isPending,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: keys.event(id, user?.id ?? "anon"),
    queryFn: ({ signal }) => fetchEvent(id, signal),
    enabled: !authLoading, // wait until we know who's asking
  });

  usePageTitle(
    event?.title ?? (isNotFound(error) ? "Event not found" : undefined),
  );

  // Every event list, detail and "my events" view may now be out of date
  const refreshEverything = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: keys.events }),
      queryClient.invalidateQueries({ queryKey: keys.me }),
    ]);

  // ---- RSVP / cancel ----
  const [actionError, setActionError] = useState<string | null>(null);

  const rsvp = useMutation({
    mutationFn: (going: boolean) =>
      api(`/events/${id}/rsvp`, { method: going ? "DELETE" : "POST" }),
    onMutate: () => setActionError(null),
    onSuccess: refreshEverything,
    onError: (err) => {
      if (
        err instanceof ApiError &&
        (err.code === "not_authenticated" || err.code === "token_expired")
      ) {
        navigate(loginLink);
        return;
      }
      // already_going / not_going just mean our copy was stale: refresh quietly
      if (
        !(
          err instanceof ApiError &&
          (err.code === "already_going" || err.code === "not_going")
        )
      ) {
        setActionError(errorMessage(err));
      }
      refreshEverything(); // e.g. event_full: show the latest count
    },
  });

  // ---- delete ----
  const remove = useMutation({
    mutationFn: () => api(`/events/${id}`, { method: "DELETE" }),
    onMutate: () => setActionError(null),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["events", "detail", id] }); // it no longer exists
      refreshEverything();
      navigate("/", { replace: true });
    },
    onError: (err) => setActionError(errorMessage(err)),
  });

  function confirmDelete(e: GatherEvent) {
    if (
      window.confirm(
        `Delete “${e.title}”? Everyone who RSVP'd will lose it. This can't be undone.`,
      )
    ) {
      remove.mutate();
    }
  }

  const busy = rsvp.isPending || remove.isPending;

  // ---- render ----
  if (isPending) return <p className='py-4 text-black/60'>Loading event…</p>;

  if (isNotFound(error)) {
    return (
      <div className='py-4'>
        <h1 className='text-3xl font-bold'>This event doesn't exist</h1>
        <p className='mt-2 text-black/70'>
          It may have been deleted, or the link is wrong.
        </p>
        <BackLink />
      </div>
    );
  }

  if (!event) {
    return (
      <div className='py-4'>
        <BackLink />
        <div
          role='alert'
          className='mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-800'
        >
          <p>{errorMessage(error)}</p>
          <button
            type='button'
            onClick={() => refetch()}
            disabled={isRefetching}
            className={`mt-2 min-h-11 rounded border border-red-400 px-3 disabled:opacity-60 ${focusRing}`}
          >
            {isRefetching ? "Retrying…" : "Try again"}
          </button>
        </div>
      </div>
    );
  }

  const isOwner = user?.id === event.owner_id;
  const now = new Date();
  const started = new Date(event.starts_at) <= now;
  const finished = new Date(event.ends_at) <= now;
  const full = event.rsvp_count >= event.capacity;
  const percent = Math.min(100, (event.rsvp_count / event.capacity) * 100);

  return (
    <article className='py-4'>
      <BackLink />

      <h1 className='mt-3 text-3xl font-bold [overflow-wrap:anywhere]'>
        {event.title}
      </h1>
      <p className='mt-2 text-lg'>
        <time dateTime={event.starts_at}>
          {formatEventRange(event.starts_at, event.ends_at)}
        </time>
      </p>
      <p className='text-black/70 [overflow-wrap:anywhere]'>{event.location}</p>
      {isOwner && (
        <p className='mt-1 text-sm font-medium text-[#3B5BDB]'>
          You're hosting this event
        </p>
      )}

      {event.description && (
        <p className='mt-6 max-w-prose whitespace-pre-line [overflow-wrap:anywhere]'>
          {event.description}
        </p>
      )}

      {/* ---- capacity ---- */}
      <div className='mt-8 max-w-md'>
        <div
          className='h-3 overflow-hidden rounded bg-black/10'
          aria-hidden='true'
        >
          <div
            className={`h-full ${full ? "bg-[#E8590C]" : "bg-[#3B5BDB]"}`}
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className='mt-2'>
          {full ? (
            <span className='font-medium text-[#C2410C]'>
              Full · {event.rsvp_count} / {event.capacity} going
            </span>
          ) : (
            <span>
              {event.rsvp_count} / {event.capacity} going
            </span>
          )}
        </p>
      </div>

      {/* ---- RSVP ---- */}
      <div className='mt-4' aria-live='polite'>
        {finished ? (
          <p className='text-black/70'>This event has finished.</p>
        ) : started ? (
          <p className='text-black/70'>This event has already started.</p>
        ) : !user ? (
          <Link
            to={loginLink}
            className={`inline-flex min-h-11 items-center rounded bg-[#3B5BDB] px-4 font-medium text-white ${focusRing}`}
          >
            Log in to RSVP
          </Link>
        ) : event.i_am_going ? (
          <div className='flex flex-wrap items-center gap-3'>
            <span className='font-medium text-[#24763A]'>✓ You're going</span>
            <button
              type='button'
              disabled={busy}
              onClick={() => rsvp.mutate(true)}
              className={`min-h-11 rounded border border-black/20 px-4 disabled:opacity-60 ${focusRing}`}
            >
              {rsvp.isPending ? "Cancelling…" : "Cancel RSVP"}
            </button>
          </div>
        ) : full ? (
          <p className='font-medium text-[#C2410C]'>This event is full.</p>
        ) : (
          <button
            type='button'
            disabled={busy}
            onClick={() => rsvp.mutate(false)}
            className={`min-h-11 rounded bg-[#3B5BDB] px-4 font-medium text-white disabled:opacity-60 ${focusRing}`}
          >
            {rsvp.isPending ? "Saving…" : "I'm going"}
          </button>
        )}

        {actionError && (
          <p role='alert' className='mt-3 text-red-700'>
            {actionError}
          </p>
        )}
      </div>

      {/* ---- host controls ---- */}
      {isOwner && (
        <div className='mt-8 flex flex-wrap gap-3 border-t border-black/10 pt-6'>
          <Link
            to={`/events/${event.id}/edit`}
            className={`inline-flex min-h-11 items-center rounded border border-black/20 px-4 ${focusRing}`}
          >
            Edit
          </Link>
          <button
            type='button'
            disabled={busy}
            onClick={() => confirmDelete(event)}
            className={`min-h-11 rounded border border-red-400 px-4 text-red-700 disabled:opacity-60 ${focusRing}`}
          >
            {remove.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      )}
    </article>
  );
}

function BackLink() {
  return (
    <Link
      to='/'
      className='mt-4 inline-block rounded text-[#3B5BDB] underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
    >
      ‹ All events
    </Link>
  );
}
