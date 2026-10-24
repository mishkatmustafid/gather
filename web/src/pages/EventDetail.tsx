import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api, ApiError } from "../lib/api";
import { formatEventRange } from "../lib/dates";
import type { GatherEvent } from "../lib/types";

type Result = {
  key: string;
  event?: GatherEvent;
  notFound?: boolean;
  error?: string;
};

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB] focus-visible:ring-offset-2";

export default function EventDetail() {
  const { id = "" } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const loginLink = `/login?next=${encodeURIComponent(location.pathname)}`;

  // ---- load the event (refetch when the user logs in/out, so i_am_going is right) ----
  const [reloads, setReloads] = useState(0);
  const userId = user?.id ?? "anon";
  const requestKey = `${id}|${userId}|${reloads}`;
  const [result, setResult] = useState<Result>({ key: "" });

  useEffect(() => {
    if (authLoading) return; // wait until we know who's asking
    const controller = new AbortController();
    const key = `${id}|${userId}|${reloads}`;

    api<GatherEvent>(`/events/${id}`, { signal: controller.signal })
      .then((event) => setResult({ key, event }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (
          err instanceof ApiError &&
          (err.status === 404 || err.status === 422)
        ) {
          setResult({ key, notFound: true }); // 422 = the id isn't even a valid UUID
        } else {
          const message =
            err instanceof ApiError
              ? err.message
              : "Couldn't reach the server. Check your connection.";
          setResult({ key, error: message });
        }
      });

    return () => controller.abort();
  }, [id, userId, reloads, authLoading]);

  // ---- actions ----
  const [pending, setPending] = useState<"rsvp" | "delete" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function toggleRsvp(event: GatherEvent) {
    setPending("rsvp");
    setActionError(null);
    try {
      await api(`/events/${event.id}/rsvp`, {
        method: event.i_am_going ? "DELETE" : "POST",
      });
      setReloads((n) => n + 1); // refetch for the new count
    } catch (err) {
      if (
        err instanceof ApiError &&
        (err.code === "not_authenticated" || err.code === "token_expired")
      ) {
        navigate(loginLink);
        return;
      }
      if (
        err instanceof ApiError &&
        (err.code === "already_going" || err.code === "not_going")
      ) {
        setReloads((n) => n + 1); // our copy was stale (e.g. changed in another tab): just refresh
        return;
      }
      setActionError(
        err instanceof Error ? err.message : "Something went wrong. Try again.",
      );
      setReloads((n) => n + 1); // e.g. event_full: show the latest count
    } finally {
      setPending(null);
    }
  }

  async function deleteEvent(event: GatherEvent) {
    if (
      !window.confirm(
        `Delete “${event.title}”? Everyone who RSVP'd will lose it. This can't be undone.`,
      )
    )
      return;
    setPending("delete");
    setActionError(null);
    try {
      await api(`/events/${event.id}`, { method: "DELETE" });
      navigate("/", { replace: true });
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Couldn't delete the event. Try again.",
      );
      setPending(null);
    }
  }

  // ---- render ----
  const current = result.key === requestKey ? result : null;

  if (!current) return <p className='py-4 text-black/60'>Loading event…</p>;

  if (current.notFound) {
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

  if (current.error || !current.event) {
    return (
      <div className='py-4'>
        <BackLink />
        <div
          role='alert'
          className='mt-4 rounded border border-red-300 bg-red-50 p-4 text-red-800'
        >
          <p>{current.error}</p>
          <button
            type='button'
            onClick={() => setReloads((n) => n + 1)}
            className={`mt-2 min-h-11 rounded border border-red-400 px-3 ${focusRing}`}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const event = current.event;
  const isOwner = user?.id === event.owner_id;
  const now = new Date();
  const started = new Date(event.starts_at) <= now;
  const finished = new Date(event.ends_at) <= now;
  const full = event.rsvp_count >= event.capacity;
  const percent = Math.min(100, (event.rsvp_count / event.capacity) * 100);

  return (
    <article className='py-4'>
      <BackLink />

      <h1 className='mt-3 text-3xl font-bold'>{event.title}</h1>
      <p className='mt-2 text-lg'>
        <time dateTime={event.starts_at}>
          {formatEventRange(event.starts_at, event.ends_at)}
        </time>
      </p>
      <p className='text-black/70'>{event.location}</p>
      {isOwner && (
        <p className='mt-1 text-sm font-medium text-[#3B5BDB]'>
          You're hosting this event
        </p>
      )}

      {event.description && (
        <p className='mt-6 max-w-prose whitespace-pre-line'>
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
            <span className='font-medium text-[#E8590C]'>
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
            <span className='font-medium text-[#2B8A3E]'>✓ You're going</span>
            <button
              type='button'
              disabled={pending !== null}
              onClick={() => toggleRsvp(event)}
              className={`min-h-11 rounded border border-black/20 px-4 disabled:opacity-60 ${focusRing}`}
            >
              {pending === "rsvp" ? "Cancelling…" : "Cancel RSVP"}
            </button>
          </div>
        ) : full ? (
          <p className='font-medium text-[#E8590C]'>This event is full.</p>
        ) : (
          <button
            type='button'
            disabled={pending !== null}
            onClick={() => toggleRsvp(event)}
            className={`min-h-11 rounded bg-[#3B5BDB] px-4 font-medium text-white disabled:opacity-60 ${focusRing}`}
          >
            {pending === "rsvp" ? "Saving…" : "I'm going"}
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
            disabled={pending !== null}
            onClick={() => deleteEvent(event)}
            className={`min-h-11 rounded border border-red-400 px-4 text-red-700 disabled:opacity-60 ${focusRing}`}
          >
            {pending === "delete" ? "Deleting…" : "Delete"}
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
