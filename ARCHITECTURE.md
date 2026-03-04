# Whisprly Architecture

## 1. System Context

```mermaid
flowchart LR
    U[User Browser] -->|HTTPS REST| API[Spring Boot API]
    U -->|WebSocket STOMP| WS[Spring WebSocket Gateway]
    API --> SVC[Service Layer]
    WS --> SVC
    SVC --> DB[(PostgreSQL)]
    SVC --> FS[(Attachment Storage<br/>uploads/)]
```

## 2. Backend Layered Architecture

```mermaid
flowchart TB
    C[Controllers<br/>Auth, Room, Message, Presence, DM Request] --> B[Services]
    B --> R[Repositories]
    R --> D[(PostgreSQL)]
    B --> ST[Storage Service]
    ST --> F[(File System)]
    C --> SEC[Security/JWT]
    SEC --> C
```

### Controller Layer
- Exposes REST endpoints under `/api/**`.
- Handles authenticated user context via Spring Security.
- Publishes real-time events via `SimpMessagingTemplate`.

### Service Layer
- Core business logic:
  - room/DM lifecycle
  - message send/edit/delete/pin
  - unread tracking (`lastReadAt` baselines)
  - self-destruct expiration handling
  - membership and authorization checks

### Repository Layer
- Spring Data JPA repositories for `User`, `ChatRoom`, `ChatRoomMember`, `Message`, `DmRequest`.
- Query methods include:
  - room membership checks
  - unread count calculations
  - message history + search (global and room scoped)
  - expired-message fetch for cleanup

## 3. Real-Time Messaging Architecture

```mermaid
sequenceDiagram
    participant ClientA
    participant WS as STOMP Endpoint
    participant ChatController
    participant MessageService
    participant DB
    participant ClientB

    ClientA->>WS: SEND /app/chat.sendMessage
    WS->>ChatController: ChatMessageRequest
    ChatController->>MessageService: sendMessage(...)
    MessageService->>DB: persist message
    MessageService-->>ChatController: ChatMessageResponse
    ChatController->>WS: publish /topic/room/{roomId}
    WS-->>ClientA: new message event
    WS-->>ClientB: new message event
    ChatController->>WS: publish user unread updates
```

### WebSocket Topics/Queues (logical)
- Room broadcast: `/topic/room/{roomId}`
- Typing events: room-topic events
- User-specific unread updates: `/user/queue/rooms/unread`
- Presence snapshots/updates: presence channels

## 4. Data Model (Core)

```mermaid
erDiagram
    USER ||--o{ CHAT_ROOM_MEMBER : joins
    CHAT_ROOM ||--o{ CHAT_ROOM_MEMBER : has_members
    CHAT_ROOM ||--o{ MESSAGE : contains
    USER ||--o{ MESSAGE : sends
    USER ||--o{ DM_REQUEST : creates
    USER ||--o{ DM_REQUEST : receives

    USER {
        UUID id
        string username
        string email
        string full_name
    }

    CHAT_ROOM {
        UUID id
        string name
        string type
        UUID created_by
        int self_destruct_seconds
    }

    CHAT_ROOM_MEMBER {
        UUID id
        UUID room_id
        UUID user_id
        string role
        timestamp pinned_at
        timestamp last_read_at
        timestamp joined_at
    }

    MESSAGE {
        UUID id
        UUID room_id
        UUID sender_id
        text content
        timestamp created_at
        timestamp edited_at
        timestamp deleted_at
        timestamp expires_at
        timestamp pinned_at
    }
```

## 5. Key Runtime Flows

### A) Fetch Rooms + Unread
1. Client calls room listing API.
2. Service loads memberships for current user.
3. Unread count computed using `lastReadAt` (fallback baseline) and message timestamps.
4. Response includes room metadata + `unreadCount`.

### B) Mark Room Read
1. Client opens a room and calls mark-read endpoint.
2. Backend updates `chat_room_members.last_read_at`.
3. Backend pushes unread update to that user queue.

### C) Pinned Message Banner
1. Message pin/unpin updates message state (`pinned_at`, `pinned_by`).
2. Updated message broadcast to room in real time.
3. UI derives current pinned message and renders top banner.

### D) Self-Destruct Messages
1. Room setting defines `selfDestructSeconds`.
2. New messages get `expires_at` at creation time.
3. Scheduler finds due messages and marks them expired/deleted.
4. Expired updates are propagated to clients.

### E) Message Search
1. Global search endpoint scans user-accessible messages.
2. Room search endpoint scans only selected room.
3. Result selection sets jump target (room + message).
4. UI opens room, scrolls to exact message, and highlights it.

## 6. Security Boundaries
- JWT authentication for REST + WebSocket session identity.
- Membership checks before room/message access.
- Role-based restrictions for room management operations.
- Attachment validation before storage and retrieval.

## 7. Module Map
- Backend: `src/main/java/com/chatapp`
  - `controller/`, `service/`, `repository/`, `model/`, `dto/`, `security/`, `storage/`
- Backend config/resources: `src/main/resources`
- Frontend UI/client state: `frontend/src`

