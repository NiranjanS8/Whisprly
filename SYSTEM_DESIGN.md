# Phase 1 — System Design: Real-Time Chat Service

**Stack:** Java 17+ · Spring Boot 3.x · Spring Security · Spring WebSocket (STOMP) · PostgreSQL · JWT  
**Deployment Model:** Stateless backend, single-instance (Phase 1), multi-instance ready  

---

## 1. High-Level Architecture

### 1.1 Layered Architecture

The backend follows a strict **Controller → Service → Repository** layering:

```
┌──────────────────────────────────────────────────────┐
│                    Client Layer                      │
│          (SPA / Mobile — REST + WebSocket)            │
└──────────┬───────────────────────────┬───────────────┘
           │ HTTP (REST)               │ ws:// (STOMP)
           ▼                           ▼
┌─────────────────────┐   ┌─────────────────────────┐
│  REST Controllers   │   │  WebSocket Controllers   │
│  (Auth, Room, User) │   │  (@MessageMapping)       │
└────────┬────────────┘   └────────┬──────────────────┘
         │                         │
         ▼                         ▼
┌──────────────────────────────────────────────────────┐
│                   Service Layer                      │
│  AuthService · ChatRoomService · MessageService      │
│  UserService · MembershipService                     │
└────────────────────────┬─────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────┐
│                 Repository Layer                     │
│         Spring Data JPA (Hibernate + PostgreSQL)     │
└──────────────────────────────────────────────────────┘
```

**Responsibility boundaries:**

| Layer | Responsibility | Prohibited |
|---|---|---|
| **Controller** | Input deserialization, request validation (`@Valid`), HTTP status mapping, WebSocket topic routing | Business logic, direct DB access, transaction management |
| **Service** | Business rules, authorization checks, transaction demarcation, orchestration | HTTP-aware logic, awareness of transport protocol |
| **Repository** | Data access, query construction, entity mapping | Business rules, validation beyond DB constraints |

This separation is critical because WebSocket message handlers and REST endpoints must share the **same** service layer. If business logic leaks into a REST controller, it must be duplicated when adding a WebSocket endpoint for the same operation — a maintenance and correctness hazard.

### 1.2 Why WebSockets Over HTTP Polling

| Concern | HTTP Polling | WebSocket |
|---|---|---|
| **Latency** | Bounded by poll interval (100ms–5s). Messages arrive late. | Sub-millisecond delivery after receipt. Server pushes immediately. |
| **Connection overhead** | Each poll = full HTTP handshake (TLS, headers, cookies). At 1000 users polling every 2s → 500 req/s of pure overhead. | Single persistent TCP connection per client. Upgrade handshake happens once. |
| **Server load** | Majority of poll responses are empty (HTTP 304 or empty body). Wasted CPU on deserialization, auth check, DB query — all for nothing. | Server only transmits when there is actual data. Zero idle overhead. |
| **Scalability** | O(users × poll_rate) requests/second. Quadratic growth with user base. | O(messages) transmissions. Linear with actual activity. |
| **Ordering** | No inherent ordering guarantee across poll cycles. Client must sort. | Messages arrive in server-send order over a single TCP stream. |

**Tradeoff acknowledged:** WebSockets complicate load balancing (session affinity), health-checking (no standard HTTP status codes on the socket), and debugging (binary frames are harder to inspect than HTTP request/response). These are engineering costs worth paying for a chat system where latency is a first-class requirement.

**Why STOMP over raw WebSocket:** Raw WebSocket is a transport — it provides a bidirectional byte stream with no application-level semantics. STOMP (Simple Text Oriented Messaging Protocol) adds:

- **Destination-based routing** (`/topic/room/{id}`) — the server routes messages by topic, not by manually tracking socket references
- **Subscribe/unsubscribe semantics** — clients declare interest; the server manages subscription state
- **Frame-level structure** — headers + body, analogous to HTTP, making debugging feasible
- **Broker abstraction** — in Phase 2+, the in-memory broker (`SimpleBrokerMessageHandler`) can be swapped for RabbitMQ / Redis Pub/Sub with minimal code changes

---

## 2. Database Design

### 2.1 Schema

```sql
-- All PKs are UUIDv4 to prevent enumeration attacks and enable
-- client-side ID generation for offline/optimistic scenarios.

CREATE TABLE users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username    VARCHAR(50)  NOT NULL UNIQUE,
    email       VARCHAR(255) NOT NULL UNIQUE,
    password    VARCHAR(255) NOT NULL,            -- bcrypt hash
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE chat_rooms (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    created_by  UUID NOT NULL REFERENCES users(id),
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE chat_room_members (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id     UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role        VARCHAR(20) NOT NULL DEFAULT 'MEMBER',   -- OWNER | ADMIN | MEMBER
    joined_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    UNIQUE (room_id, user_id)  -- a user cannot join a room twice
);

CREATE TABLE messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id         UUID NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES users(id),
    content         TEXT NOT NULL,
    idempotency_key UUID,                          -- client-generated, prevents duplicate submission
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

    UNIQUE (idempotency_key)                       -- DB-level duplicate guard
);
```

