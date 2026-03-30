CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(100),
    bio VARCHAR(500),
    avatar_url TEXT,
    password VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_users_username ON users (username);
CREATE UNIQUE INDEX IF NOT EXISTS uk_users_email ON users (email);

CREATE TABLE IF NOT EXISTS chat_rooms (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(150) NOT NULL,
    invite_code VARCHAR(16) NOT NULL,
    type VARCHAR(10) NOT NULL DEFAULT 'GROUP',
    max_members INTEGER,
    allowed_media_types VARCHAR(255),
    avatar_url VARCHAR(1000),
    room_description VARCHAR(500),
    members_can_message BOOLEAN NOT NULL DEFAULT TRUE,
    members_can_add_members BOOLEAN NOT NULL DEFAULT FALSE,
    self_destruct_seconds INTEGER,
    created_by UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_rooms_created_by FOREIGN KEY (created_by) REFERENCES users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_chat_rooms_slug ON chat_rooms (slug);
CREATE UNIQUE INDEX IF NOT EXISTS uk_chat_rooms_invite_code ON chat_rooms (invite_code);

CREATE TABLE IF NOT EXISTS chat_room_members (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    user_id UUID NOT NULL,
    role VARCHAR(20) NOT NULL,
    pinned_at TIMESTAMP,
    last_read_at TIMESTAMP,
    joined_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_chat_room_members_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_chat_room_members_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uk_room_user UNIQUE (room_id, user_id)
);

CREATE TABLE IF NOT EXISTS dm_requests (
    id UUID PRIMARY KEY,
    requester_id UUID NOT NULL,
    target_id UUID NOT NULL,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    CONSTRAINT fk_dm_requests_requester FOREIGN KEY (requester_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_dm_requests_target FOREIGN KEY (target_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY,
    room_id UUID NOT NULL,
    sender_id UUID NOT NULL,
    content TEXT NOT NULL,
    message_type VARCHAR(20) NOT NULL DEFAULT 'USER',
    attachment_original_name VARCHAR(255),
    attachment_content_type VARCHAR(150),
    attachment_size_bytes BIGINT,
    attachment_category VARCHAR(20),
    attachment_storage_key VARCHAR(260),
    attachment_url VARCHAR(1000),
    idempotency_key UUID,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP,
    expires_at TIMESTAMP,
    pinned_at TIMESTAMP,
    pinned_by UUID,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_messages_room FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_pinned_by FOREIGN KEY (pinned_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_messages_idempotency_key ON messages (idempotency_key);
CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages (room_id, created_at DESC);

CREATE TABLE IF NOT EXISTS user_blocks (
    id UUID PRIMARY KEY,
    blocker_id UUID NOT NULL,
    blocked_id UUID NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user_blocks_blocker FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_blocks_blocked FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT ck_user_blocks_not_self CHECK (blocker_id <> blocked_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_blocks_pair ON user_blocks (blocker_id, blocked_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks (blocked_id);
