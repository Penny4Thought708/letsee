// node-backend/src/views/message_threads.sql

CREATE OR REPLACE VIEW message_threads AS
WITH last_messages AS (
  SELECT
    m.*,
    ROW_NUMBER() OVER (
      PARTITION BY LEAST(sender_id, receiver_id),
                   GREATEST(sender_id, receiver_id)
      ORDER BY id DESC
    ) AS rn
  FROM private_messages m
)
SELECT
  -- Perspective for sender
  sender_id AS user_id,
  receiver_id AS contact_id,
  u.fullname AS contact_name,
  u.avatar AS contact_avatar,
  lm.message AS last_message,
  lm.created_at AS last_message_at
FROM last_messages lm
JOIN users u ON u.user_id = lm.receiver_id
WHERE lm.rn = 1

UNION ALL

SELECT
  -- Perspective for receiver
  receiver_id AS user_id,
  sender_id AS contact_id,
  u.fullname AS contact_name,
  u.avatar AS contact_avatar,
  lm.message AS last_message,
  lm.created_at AS last_message_at
FROM last_messages lm
JOIN users u ON u.user_id = lm.sender_id
WHERE lm.rn = 1;