### 2.2 Design Decisions

**UUID primary keys:**
- Prevents sequential ID enumeration (`/api/users/1`, `/api/users/2` → trivially scrapeable)
- Enables distributed ID generation without coordination (no sequence contention across DB replicas)
- 128-bit space makes collision probability negligible (~2⁻⁶¹ at 1 billion keys)
- **Cost:** UUIDs are 16 bytes vs 4–8 bytes for `BIGINT`. Index pages hold fewer entries → slightly slower range scans. For a chat service where queries are point lookups (by room, by user), this tradeoff is acceptable.

**Foreign key constraints and cascading:**

| FK | ON DELETE | Reasoning |
|---|---|---|
| `chat_rooms.created_by → users.id` | No cascade (RESTRICT) | Deleting a user should not silently destroy all rooms they created. This is a business decision requiring explicit handling (transfer ownership or soft-delete). |
| `chat_room_members.room_id → chat_rooms.id` | CASCADE | Room deletion should remove all membership records. Orphaned memberships are semantically meaningless. |
| `chat_room_members.user_id → users.id` | CASCADE | User deletion removes their memberships. |
| `messages.room_id → chat_rooms.id` | CASCADE | Room deletion removes all messages. In production, you may prefer soft-delete + archival instead. |
| `messages.sender_id → users.id` | RESTRICT | Deleting a user should not delete their messages from rooms — other participants' conversation history would break. |

**Why `RESTRICT` on `messages.sender_id`:** A common mistake is cascading user deletion into message deletion. In a chat context, messages are shared artifacts belonging to a conversation, not solely to the sender. Deleting a user should anonymize their messages (set `sender_id` to a sentinel "deleted-user" UUID) rather than remove them.

### 2.3 Indexing Strategy

```sql
-- Primary access pattern: "fetch recent messages in a room, ordered by time"
CREATE INDEX idx_messages_room_created ON messages (room_id, created_at DESC);

-- Membership lookup: "is user X a member of room Y?"
-- The UNIQUE constraint on (room_id, user_id) already creates this index.

-- Rooms by creator:
CREATE INDEX idx_chat_rooms_created_by ON chat_rooms (created_by);

-- Message deduplication: idempotency_key UNIQUE constraint creates the index.

-- User lookup by username (login flow):
-- The UNIQUE constraint on users.username creates this index.
```

**Why composite index `(room_id, created_at DESC)` and not separate indexes:**

A query like `SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 50` requires both filtering and sorting. With two separate indexes, PostgreSQL must choose one index for the filter, then sort in memory (`Sort` node in `EXPLAIN`). With a composite index, PostgreSQL performs an index-only backward scan — no sort step, no temp memory allocation. For a chat service fetching "last 50 messages," this is the difference between O(n log n) sort and O(k) index scan where k = 50.

### 2.4 Fetch Strategy (LAZY vs EAGER)

**Default everything to `LAZY`.** This is not a preference — it is an invariant.

| Relationship | Fetch Type | Justification |
|---|---|---|
| `ChatRoom.members` | `LAZY` | A room list endpoint should never load all member entities. Members are fetched via separate service calls when needed. |
| `ChatRoom.messages` | `LAZY` (if mapped at all) | **Do not map `messages` as a `@OneToMany` on `ChatRoom`.** A room can have millions of messages. Mapping this relationship means Hibernate tracks the entire collection in the persistence context — a guaranteed `OutOfMemoryError` at scale. Fetch messages via `MessageRepository.findByRoomId()` with pagination. |
| `Message.sender` | `LAZY` | When fetching a page of 50 messages, eager loading triggers 50 individual `SELECT` queries for the sender (N+1 problem). Use `@EntityGraph` or a `JOIN FETCH` in the repository query for the specific use case where you need sender details. |
| `ChatRoomMember.user` | `LAZY` | Same N+1 reasoning. Fetch via join when rendering member list. |

**The N+1 trap in detail:**  
Suppose you load 50 messages with `EAGER` fetch on `sender`:
1. Hibernate executes: `SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT 50`
2. For each of the 50 results, Hibernate sees an uninitialized `sender` proxy and executes: `SELECT * FROM users WHERE id = ?`
3. Total: **51 queries** instead of 1 or 2.

With `LAZY` + explicit `JOIN FETCH`: `SELECT m FROM Message m JOIN FETCH m.sender WHERE m.room.id = :roomId ORDER BY m.createdAt DESC` → **1 query**.

**Production pitfall — `LazyInitializationException`:** With `LAZY` fetching, accessing a lazy-loaded property outside an active Hibernate session throws `LazyInitializationException`. The fix is **never** `EAGER` — it is to ensure that DTOs are fully populated within the transactional boundary, or to use `@EntityGraph` / `JOIN FETCH` in the repository method that serves the specific endpoint.

---

## 3. Authentication & Security Model

