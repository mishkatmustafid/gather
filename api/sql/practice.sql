-- 1. Upcoming events with how many people are going
SELECT e.id, e.title, e.starts_at, e.capacity, COUNT(r.user_id) AS going
FROM events e
LEFT JOIN rsvps r ON r.event_id = e.id
WHERE e.starts_at >= now()
GROUP BY e.id
ORDER BY e.id
LIMIT 20;

-- 2. Events Amira is attending (title, starts_at, host's display_name)
-- Hint: start FROM rsvps, JOIN users twice (once for Amira, once for the host)
SELECT e.title, e.starts_at, host.display_name AS host
FROM rsvps r
JOIN users me ON me.id = r.user_id
JOIN events e ON e.id = r.event_id
JOIN users host ON host.id = e.owner_id
WHERE me.email = 'amira@example.com'
ORDER BY e.starts_at;

-- 3. Events that are full
-- Hint: same shape as query 1, then HAVING COUNT(r.user_id) >= e.capacity
SELECT e.id, e.title, e.capacity, COUNT(r.user_id) AS going
FROM events e
JOIN rsvps r ON r.event_id = e.id
GROUP BY e.id
HAVING COUNT(r.user_id) = e.capacity;