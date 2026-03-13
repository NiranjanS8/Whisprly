# Whisprly

Whisprly is a real-time chat platform built with Spring Boot + React.

It combines REST APIs with WebSocket/STOMP fanout, uses PostgreSQL as the source of truth, and applies event-driven backend flows for realtime side effects.

## What It Supports

- Group rooms and direct messages
- Username-based public user actions
- Room `slug` + `inviteCode` for clean public room flows
- Real-time message delivery, typing, presence, unread updates
- DM request workflow (send/accept/reject)
- Attachments with validation and storage
- Message lifecycle: edit, soft delete, pin/unpin, self-destruct
- System timeline events (for example: user joined room)
- User block/unblock with enforcement in DM request and DM creation flows
- Frontend toasts for message, room-update, and DM-request events

## Architecture (Current)

- Layered backend: `controller -> service -> repository`
- In-process domain events for side effects:
  - `MessageCreatedEvent`
  - `DmRequestCreatedEvent`
  - `RoomUpsertedEvent`
- Transactional listeners publish realtime updates to user/room channels
- UUIDs remain internal IDs; public identifiers are exposed for UX

See [ARCHITECTURE.md](/C:/Users/Niranjan/Desktop/Chat_App/ARCHITECTURE.md) for the full system breakdown.

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
