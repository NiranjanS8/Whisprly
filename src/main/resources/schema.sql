ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'GROUP';

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS max_members INTEGER;

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS allowed_media_types VARCHAR(255);

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(1000);

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS room_description VARCHAR(500);

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS members_can_message BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS members_can_add_members BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE chat_rooms
SET max_members = 100
WHERE max_members IS NULL;

UPDATE chat_rooms
SET allowed_media_types = 'text,image,video,file'
WHERE allowed_media_types IS NULL;

UPDATE chat_rooms
SET members_can_message = TRUE
WHERE members_can_message IS NULL;

UPDATE chat_rooms
SET members_can_add_members = FALSE
WHERE members_can_add_members IS NULL;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS full_name VARCHAR(100);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS bio VARCHAR(500);

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS avatar_url TEXT;
