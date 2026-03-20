# Whisprly

Whisprly is a real-time chat platform built with Spring Boot + React.

It combines REST APIs with WebSocket/STOMP fanout, uses PostgreSQL as the source of truth, and applies event-driven backend flows for realtime side effects.

Recent backend upgrades include Redis-backed distributed presence, Redis-backed refresh-token storage, automatic access-token refresh on the frontend, and focused backend test coverage around auth + presence.

## What It Supports

- Group rooms and direct messages
- Username-based public user actions
- Room `slug` + `inviteCode` for clean public room flows
- Real-time message delivery, typing, presence, unread updates
- Distributed presence with pluggable `memory` / `redis` presence stores
- DM request workflow (send/accept/reject)
- Attachments with validation and storage
- Message lifecycle: edit, soft delete, pin/unpin, self-destruct
- System timeline events (for example: user joined room)
- User block/unblock with enforcement in DM request and DM creation flows
- Refresh-token rotation with revocation support
- Frontend toasts for message, room-update, and DM-request events

## Architecture (Current)

- Layered backend: `controller -> service -> repository`
- In-process domain events for side effects:
  - `MessageCreatedEvent`
  - `DmRequestCreatedEvent`
  - `RoomUpsertedEvent`
- Redis-backed state where it adds value:
  - presence/session tracking
  - refresh-token storage + revocation
- Transactional listeners publish realtime updates to user/room channels
- UUIDs remain internal IDs; public identifiers are exposed for UX
- Targeted backend tests cover auth refresh rotation and presence behavior

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full system breakdown.

## Public Identifier Model

- User:
  - internal: `UUID`
  - public: `username`
- Room:
  - internal: `UUID`
  - public: `slug`
  - join/share token: `inviteCode`

## Key Realtime Channels

- `/topic/room/{roomSlug}`
- `/topic/room/{roomSlug}/typing`
- `/topic/presence/snapshot`
- `/user/queue/presence`
- `/user/queue/rooms/unread`
- `/user/queue/rooms/updates`
- `/user/queue/dm-requests/incoming`

## Core Domain

- `User`
- `ChatRoom`
- `ChatRoomMember`
- `Message`
- `DmRequest`
- `UserBlock`

## Auth and Presence

- Access tokens secure REST and WebSocket entry points
- Refresh tokens are rotated on `/api/auth/refresh`
- Refresh token revocation is supported on `/api/auth/logout`
- Refresh-token state can use `memory` or `redis`
- Presence tracking can use `memory` or `redis`

## Running with Redis

Example `.env` values:

```env
APP_PRESENCE_STORE=redis
APP_AUTH_REFRESH_TOKEN_STORE=redis
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=
```

If those are not set, the app falls back to in-memory presence and refresh-token stores.

## Test Coverage

Current automated backend tests cover:

- refresh-token issuance, rotation, and revoked-token rejection
- in-memory presence session counting
- Redis presence store behavior with mocked Redis operations
- `PresenceService` websocket event handling