### 3.1 JWT Lifecycle

```
┌────────┐         POST /api/auth/login          ┌────────┐
│ Client │ ──────── (username, password) ────────▶│ Server │
│        │                                        │        │
│        │◀──── { accessToken, refreshToken } ────│        │
│        │         (200 OK)                        │        │
└────┬───┘                                        └────┬───┘
     │                                                  │
     │  Authorization: Bearer <accessToken>             │
     │  (every REST request)                            │
     │                                                  │
     │  ws://host/ws?token=<accessToken>                │
     │  (WebSocket CONNECT)                             │
     ▼                                                  ▼
```

**Token design:**

| Property | Access Token | Refresh Token |
|---|---|---|
| **Lifetime** | 15 minutes | 7 days |
| **Storage (client)** | Memory (JS variable) — NOT localStorage | HttpOnly, Secure, SameSite=Strict cookie |
| **Contains** | `sub` (user ID), `iat`, `exp`, `roles` | `sub` (user ID), `iat`, `exp`, `jti` (unique ID for revocation) |
| **Rotation** | Issued on login and on refresh | Rotated on each use (old token invalidated) |

**Why short-lived access tokens:**

A stolen access token is usable for its entire lifetime. With a 15-minute window, the blast radius is bounded. The server does not need to check a revocation list on every request (stateless validation — just verify the signature and `exp`). This is critical for performance: JWT validation is a CPU-local operation (~0.1ms), while a revocation check requires a DB/cache lookup (~1–5ms).

**Token revocation tradeoff:** With pure stateless JWTs, you *cannot* revoke an access token before expiry. If a user changes their password or an admin bans an account, the old access token remains valid for up to 15 minutes. Mitigations:
1. Keep access token lifetime short (15 min)
2. Maintain a small in-memory blacklist (set of `jti` values) for force-revoked tokens — this is a bounded set that clears every 15 minutes
3. Use refresh token rotation: when a refresh token is reused (indicating theft), invalidate the entire refresh token family

### 3.2 Password Hashing

**bcrypt** with work factor 12 (≈250ms per hash on modern hardware).

**Why bcrypt over alternatives:**

| Algorithm | Strength | Weakness |
|---|---|---|
| SHA-256 | Fast | *Too* fast. GPU brute-force at billions/sec. No salt built in. |
| PBKDF2 | Configurable iterations, NIST-approved | CPU-bound only. GPUs parallelize it efficiently. |
| **bcrypt** | Built-in salt, adaptive cost, memory-hard | Max 72-byte input (truncates longer passwords) |
| scrypt | Memory-hard, GPU-resistant | Harder to tune, less battle-tested in Java ecosystem |
| Argon2 | Winner of PHC, best-in-class | Library support in Spring is newer; bcrypt is the Spring Security default |

bcrypt is chosen because Spring Security provides first-class support (`BCryptPasswordEncoder`), the 72-byte limit is acceptable for passwords (not passphrases), and the work factor is adjustable without algorithm changes.

**Work factor selection:** The work factor should be tuned so that hashing takes 200–300ms on your production hardware. Below 100ms, brute-force becomes feasible on stolen hashes. Above 500ms, login latency degrades noticeably. This is tested empirically, not assumed.

### 3.3 REST Endpoint Security

Spring Security filter chain:

```
Request → CorsFilter → JwtAuthenticationFilter → UsernamePasswordAuthFilter → ...
                              │
                              ├── Extract "Authorization: Bearer <token>" header
                              ├── Parse and validate JWT (signature, expiry, issuer)
                              ├── Extract user ID from claims
                              ├── Load UserDetails (or create from claims)
                              ├── Set SecurityContextHolder.getContext().setAuthentication(...)
                              └── Chain continues with authenticated principal
```

**Endpoint security matrix:**

| Endpoint | Auth Required | Notes |
|---|---|---|
| `POST /api/auth/register` | No | Rate-limited |
| `POST /api/auth/login` | No | Rate-limited, brute-force protection |
| `POST /api/auth/refresh` | Refresh token cookie | |
| `GET /api/rooms` | Yes | Returns only rooms the user is a member of |
| `POST /api/rooms` | Yes | |
| `GET /api/rooms/{id}/messages` | Yes + membership check | Service-level authorization |
| `ws://host/ws` | Yes (query param or first STOMP frame) | See §3.4 |

### 3.4 WebSocket Handshake Authentication

WebSocket connections cannot carry custom headers during the HTTP upgrade handshake in browser environments. The `Authorization` header is not sent on a `new WebSocket(url)` call. This forces one of two approaches:

**Approach A — Token in query parameter (Phase 1):**
```
ws://host/ws?token=<accessToken>
```
- Token is extracted from `?token=` in a `HandshakeInterceptor`
- JWT validated before the upgrade completes
- If invalid → `HandshakeInterceptor.beforeHandshake()` returns `false`, HTTP 401 returned, connection refused

