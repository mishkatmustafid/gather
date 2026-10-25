import { useNavigate } from "react-router-dom";
import EventForm from "../components/EventForm";
import { emptyEventValues, type EventPayload } from "../lib/eventForm";
import { api } from "../lib/api";
import type { GatherEvent } from "../lib/types";

export default function NewEvent() {
  const navigate = useNavigate();

  async function create(payload: EventPayload) {
    const event = await api<GatherEvent>("/events", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    navigate(`/events/${event.id}`, { replace: true }); // Back skips the empty form
  }

  return (
    <div className='py-4'>
      <h1 className='text-3xl font-bold'>New event</h1>
      <EventForm
        initial={emptyEventValues}
        submitLabel='Create event'
        submittingLabel='Creating…'
        onSubmit={create}
        onCancel={() => navigate(-1)}
      />
    </div>
  );
}
