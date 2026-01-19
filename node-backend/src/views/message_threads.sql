CREATE OR REPLACE VIEW message_threads AS
SELECT
  LEAST(sender_id, receiver_id) AS user_id,
  GREATEST(sender_id, receiver_id) AS contact_id,
  u.fullname AS contact_name,
  u.avatar AS contact_avatar,
  m.message AS last_message,
  m.created_at AS last_message_at
FROM private_messages m
JOIN users u
  ON u.user_id = GREATEST(m.sender_id, m.receiver_id)
WHERE m.id IN (
  SELECT MAX(id)
  FROM private_messages
  GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
);