**Security concern:** The token appears in server access logs, proxy logs, and the browser's address bar history. Mitigations:
- Access tokens are short-lived (15 min)
- TLS encrypts the URL in transit (only visible in server logs)
- Log scrubbing: configure access logs to redact query parameters

**Approach B — Token in first STOMP CONNECT frame (preferred for Phase 2+):**
```
CONNECT
Authorization: Bearer <token>
accept-version:1.2

\0
```
- The TCP upgrade happens without auth (WebSocket connection established)
- The first STOMP `CONNECT` frame carries the token in a header
- A `ChannelInterceptor` on `clientInboundChannel` intercepts `CONNECT` frames, extracts and validates the token
- If invalid → the `ChannelInterceptor` throws `MessageDeliveryException`, Spring closes the WebSocket session

**Tradeoff:** Approach B avoids token-in-URL issues but requires that the WebSocket connection exists briefly in an unauthenticated state (between TCP upgrade and CONNECT frame). This window must be handled by refusing all non-CONNECT frames on unauthenticated sessions.

### 3.5 Rejecting Unauthorized WebSocket Connections

The rejection must be **immediate and silent** — no error messages that leak server internals:

```java
@Override
public boolean beforeHandshake(ServerHttpRequest request, 
                                ServerHttpResponse response,
                                WebSocketHandler wsHandler,
                                Map<String, Object> attributes) {
    String token = extractTokenFromQuery(request);
    if (token == null || !jwtService.isValid(token)) {
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return false;  // handshake rejected; connection never upgrades
    }
    // Store authenticated user in session attributes
    attributes.put("userId", jwtService.extractUserId(token));
    return true;
}
```

**What happens if you don't reject at handshake:** The WebSocket connection is established. The client can send STOMP SUBSCRIBE frames to arbitrary topics — and unless every single `@MessageMapping` and subscription handler individually checks auth, you have an authorization bypass.

---

## 4. WebSocket Messaging Flow

### 4.1 End-to-End Message Flow

```
Client A                        Server                           Client B, C, ...
   │                              │                                   │
   │  STOMP SEND                  │                                   │
   │  dest: /app/chat/{roomId}    │                                   │
   │  body: { content, idempKey } │                                   │
   │ ─────────────────────────────▶                                   │
   │                              │                                   │
   │                     ┌────────┴────────┐                          │
   │                     │ 1. Validate msg │                          │
   │                     │ 2. Check sender │                          │
   │                     │    membership   │                          │
   │                     │ 3. Check idemp. │                          │
   │                     │    key (dedup)  │                          │
   │                     │ 4. Persist msg  │                          │
   │                     │    (in tx)      │                          │
   │                     │ 5. COMMIT tx    │                          │
   │                     └────────┬────────┘                          │
   │                              │                                   │
   │                              │  STOMP MESSAGE                    │
   │                              │  dest: /topic/room/{roomId}       │
   │                              │  body: { id, content, sender,     │
   │                              │          createdAt }              │
   │                              │ ──────────────────────────────────▶
   │                              │                                   │
   │◀──────────────────────────────                                   │
   │  (also broadcast to sender)  │                                   │
```

### 4.2 Validation Before Persistence

Every inbound message undergoes validation **before** any database operation:

1. **Content validation:** Non-null, non-blank, max length (e.g., 4096 chars). Prevents empty messages and buffer overflow attacks.
2. **Sender identity:** The sender is NOT taken from the message payload (client-controlled, spoofable). The sender is the authenticated principal from the `SecurityContext` / WebSocket session attributes.
3. **Room existence:** Verify `roomId` references a real room.
4. **Membership check:** Query `chat_room_members` to verify the authenticated user is a member of the target room. **This is not optional** — without it, any authenticated user can send messages to any room.

```java
// CORRECT: sender from session, not from payload
UUID senderId = (UUID) headerAccessor.getSessionAttributes().get("userId");

// WRONG: trusting client payload
UUID senderId = messageDto.getSenderId();  // NEVER DO THIS
```

### 4.3 Idempotency & Duplicate Prevention

**Problem:** Network retries, client double-clicks, and WebSocket reconnection can cause duplicate message submission.

**Solution:** Client-generated idempotency key (UUIDv4), sent with each message:

1. Client generates a UUID for each message before sending
2. Server checks `UNIQUE(idempotency_key)` constraint before insert
3. If duplicate → `DataIntegrityViolationException` caught → return the existing message, **do not re-broadcast**

```java
@Transactional
public Message sendMessage(UUID roomId, UUID senderId, String content, UUID idempotencyKey) {
    // Check idempotency: if message with this key exists, return it
    Optional<Message> existing = messageRepository.findByIdempotencyKey(idempotencyKey);
    if (existing.isPresent()) {
        return existing.get();  // no re-broadcast, no re-persist
    }
    
    // ... validation, membership check ...
    
    Message message = new Message(roomId, senderId, content, idempotencyKey);
    return messageRepository.save(message);
}
```

**Why not server-side dedup with content hashing?** Two different users might send identical content ("ok", "thanks") at the same time → legitimate messages would be falsely deduplicated. Idempotency keys are per-client, per-submission-intent.

