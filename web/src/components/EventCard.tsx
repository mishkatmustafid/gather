import { Link } from "react-router-dom";
import type { GatherEvent } from "../lib/types";
import { formatCardDate } from "../lib/dates";

export default function EventCard({ event }: { event: GatherEvent }) {
  const full = event.rsvp_count >= event.capacity;

  return (
    <li>
      <Link
        to={`/events/${event.id}`}
        className='block rounded-lg border border-black/10 bg-white p-4 transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B5BDB]'
      >
        <p className='text-sm font-medium tracking-wide text-black/60'>
          <time dateTime={event.starts_at}>
            {formatCardDate(event.starts_at)}
          </time>
        </p>
        <h2 className='mt-1 text-lg font-bold'>{event.title}</h2>
        <p className='text-black/70'>{event.location}</p>
        <p className='mt-2 text-sm'>
          {full ? (
            <span className='font-medium text-[#E8590C]'>
              Full · {event.rsvp_count} / {event.capacity}
            </span>
          ) : (
            <span>
              {event.rsvp_count} / {event.capacity} going
            </span>
          )}
        </p>
      </Link>
    </li>
  );
}
