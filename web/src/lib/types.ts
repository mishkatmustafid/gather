export type User = { id: string; email: string; display_name: string };

export type GatherEvent = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  location: string;
  starts_at: string;
  ends_at: string;
  capacity: number;
  rsvp_count: number;
  i_am_going: boolean;
};

export type Page<T> = {
  items: T[];
  total: number;
  limit: number;
  offset: number;
};
