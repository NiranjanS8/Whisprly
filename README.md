# Whisprly

Whisprly is a real-time chat application built with Spring Boot, PostgreSQL, WebSocket/STOMP, React, and TypeScript.

It supports direct messages, group rooms, attachments, unread tracking, typing/presence, message search, self-destructing messages, and live room/DM updates. Internal data relationships use UUIDs, while user-facing identifiers use cleaner public IDs such as usernames, room slugs, and invite codes.

## Highlights

- Real-time messaging with WebSocket/STOMP
- Group rooms and DM workflows
- Username-based public actions for DM requests and profile lookup
- Human-friendly room `slug` and `inviteCode`
- Event-driven backend flow for message, DM request, and room update side effects
- Attachments with validation and file storage
- Unread counters, read markers, typing indicators, and presence
- Global and room-scoped message search
- Self-destructing messages
- System join messages inside room timelines
- Frontend toast notifications for new messages, DM requests, and room updates

## Stack

### Backend

- Java 17
- Spring Boot 3
- Spring Security + JWT
- Spring Data JPA / Hibernate
- Spring WebSocket + STOMP
- PostgreSQL
- Maven

### Frontend

- React
- TypeScript
- Vite
- Zustand
- Axios
- SockJS + STOMP
- React Router

## Public vs Internal IDs

Whisprly keeps UUIDs as internal primary keys, but exposes cleaner public identifiers for user-facing flows:

- Users:
  - internal: `UUID`
  - public: `username`
- Rooms:
  - internal: `UUID`
  - public: `slug`
  - share/join: `inviteCode`

This keeps database integrity intact while making URLs and APIs more readable.

## Main Features

### Authentication

- Register and login with JWT-based auth
- Protected REST and WebSocket access

### Rooms and DMs

- Create group rooms
- Join rooms by invite code
- Start DMs by username
- Add/remove members
- Transfer room ownership
- Pin/unpin rooms per user

### Messaging

- Send text and attachment messages
- Edit, soft-delete, pin, and unpin messages
- Self-destruct timers
- System timeline messages such as `user joined the room`

### Realtime UX

- Live room message delivery
- Typing indicators
- Presence snapshot / updates
- User-specific unread updates
- User-specific room list updates
- User-specific incoming DM request updates
- Frontend toasts for important realtime events

### Search

- Global message search across accessible rooms
- Room-specific search with jump-to-message behavior

## Architecture Summary

Whisprly uses a layered backend with event-driven side effects:

- Controllers handle REST and WebSocket entry points
- Services enforce business rules and persistence logic
- Repositories handle database access
- Domain events decouple side effects from core write flows
- Listeners publish WebSocket updates and derived user queue updates

Examples:

- `MessageService` publishes `MessageCreatedEvent`
- `DmRequestService` publishes `DmRequestCreatedEvent`
- `ChatRoomService` publishes `RoomUpsertedEvent`

This keeps core service methods smaller and makes new realtime features easier to add.

See [ARCHITECTURE.md](/C:/Users/Niranjan/Desktop/Chat_App/ARCHITECTURE.md) for the current system design.

## Key Realtime Channels

- Room messages: `/topic/room/{roomSlug}`
- Typing: `/topic/room/{roomSlug}/typing`
- Presence snapshot: `/topic/presence/snapshot`
- Presence updates: `/user/queue/presence`
- Unread updates: `/user/queue/rooms/unread`
- Room list updates: `/user/queue/rooms/updates`
- Incoming DM requests: `/user/queue/dm-requests/incoming`

## Important API Patterns

### User-facing

- `GET /api/users/by-username/{username}/summary`
- `POST /api/dm-requests/by-username/{username}`
- `POST /api/rooms/dm/by-username/{username}`
- `POST /api/rooms/join/{inviteCode}`
- `GET /api/rooms/{roomSlug}/messages`

### Internal behavior

- Database relations still use UUIDs
- Services resolve username / slug / invite code to UUID-backed entities before applying domain rules

## Data Model

Core entities:

- `User`
- `ChatRoom`
- `ChatRoomMember`
- `Message`
- `DmRequest`

Notable room/message fields:

- `ChatRoom.slug`
- `ChatRoom.inviteCode`
- `ChatRoom.type`
- `ChatRoomMember.lastReadAt`
- `ChatRoomMember.pinnedAt`
- `Message.messageType` (`USER`, `SYSTEM`)
- `Message.expiresAt`
- `Message.pinnedAt`

## Frontend Notes

The frontend uses:

- Zustand for auth, room, chat, presence, DM request, and toast state
- WebSocket subscriptions for realtime data fanout
- Sidebar-based room/DM navigation
- Toast notifications for new messages, room updates, and DM requests
