import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import EventForm from "../components/EventForm";
import { eventToValues, type EventPayload } from "../lib/eventForm";
import { api, ApiError } from "../lib/api";
import type { GatherEvent } from "../lib/types";
import { usePageTitle } from "../lib/usePageTitle";

type Result = {
  key: string;
  event?: GatherEvent;
  notFound?: boolean;
  error?: string;
};

export default function EditEvent() {
  const { id = "" } = useParams();
  const { user } = useAuth(); // RequireAuth guarantees a user here
  const navigate = useNavigate();

  const [reloads, setReloads] = useState(0);
  const requestKey = `${id}|${reloads}`;
  const [result, setResult] = useState<Result>({ key: "" });

  useEffect(() => {
    const controller = new AbortController();
    const key = `${id}|${reloads}`;
    api<GatherEvent>(`/events/${id}`, { signal: controller.signal })
      .then((event) => setResult({ key, event }))
      .catch((err) => {
        if (controller.signal.aborted) return;
        if (
          err instanceof ApiError &&
          (err.status === 404 || err.status === 422)
        ) {
          setResult({ key, notFound: true });
        } else {
          setResult({
            key,
            error:
              err instanceof ApiError
                ? err.message
                : "Couldn't reach the server. Check your connection.",
          });
        }
      });
    return () => controller.abort();
  }, [id, reloads]);
  usePageTitle(
    result.event?.title ?? (result.notFound ? "Event not found" : undefined),
  );

  async function save(payload: EventPayload) {
    await api<GatherEvent>(`/events/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    navigate(`/events/${id}`, { replace: true });
  }

  const current = result.key === requestKey ? result : null;

  if (!current) return <p className='py-4 text-black/60'>Loading event…</p>;

  if (current.notFound) {
    return (
      <div className='py-4'>
        <h1 className='text-3xl font-bold'>This event doesn't exist</h1>
        <Link to='/' className='mt-4 inline-block text-[#3B5BDB] underline'>
          ‹ All events
        </Link>
      </div>
    );
  }

  if (current.error || !current.event) {
    return (
      <div
        role='alert'
        className='my-4 rounded border border-red-300 bg-red-50 p-4 text-red-800'
      >
        <p>{current.error}</p>
        <button
          type='button'
          onClick={() => setReloads((n) => n + 1)}
          className='mt-2 min-h-11 rounded border border-red-400 px-3'
        >
          Try again
        </button>
      </div>
    );
  }

  const event = current.event;

  // The API would refuse the save with 403 anyway; say so up front instead of after typing
  if (event.owner_id !== user?.id) {
    return (
      <div className='py-4'>
        <h1 className='text-3xl font-bold'>You can't edit this event</h1>
        <p className='mt-2 text-black/70'>Only the host can change it.</p>
        <Link
          to={`/events/${event.id}`}
          className='mt-4 inline-block text-[#3B5BDB] underline'
        >
          ‹ Back to the event
        </Link>
      </div>
    );
  }

  return (
    <div className='py-4'>
      <Link to={`/events/${event.id}`} className='text-[#3B5BDB] underline'>
        ‹ Back to the event
      </Link>
      <h1 className='mt-3 text-3xl font-bold'>Edit event</h1>
      <EventForm
        key={event.id} // fresh form state if you navigate from one event's edit page to another
        initial={eventToValues(event)}
        submitLabel='Save changes'
        submittingLabel='Saving…'
        onSubmit={save}
        onCancel={() => navigate(`/events/${event.id}`)}
      />
    </div>
  );
}
