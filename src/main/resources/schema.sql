ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS type VARCHAR(10) NOT NULL DEFAULT 'GROUP';

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS max_members INTEGER;

ALTER TABLE chat_rooms
    ADD COLUMN IF NOT EXISTS allowed_media_types VARCHAR(255);

UPDATE chat_rooms
SET max_members = 100
WHERE max_members IS NULL;

UPDATE chat_rooms
SET allowed_media_types = 'text,image,video,file'
WHERE allowed_media_types IS NULL;
