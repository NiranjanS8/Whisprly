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

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS self_destruct_seconds INTEGER;

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

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS attachment_original_name VARCHAR(255);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS attachment_content_type VARCHAR(150);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS attachment_size_bytes BIGINT;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS attachment_category VARCHAR(20);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS attachment_storage_key VARCHAR(260);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS attachment_url VARCHAR(1000);

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;

ALTER TABLE chat_room_members
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP;

ALTER TABLE chat_room_members
    ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMP;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMP;

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS pinned_by UUID;
