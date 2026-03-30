# Whisprly

Whisprly is a real-time chat platform built with Spring Boot + React.

It combines REST APIs with WebSocket/STOMP fanout, uses PostgreSQL as the source of truth, and applies event-driven backend flows for realtime side effects.

Recent backend upgrades include Redis-backed distributed presence, Redis-backed refresh-token storage, automatic access-token refresh on the frontend, Google sign-in support, Flyway-managed schema migrations, and focused backend test coverage around auth + presence.

## What It Supports

- Group rooms and direct messages
- Username-based public user actions
- Room `slug` + `inviteCode` for clean public room flows
- Login with `username` or `email`
- Google sign-in that issues the app's normal JWT + refresh-token pair
- Real-time message delivery, typing, presence, unread updates
- Distributed presence with pluggable `memory` / `redis` presence stores
- DM request workflow (send/accept/reject)
- Attachments with validation and storage
- Message lifecycle: edit, soft delete, pin/unpin, self-destruct
- System timeline events (for example: user joined room)
- User block/unblock with enforcement in DM request, DM creation, and DM message send flows
- Refresh-token rotation with revocation support
- Frontend toasts for message, room-update, and DM-request events

## Architecture

![ARCHITECTURE](Whisprly_Architecture.png)

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
- Login accepts either username or email through the same auth flow
- Google ID tokens can be exchanged for app JWTs on `/api/auth/google`
- Refresh tokens are rotated on `/api/auth/refresh`
- Refresh token revocation is supported on `/api/auth/logout`
- Refresh-token state can use `memory` or `redis`
- Presence tracking can use `memory` or `redis`
- Spring reads local `.env` values during startup, while real environment variables still take precedence
- Database schema changes are managed through Flyway migrations under `src/main/resources/db/migration`

## Running with Redis

Example `.env` values:

```env
APP_JWT_SECRET=replace_with_a_real_random_secret
APP_PRESENCE_STORE=redis
APP_AUTH_REFRESH_TOKEN_STORE=redis
APP_GOOGLE_CLIENT_ID=your_google_client_id
SPRING_DATA_REDIS_HOST=localhost
SPRING_DATA_REDIS_PORT=6379
SPRING_DATA_REDIS_PASSWORD=
```

If those are not set, the app falls back to in-memory presence and refresh-token stores.

The backend will refuse to start if `APP_JWT_SECRET` is missing, still using the placeholder value, or shorter than the required minimum length.

## Database Migrations

- Flyway owns schema creation and schema evolution
- Hibernate runs in validation mode to catch drift instead of mutating the database at startup
- Existing local databases can be adopted with Flyway's baseline support, while fresh databases start from `V1__initial_schema.sql`

Why this decision:

- It makes database changes explicit, versioned, and reviewable
- It keeps local, test, and production environments closer to each other
- It better reflects production backend practices than relying on Hibernate schema auto-update

## Observability

- Spring Boot Actuator endpoints exposed for `health`, `info`, `metrics`, and `prometheus`
- Request correlation IDs added through `X-Request-Id`, echoed back in responses and included in logs
- Custom Micrometer metrics added for auth flows, message sends, and live presence counts

Why this decision:

- It makes the backend easier to debug during local development and demos
- It shows production-minded thinking beyond just implementing business logic
- It gives a clear path to dashboards and alerting through Prometheus-compatible metrics

## Test Coverage

Current automated backend tests cover:

- refresh-token issuance, rotation, and revoked-token rejection
- username/email login resolution
- Postgres-backed auth integration tests with Testcontainers
- in-memory presence session counting
- Redis presence store behavior with mocked Redis operations
- `PresenceService` websocket event handling
- DM block enforcement for message send

Testcontainers-backed integration tests run automatically when Docker is available and are skipped otherwise.
