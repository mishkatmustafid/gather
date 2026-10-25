import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import EventForm from "../components/EventForm";
import { api } from "../lib/api";
import { emptyEventValues, type EventPayload } from "../lib/eventForm";
import { keys } from "../lib/queries";
import type { GatherEvent } from "../lib/types";
import { usePageTitle } from "../lib/usePageTitle";

export default function NewEvent() {
  usePageTitle("New event");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const create = useMutation({
    mutationFn: (payload: EventPayload) =>
      api<GatherEvent>("/events", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: (event) => {
      // Seed the detail page's cache so it opens without a loading state
      queryClient.setQueryData(keys.event(event.id, user?.id ?? "anon"), event);
      queryClient.invalidateQueries({ queryKey: keys.eventLists }); // not keys.events: that would refetch the detail we just seeded
      queryClient.invalidateQueries({ queryKey: keys.me });
      navigate(`/events/${event.id}`, { replace: true });
    },
  });

  return (
    <div className='py-4'>
      <h1 className='text-3xl font-bold'>New event</h1>
      <EventForm
        initial={emptyEventValues}
        submitLabel='Create event'
        submittingLabel='Creating…'
        onSubmit={async (payload) => {
          await create.mutateAsync(payload);
        }}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