### 4.4 Broadcast After Commit

**Critical rule: `messagingTemplate.convertAndSend()` MUST be called AFTER the transaction commits.**

If you broadcast inside the transaction:
1. Client B receives message via WebSocket
2. Client B immediately calls `GET /api/rooms/{id}/messages` to sync
3. The message is not yet committed → Client B's query does not see it
4. Client B now has a phantom message in its WebSocket stream that does not appear in its REST-fetched history

**Implementation pattern:**

```java
// In the WebSocket controller (NOT inside the @Transactional service):
@MessageMapping("/chat/{roomId}")
public void handleMessage(@DestinationVariable UUID roomId, 
                           ChatMessageDto dto,
                           SimpMessageHeaderAccessor headerAccessor) {
    UUID senderId = extractUserId(headerAccessor);
    
    // Service method is @Transactional — commits on return
    Message saved = messageService.sendMessage(roomId, senderId, dto.getContent(), dto.getIdempotencyKey());
    
    // Transaction is committed by the time we reach here
    messagingTemplate.convertAndSend(
        "/topic/room/" + roomId,
        toDto(saved)
    );
}
```

---

## 5. Transaction Boundaries

### 5.1 Placement of `@Transactional`

`@Transactional` belongs **on service methods**, never on controllers or repositories.

