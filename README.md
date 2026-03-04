# Whisprly Chat Application

Whisprly is a real-time messaging system with a Spring Boot backend and a React frontend.  
The backend is the core of the product: it manages authentication, room membership, message delivery, attachments, presence, typing, unread tracking, pinning, and timed message expiration.

## What This Project Does
- Supports direct messages and group rooms.
- Delivers chat messages in real time over WebSocket/STOMP.
- Stores message history and room/member state in PostgreSQL.
- Handles JWT-based authentication and protected APIs.
- Supports attachment upload and retrieval with metadata validation.
- Tracks unread counts per user per room using read markers.
- Supports pinned messages at room/message level.
- Supports optional self-destruct timers for ephemeral conversations.
- Broadcasts presence and typing signals for live interaction feedback.

## Backend Tech Stack
- Java 17
- Spring Boot 3.x
- Spring Security (JWT)
- Spring Data JPA / Hibernate
- Spring WebSocket (STOMP)
- PostgreSQL
- Maven

## Backend Architecture Overview
- `controller` layer: HTTP + WebSocket entry points.
- `service` layer: business logic and access rules.
- `repository` layer: JPA data access and custom queries.
- `model` layer: domain entities (`User`, `ChatRoom`, `ChatRoomMember`, `Message`, etc.).
- `dto` layer: API/websocket payload contracts.
- `security` layer: token validation and authenticated principal resolution.
- `storage` layer: attachment validation and filesystem-backed storage abstraction.

## Core Domain Concepts
- `User`: authenticated account identity.
- `ChatRoom`: conversation container (`GROUP` or `DM`) with configurable policies.
- `ChatRoomMember`: per-user membership state (role, pin state, read baseline).
- `Message`: text/attachment event with lifecycle fields (edited/deleted/pinned/expires).
- `DmRequest`: request workflow before opening a DM conversation.

## Real-Time Flow
1. Client authenticates and connects to WebSocket endpoint.
2. Client subscribes to room and user-specific channels.
3. Incoming message/typing/presence events are broadcast through STOMP.
4. Backend persists message state and pushes derived updates (for example unread counters).

## Data and Message Lifecycle
- New messages are persisted with sender + room metadata.
- Attachments are validated, stored, and linked via retrievable URLs.
- Edited/deleted messages preserve timeline continuity through state updates.
- Expired messages are processed and marked by scheduler-driven cleanup logic.
- Read acknowledgements update per-member `lastReadAt` and unread counts.

## API Surface (Backend-Oriented)
- Auth: register/login/refresh profile identity.
- Rooms: create/join/update/delete rooms, manage membership and roles.
- Messages: history, send/edit/delete, pin/unpin, attachment fetch.
- Search: global message search and room-scoped message search.
- Presence/Typing: real-time user activity signals.
- Unread: per-room read updates and push notifications.

## Repository Layout
- `src/main/java/com/chatapp`: Spring Boot backend source
- `src/main/resources`: backend configuration and SQL bootstrap/migration scripts
- `frontend/`: client UI implementation

## Product Characteristics
- Conversation-centric architecture with member-level permissions.
- Real-time-first UX backed by durable persistence.
- Feature set aligned with modern chat apps: unread badges, pinning, typing, presence, ephemeral messaging, and searchable history.
