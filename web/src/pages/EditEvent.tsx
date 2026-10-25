import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import EventForm from "../components/EventForm";
import { api } from "../lib/api";
import { eventToValues, type EventPayload } from "../lib/eventForm";
import { errorMessage, fetchEvent, isNotFound, keys } from "../lib/queries";
import type { GatherEvent } from "../lib/types";
import { usePageTitle } from "../lib/usePageTitle";

export default function EditEvent() {
  const { id = "" } = useParams();
  const { user } = useAuth(); // RequireAuth guarantees a user here
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const viewerId = user?.id ?? "anon";

  // Same key as the detail page, so coming from there shows the form instantly from cache
  const {
    data: event,
    error,
    isPending,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: keys.event(id, viewerId),
    queryFn: ({ signal }) => fetchEvent(id, signal),
  });

  usePageTitle(event ? `Edit ${event.title}` : "Edit event");

  const save = useMutation({
    mutationFn: (payload: EventPayload) =>
      api<GatherEvent>(`/events/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(keys.event(id, viewerId), updated); // detail page shows the new values immediately
      queryClient.invalidateQueries({ queryKey: keys.eventLists }); // lists may show the old title or time
      queryClient.invalidateQueries({ queryKey: keys.me });
      navigate(`/events/${id}`, { replace: true });
    },
  });

  if (isPending) return <p className='py-4 text-black/60'>Loading event…</p>;

  if (isNotFound(error)) {
    return (
      <div className='py-4'>
        <h1 className='text-3xl font-bold'>This event doesn't exist</h1>
        <Link to='/' className='mt-4 inline-block text-[#3B5BDB] underline'>
          ‹ All events
        </Link>
      </div>
    );
  }

  if (!event) {
    return (
      <div
        role='alert'
        className='my-4 rounded border border-red-300 bg-red-50 p-4 text-red-800'
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
    );
  }

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
        key={event.id}
        initial={eventToValues(event)}
        submitLabel='Save changes'
        submittingLabel='Saving…'
        // mutateAsync rethrows errors, so EventForm still shows them next to the right fields
        onSubmit={async (payload) => {
          await save.mutateAsync(payload);
        }}
        onCancel={() => navigate(`/events/${event.id}`)}
      />
    </div>
  );
}