| Placement | Correct? | Reasoning |
|---|---|---|
| Service method | ✅ | The service method represents a complete business operation (validate + persist + audit). Transactions should wrap the unit of work, and the unit of work is defined at the service layer. |
| Controller method | ❌ | Controllers are transport-layer. A REST controller and WebSocket handler calling the same service must get the same transactional behavior. Placing `@Transactional` on controllers forces duplication and risks divergence. |
| Repository method | ❌ | Repositories represent individual data operations. A business operation may involve multiple repository calls (check membership → save message → update room's `last_activity`). Each in its own transaction means no atomicity. |

### 5.2 Transactional Boundary Design

```java
@Service
public class MessageService {

    @Transactional  // single transaction wraps the entire business operation
    public Message sendMessage(UUID roomId, UUID senderId, String content, UUID idempotencyKey) {
        // All of the following happen in ONE transaction:
        // 1. Idempotency check
        // 2. Room existence check
        // 3. Membership verification
        // 4. Message entity creation and persistence
        // 5. (optional) Update room's lastActivityAt
        
        // If ANY step fails → entire transaction rolls back
        // No partial state (message saved but membership unchecked)
    }
}
```

### 5.3 Failure Scenarios and Rollback

| Failure | Behavior | Consequence |
|---|---|---|
| Membership check → user is not a member | Throw `AccessDeniedException` | Transaction rolls back (runtime exception). No message saved. |
| DB constraint violation (duplicate idempotency key) | `DataIntegrityViolationException` | Transaction rolls back. Handled in controller: return existing message. |
| DB connection lost during persist | `DataAccessException` | Transaction rolls back. Client receives error. WebSocket error frame or STOMP ERROR sent. |
| Content validation fails | `IllegalArgumentException` thrown before persist | Transaction rolls back. Clear error returned. |

**Checked vs. unchecked exceptions:** Spring's `@Transactional` only rolls back on **unchecked exceptions** (subclasses of `RuntimeException`) by default. If you throw a checked exception, the transaction **commits** — with potentially half-complete data. Either: use only runtime exceptions in service methods, or explicitly configure `@Transactional(rollbackFor = Exception.class)`.

### 5.4 Why Broadcasting Must Not Occur Inside a Transaction

Expanded reasoning beyond §4.4:

1. **Read-your-writes inconsistency:** Other DB connections (including the same user's subsequent REST request) cannot see uncommitted data. PostgreSQL's default `READ COMMITTED` isolation level guarantees this. Broadcasting an uncommitted message creates a temporal contradiction between the WebSocket stream and the REST API.

2. **Rollback + broadcast = ghost messages:** If the transaction rolls back after broadcasting (e.g., a deferred constraint check fails, or the DB decides to roll back due to serialization failure), the broadcast cannot be un-sent. Clients now have a message that does not exist in the database.

3. **Transaction duration inflation:** `messagingTemplate.convertAndSend()` may involve network I/O (serialization, writing to socket buffers for N subscribers). This holds the database transaction open for longer, increasing lock contention and the probability of deadlocks under high concurrency.

---

## 6. Concurrency & Race Conditions

### 6.1 Duplicate Messages

**Race condition:** Two network retries of the same message arrive simultaneously on different threads. Both pass the application-level idempotency check (`findByIdempotencyKey` returns empty), both proceed to insert.

**Protection layers:**

| Layer | Mechanism | Behavior |
|---|---|---|
| **Database** | `UNIQUE(idempotency_key)` constraint | Second insert fails with `DataIntegrityViolationException`. Catches all races. |
| **Application** | Pre-insert `findByIdempotencyKey()` check | Catches most duplicates without hitting the constraint. Reduces error log noise. Optimistic path. |

The application-level check is an optimization, **not** a correctness guarantee. Only the database constraint provides true linearizable duplicate prevention because it operates under the serialization guarantees of the storage engine.

### 6.2 Concurrent Membership Changes

**Scenario:** User A sends a message to Room X. Concurrently, an admin removes User A from Room X.

```
Thread 1 (send message):          Thread 2 (remove member):
  BEGIN                              BEGIN
  SELECT membership → EXISTS         DELETE membership WHERE user=A, room=X
  INSERT message                     COMMIT
  COMMIT
```

**Result under `READ COMMITTED`:** Thread 1's membership check runs *before* Thread 2's DELETE commits. Thread 1 sees the membership as valid and proceeds to insert the message. The message is persisted even though User A is no longer a member.

**Is this a bug?** In most chat systems — no. The message was sent while the user was still a member. The removal happened concurrently. The system is **eventually consistent**: the next message from User A will fail the membership check (Thread 2 has committed by then).

**If strict consistency is required:** Use `SELECT ... FOR UPDATE` (pessimistic locking) on the membership row during message send. This serializes the membership check against concurrent removals. **Tradeoff:** significantly reduced throughput due to row-level locking.

```sql
-- Pessimistic lock: blocks concurrent DELETE until this transaction commits
SELECT * FROM chat_room_members 
WHERE room_id = ? AND user_id = ? 
FOR UPDATE;
```

### 6.3 Message Ordering

**Within a single room, messages must appear in a consistent order for all participants.**

**Phase 1 (single instance):** PostgreSQL's `created_at` timestamp (generated by `now()`) combined with the `(room_id, created_at DESC)` index provides sufficient ordering. Messages are inserted sequentially through a single JVM's connection pool.

**Why `created_at` alone is fragile:**
- Clock granularity: two messages in the same millisecond get the same `created_at`
- In multi-instance deployments (Phase 2+), clocks drift between servers

**Stronger ordering strategies (for future phases):**
- **Sequence per room:** a monotonically increasing integer per room, incremented inside the transaction. Guarantees strict total order but requires serialized access per room.
- **Snowflake-like IDs:** embed timestamp + instance ID + sequence number into the message ID. Allows distributed ordering without coordination.

### 6.4 Database-Level vs Application-Level Protections

| Concern | Application-Level | Database-Level | Verdict |
|---|---|---|---|
| Duplicate messages | `if (exists(key)) return` | `UNIQUE` constraint | Both. App check is optimization; DB constraint is correctness. |
| Membership validation | `membershipService.isMember()` | FK constraint won't help here (FK only validates existence, not membership relationship) | Application only. Business rule. |
| Room existence | `roomRepository.findById()` | `FK (room_id → chat_rooms.id)` | Both. FK prevents orphaned messages even if app check has a race. |
| Concurrent updates | Optimistic locking (`@Version`) | `FOR UPDATE` (pessimistic) | Depends on contention. Low contention → optimistic. High contention → pessimistic. |

**Production guidance:** Never rely solely on application-level checks for data integrity. Application logic can have bugs, race conditions, and edge cases. Database constraints are unconditional — they cannot be bypassed by a code path that forgot to call the validation method.

---

## 7. Horizontal Scaling Concerns

### 7.1 What Breaks in Multi-Instance Deployments

In Phase 1, a single server instance holds:
- All WebSocket sessions in memory
- A `SimpleBrokerMessageHandler` that routes STOMP messages to connected subscribers

When you add Instance B:

```
                  ┌──────────────┐
   User A ───────▶│ Instance A   │  ← has User A's WebSocket session
                  │ (in-memory   │
                  │  broker)     │
                  └──────────────┘

                  ┌──────────────┐
   User B ───────▶│ Instance B   │  ← has User B's WebSocket session
                  │ (in-memory   │
                  │  broker)     │
                  └──────────────┘
```

User A sends a message to a room that User B is in. Instance A persists the message to PostgreSQL (shared), then broadcasts to `/topic/room/X`. **Instance A's broker does not know about User B.** User B never receives the message.

### 7.2 WebSocket Session Affinity

WebSocket connections are long-lived, stateful TCP connections. A load balancer must route all frames of a WebSocket connection to the same backend instance.

**Approaches:**

| Strategy | How | Drawback |
|---|---|---|
| **IP hash** | LB hashes client IP to choose backend | Clients behind NAT/CDN share an IP → uneven distribution |
| **Cookie-based** | LB sets a sticky session cookie during upgrade | Requires cookie support; doesn't work with some WebSocket clients |
| **Connection ID** | LB tracks connection → instance mapping | LB becomes stateful → single point of failure |

**What session affinity does NOT solve:** Even with perfect affinity, the cross-instance message delivery problem (§7.1) remains. Affinity ensures a client's connection doesn't bounce between instances; it does not ensure that Instance B's clients receive messages from Instance A.

### 7.3 Message Delivery Consistency

**The fundamental problem:** WebSocket session state is local. The STOMP broker is local. There is no shared subscription registry between instances.

**Impact on the user:**
- User A (Instance A) sends a message → persisted to DB ✅ → broadcast to Instance A's subscribers ✅ → User B (Instance B) sees nothing ❌
- User B refreshes and calls `GET /api/rooms/{id}/messages` → sees the message (reads from shared DB) ✅
- **Result:** Messages appear on refresh but not in real-time for cross-instance users.

### 7.4 External Broker Requirement (Design Discussion)

To solve cross-instance delivery, you need a **shared message bus**:

```
                  ┌──────────────┐
   User A ───────▶│ Instance A   ├─────┐
                  └──────────────┘     │
                                       ▼
                              ┌─────────────────┐
                              │  External Broker │
                              │  (Redis Pub/Sub, │
                              │   RabbitMQ, or   │
                              │   Kafka)         │
                              └────────┬────────┘
                                       │
                  ┌──────────────┐     │
   User B ───────▶│ Instance B   ├─────┘
                  └──────────────┘
```

**Option comparison:**

| Broker | Delivery Model | Ordering | Persistence | Best For |
|---|---|---|---|---|
| **Redis Pub/Sub** | Fire-and-forget | Per-channel | No (messages lost if no subscriber) | Low-latency fan-out, acceptable loss |
| **RabbitMQ** | At-least-once, acknowledgeable | Per-queue (FIFO) | Yes (durable queues) | Reliable delivery, complex routing |
| **Kafka** | Ordered log, consumer groups | Strict per-partition | Yes (configurable retention) | Event sourcing, replay, high throughput |

**Spring's built-in support:** Spring WebSocket can be configured with a `StompBrokerRelay` that delegates to an external STOMP-compatible broker (RabbitMQ with STOMP plugin). This is a configuration change, not an architectural rewrite — which is why using STOMP in Phase 1 is a strategic decision.

**What changes in the codebase for Phase 2:**
1. Replace `config.enableSimpleBroker("/topic")` with `config.enableStompBrokerRelay("/topic").setRelayHost("rabbitmq-host")`
2. The `messagingTemplate.convertAndSend()` calls remain identical
3. Subscription management moves from in-memory `SimpleBrokerMessageHandler` to RabbitMQ
4. No service-layer or repository-layer changes required

---

## 8. Error Handling & Logging

### 8.1 Global Exception Handling

```java
@ControllerAdvice
public class GlobalExceptionHandler {

    // Business rule violations (membership denied, room not found, etc.)
    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<ErrorResponse> handleNotFound(ResourceNotFoundException ex) {
        return ResponseEntity.status(404)
            .body(new ErrorResponse("NOT_FOUND", ex.getMessage()));
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ErrorResponse> handleForbidden(AccessDeniedException ex) {
        return ResponseEntity.status(403)
            .body(new ErrorResponse("FORBIDDEN", "Access denied"));
        // Note: DO NOT echo ex.getMessage() — it may contain "User X is not a member of room Y"
        // which leaks room membership information to the requester
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErrorResponse> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> errors = ex.getBindingResult().getFieldErrors().stream()
            .collect(Collectors.toMap(
                FieldError::getField,
                FieldError::getDefaultMessage,
                (a, b) -> a  // handle duplicate keys
            ));
        return ResponseEntity.status(400)
            .body(new ErrorResponse("VALIDATION_FAILED", errors));
    }

    // Catch-all: hide internal details
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErrorResponse> handleUnexpected(Exception ex) {
        log.error("Unhandled exception", ex);  // full stack trace in server logs
        return ResponseEntity.status(500)
            .body(new ErrorResponse("INTERNAL_ERROR", "An unexpected error occurred"));
        // NEVER: .body(new ErrorResponse("INTERNAL_ERROR", ex.getMessage()))
        // ex.getMessage() might contain SQL fragments, stack traces, or internal class names
    }
}
```

**Error response structure:**
```json
{
    "code": "VALIDATION_FAILED",
    "message": "Invalid input",
    "details": {
        "content": "must not be blank",
        "roomId": "must not be null"
    },
    "timestamp": "2026-02-22T14:25:00Z"
}
```

### 8.2 Status Code Strategy

| Code | When to Use | Common Mistake |
|---|---|---|
| **200** | Successful GET, successful update | Using for creation (should be 201) |
| **201** | Resource created (POST /rooms, POST /messages) | Forgetting `Location` header |
| **204** | Successful delete (no body to return) | Returning empty 200 with `{}` |
| **400** | Malformed request, validation failure | Using for business rule violations |
| **401** | Missing/invalid/expired JWT | Leaking "token expired" vs "token invalid" distinction |
| **403** | Authenticated but not authorized (not a member) | Using 404 to hide existence (sometimes appropriate) |
| **404** | Resource doesn't exist | Using for "not a member" (403 is more correct) |
| **409** | Conflict (duplicate username, duplicate room name) | Using 400 for uniqueness violations |
| **429** | Rate limit exceeded | Not implementing rate limiting at all |
| **500** | Unhandled server error | Returning internal details |

**The 401 vs 403 distinction matters for security:**
- 401: "I don't know who you are" → client should redirect to login
- 403: "I know who you are, but you can't do this" → client should show an error, not redirect to login

### 8.3 WebSocket Error Handling

STOMP protocol defines an `ERROR` frame for server-to-client error reporting. However, WebSocket error handling is fundamentally different from REST:

- There is no request-response cycle. You cannot "return a 400" for a bad WebSocket message.
- Errors must be sent as messages to the client, either on a user-specific error topic or as STOMP ERROR frames.

```java
@MessageExceptionHandler
@SendToUser("/queue/errors")  // client subscribes to /user/queue/errors
public ErrorResponse handleMessageException(Exception ex) {
    log.warn("WebSocket message processing error", ex);
    return new ErrorResponse("MESSAGE_ERROR", "Failed to process message");
}
```

**Design decision:** Use `/user/queue/errors` (user-specific destination) rather than broadcasting errors to `/topic/room/{id}`. An individual's authorization failure should not be visible to other room members.

### 8.4 Structured Logging Strategy

Use **SLF4J + Logback** with **JSON format** for production:

```java
// Structured logging with MDC (Mapped Diagnostic Context)
MDC.put("userId", userId.toString());
MDC.put("roomId", roomId.toString());
MDC.put("requestId", requestId);  // correlation ID from request header

log.info("Message sent successfully");
// Output: {"timestamp":"2026-02-22T14:25:00Z","level":"INFO","logger":"MessageService",
//          "message":"Message sent successfully","userId":"abc-123","roomId":"def-456",
//          "requestId":"req-789"}

MDC.clear();
```

**Log levels in production:**

| Level | What to Log | Example |
|---|---|---|
| **ERROR** | Unrecoverable failures, data inconsistencies | DB connection failure, constraint violations that should be impossible |
| **WARN** | Recoverable but abnormal situations | Auth failure, rate limit exceeded, malformed input |
| **INFO** | Significant business events | User registered, room created, message sent (count, not content) |
| **DEBUG** | Diagnostic detail (disabled in prod) | Query execution, cache hit/miss, serialization timing |

### 8.5 Sensitive Data Protection

**Hard rules — violation means security incident:**

| Data | Logged? | Returned in API? |
|---|---|---|
| Passwords (plaintext) | ❌ NEVER | ❌ NEVER |
| Password hashes | ❌ NEVER | ❌ NEVER |
| JWT tokens | ❌ NEVER (log token ID / `jti` instead) | Only on issuance (login/refresh response) |
| User email | ⚠️ Only at DEBUG level, masked | Only to the user themselves |
| Message content | ❌ Not in standard logs (compliance risk) | Yes, to authorized room members |
| Stack traces | ✅ Server logs only | ❌ NEVER in API responses |
| SQL queries | ⚠️ DEBUG level only, parameterized | ❌ NEVER |

**Implementation patterns:**

```java
// WRONG: leaks token in logs
log.info("User authenticated with token: {}", token);

// CORRECT: log the token's identity, not its value
log.info("User authenticated, tokenId={}, expiresAt={}", claims.getId(), claims.getExpiration());

// WRONG: password in toString()
log.info("Registration request: {}", registrationDto);
// If RegistrationDto.toString() includes the password field, this leaks it.

// CORRECT: exclude sensitive fields from toString() or use a sanitized DTO for logging
log.info("Registration request for username={}", registrationDto.getUsername());
```

**Jackson serialization protection:** Annotate sensitive fields with `@JsonIgnore` on DTOs to prevent accidental serialization in API responses:

```java
public class UserDto {
    private UUID id;
    private String username;
    
    @JsonIgnore
    private String password;  // never serialized, even if someone adds User to a response by mistake
}
```

---

## Appendix: Phase 1 vs Future Phase Boundaries

| Concern | Phase 1 (Single Instance) | Phase 2+ (Multi-Instance) |
|---|---|---|
| Message broker | In-memory `SimpleBroker` | RabbitMQ / Redis Pub/Sub |
| Session management | JVM-local WebSocket sessions | Shared session registry (Redis) |
| Message ordering | `created_at` timestamp | Per-room sequence numbers |
| Rate limiting | In-memory token bucket | Distributed rate limiter (Redis) |
| Caching | Local cache (Caffeine) | Distributed cache (Redis) |
| File/media attachments | Not supported | Object storage (S3) + CDN |
| Search | PostgreSQL `LIKE` / `ILIKE` | Elasticsearch / PostgreSQL FTS |
| Monitoring | Application logs + actuator | Prometheus + Grafana + distributed tracing (Jaeger) |

This Phase 1 design is intentionally single-instance but architecturally prepared for horizontal scaling. Every design choice — STOMP over raw WS, service-layer transaction boundaries, DB-level constraints, separated broadcast from commit — exists to minimize the changes required in Phase 2.
