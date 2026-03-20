# Whisprly Resume Summary

## Short Resume Version

- Built a real-time chat platform using Spring Boot, PostgreSQL, React, and WebSocket/STOMP with support for group rooms, DMs, typing indicators, unread tracking, attachments, and message lifecycle events.
- Implemented JWT-based authentication with refresh-token rotation and revocation, including Redis-backed token storage and automatic frontend session refresh.
- Added distributed presence tracking with pluggable in-memory and Redis-backed stores so websocket session state can scale beyond a single backend instance.
- Designed backend flows around layered services and transactional domain events to separate persistence from realtime side effects such as room updates, unread counters, and DM-request notifications.

## Medium Resume Version

Whisprly is a full-stack real-time chat application built with Spring Boot, PostgreSQL, React, and WebSocket/STOMP. The backend supports group chat, direct messages, unread tracking, typing indicators, DM requests, attachment handling, soft delete/edit/pin flows, and self-destructing messages.

The system uses JWT authentication with refresh-token rotation, Redis-backed token revocation, and Redis-backed distributed presence tracking. Backend logic is organized with controller-service-repository layering and Spring transactional events for realtime side effects.

## LinkedIn Project Description

Built `Whisprly`, a real-time chat platform using Spring Boot, PostgreSQL, React, WebSocket/STOMP, and Redis. The backend supports group rooms, direct messages, typing indicators, unread tracking, DM requests, attachment handling, and message lifecycle features such as edit, soft delete, pinning, and self-destruct timers.

Implemented JWT authentication with refresh-token rotation and revocation, plus Redis-backed distributed presence tracking for websocket sessions. Designed the backend around layered services and transactional domain events so realtime side effects stay separated from core persistence logic.

## Interview Answer: "Tell Me About This Project"

Whisprly is a real-time chat application I built to go beyond a normal CRUD backend. I used Spring Boot for the backend, PostgreSQL as the source of truth, React for the frontend, and WebSocket/STOMP for live messaging features. The system supports group rooms, direct messages, typing indicators, unread counts, DM request workflows, attachments, and message lifecycle features like edit, soft delete, pinning, and self-destruct timers.

From a backend perspective, the main thing I focused on was designing it like a real system instead of just exposing endpoints. I kept the backend layered with controller, service, and repository boundaries, and I used Spring transactional events for realtime side effects. For example, when a message is saved, the core write happens first and then listeners handle websocket fanout and unread updates after commit. That made the flows easier to reason about and closer to what I would want in a production-style codebase.

I also improved the infrastructure side by adding Redis in places where it actually adds value. Presence tracking is abstracted behind a store interface, so it works in memory for local development and with Redis for distributed websocket presence. I also implemented refresh-token rotation and revocation with Redis-backed token storage, so auth is more realistic than just returning a refresh token without lifecycle control.

Another thing I paid attention to was security and correctness. I fixed the websocket typing flow so typing events only go through validated backend destinations instead of allowing direct topic publishing from the client. I also added backend tests around refresh-token rotation and presence/session behavior, because I wanted the more advanced parts of the project to be backed by tests rather than just demo code.

Overall, the project helped me practice backend design, realtime communication, authentication, Redis integration, and turning a feature-heavy application into something that is easier to explain and defend technically.

## Interview Questions and Sample Answers

### 1. Why did you use Redis in this project?

I used Redis where it solved real runtime problems instead of adding it as a generic cache. The two main uses are distributed presence tracking and refresh-token storage. Presence was initially in memory, which only works correctly on a single backend instance. Redis lets websocket session state be shared so online/offline status is not tied to one JVM. I also used Redis for refresh-token revocation and rotation so token lifecycle is controlled on the backend.

### 2. Why did you use WebSocket/STOMP instead of only REST?

REST is good for request-response flows like login, room fetches, message history, and settings updates. But chat features like live messages, typing indicators, unread updates, room updates, and presence are much better with a push-based model. STOMP over WebSocket gave me a structured way to support room topics and user-specific queues.

### 3. How did you design the backend architecture?

I used a layered structure with controller, service, and repository boundaries. Controllers handle transport concerns, services contain business rules and authorization checks, and repositories deal with persistence. For realtime side effects, I used Spring application events and transactional listeners so core writes happen first and websocket fanout happens after commit.

### 4. Why did you use domain events?

Without events, service methods become crowded with side effects. For example, creating a message would also need to publish websocket messages, update unread counters, and notify users. By publishing an event after the message is saved, the side effects stay decoupled and are easier to test and reason about.

### 5. How does refresh-token rotation work in your project?

Each refresh token has a unique `jti`. When the user logs in, the backend stores that refresh-token identity in a `RefreshTokenStore`. When the client calls refresh, the backend validates the token, checks whether that `jti` is still valid, revokes the old token, and issues a new access-token and refresh-token pair. On logout, the current refresh token is revoked.

### 6. Why is refresh-token storage needed if JWT is stateless?

Access tokens can stay stateless, but refresh tokens are different because they need lifecycle control. If refresh tokens are never stored or revoked, logout and token invalidation are weak. Storing refresh-token identities gives the backend control over rotation and revocation without making every access-token lookup stateful.

### 7. How did you handle presence tracking?

Presence is abstracted behind a `PresenceStore` interface. There is an in-memory implementation for local development and a Redis-backed implementation for distributed deployments. In Redis mode, websocket sessions are mapped to users, each user has a session set, and TTL is refreshed during websocket activity so online state expires naturally if a connection disappears unexpectedly.

### 8. What security issue did you find and fix?

One issue was in typing events. The frontend had a fallback that could publish directly to the broker topic, which would bypass backend membership validation. I removed that path so typing events only go through the backend app destination, where room membership is checked before rebroadcasting.

### 9. How do you make sure unread counts stay correct?

Unread counts are based on `lastReadAt` per room membership. When a user marks a room as read, that timestamp is updated. Later unread counts are computed relative to that baseline, excluding the user's own messages. Realtime unread updates are pushed through user-specific websocket queues.

### 10. Why did you keep PostgreSQL as the source of truth?

Because chat state like users, memberships, rooms, messages, and DM requests needs durable relational storage. Redis is useful for fast distributed runtime state like presence and refresh tokens, but PostgreSQL remains the durable system of record for the main domain data.

### 11. What tradeoff still exists in this architecture?

The main remaining tradeoff is that websocket fanout still uses the in-process Spring broker. Redis now helps with presence and refresh-token state, but full multi-instance message fanout would still need something like a broker relay or external event bus if the system needed to scale further.

### 12. What tests did you add and why?

I added backend tests around refresh-token rotation and presence behavior because those are the more complex parts of the project. The tests cover token issuance, revocation, and rejected refresh attempts, as well as presence session accounting, Redis presence-store behavior, and websocket presence event handling.

### 13. If you had more time, what would you improve next?

I would add auth controller integration tests, move from the in-process STOMP broker to a multi-instance-ready broker setup, and improve operational concerns like observability and deployment. I would also tighten secrets/config handling so local development remains easy without keeping sensitive defaults in source.

## Deep-Dive Interview Questions

### 1. Why did you keep both in-memory and Redis implementations instead of switching fully to Redis?

I kept both because they solve different needs. In-memory mode keeps local development simple and avoids forcing infrastructure for every run. Redis mode is useful when I want distributed presence and refresh-token state. The abstraction makes the code cleaner and keeps environment-specific concerns out of the higher-level services.

### 2. How does your Redis presence model avoid false offline status when a user has multiple sessions?

Each websocket session is tracked independently. In Redis mode, there is a mapping from session ID to user ID and also a per-user session set. A user is considered online as long as at least one active session remains in that set. Disconnecting one session does not mark the user offline unless it was the last one.

### 3. Why did you refresh presence TTL on websocket activity?

Because unexpected disconnects are not always graceful. If the app only relied on explicit disconnect events, a dead connection might leave the user appearing online too long. Refreshing TTL on websocket activity gives the store a way to naturally expire stale session state if disconnect handling is missed.

### 4. How do you prevent duplicate messages from websocket retries?

I use an idempotency key on message send. If a message with the same idempotency key already exists, the backend returns the existing message instead of creating another one. That helps with retries and reconnect-related duplicate sends.

### 5. Why are room slugs and usernames exposed publicly instead of UUIDs?

They improve usability and routing. Users can work with readable identifiers like usernames and room slugs, while UUIDs remain internal database identifiers. This keeps the persistence model stable without exposing awkward identifiers everywhere in the UX.

### 6. Why did you use transactional listeners instead of sending websocket updates directly inside services?

Because I want websocket side effects to happen only after the database transaction commits successfully. If I broadcast inside the service and the transaction later fails, clients could see an event for data that never actually committed. Transactional listeners reduce that inconsistency.

### 7. What happens if Redis is down in Redis mode?

In Redis mode, presence and refresh-token state depend on Redis, so those parts would be impacted. Presence may not update correctly, and refresh-token validation would fail. In a fuller production setup I would add health checks, fallback handling, and possibly separate degradation strategies, but for this project I kept the implementation focused.

### 8. Why not store messages in Redis too?

Because messages are durable business data and belong in PostgreSQL as the source of truth. Redis is better here for fast, distributed runtime state. Using Redis as the main message store would complicate durability and query behavior unless there was a clear scaling reason.

### 9. How would you support multiple backend instances for room-message fanout?

Right now presence and token state can already be distributed through Redis, but STOMP fanout still uses the in-process broker. To scale room-message fanout properly, I would move to a broker relay or an external pub/sub/event system so all instances can publish and consume the same realtime events consistently.

### 10. How would you secure attachments further?

I would improve content validation beyond extension and MIME-type checks, add virus scanning in a stronger production setup, and likely move storage to object storage like S3 with controlled signed access. For this project, I kept authenticated attachment endpoints and server-side validation as the first layer.

## System Design Follow-Up Questions

### 1. How would you scale this chat system to many concurrent users?

I would separate concerns first. PostgreSQL would remain the source of truth for durable data, Redis would continue handling distributed runtime state, and websocket fanout would move off the in-process broker to a shared broker or relay. I would also review database indexing, connection pooling, and pagination/query strategies for chat history and search.

### 2. How would you make presence more accurate at scale?

I would keep the session-based model but add stronger heartbeat handling, possibly periodic reconciliation, and metrics around active sessions versus recent activity. I would also think about whether presence should be eventually consistent or strongly consistent, depending on the product requirement.

### 3. How would you design offline message delivery?

Messages are already persisted in PostgreSQL, so offline delivery would mostly be about reconnect behavior and unread synchronization. On reconnect, the client can fetch missing messages and unread state from the backend, while websocket channels resume live updates from that point onward.

### 4. How would you support read receipts for larger group rooms?

For large rooms I would be careful because full per-message per-user read state can grow quickly. I would likely keep room-level read baselines for most of the UX and only introduce richer read receipts where there is a clear product reason, such as DMs or small groups.

### 5. How would you make search stronger?

For the current scope, database search is fine. If the product grew and search became heavier, I would consider moving to a dedicated search system like Elasticsearch or OpenSearch, especially for ranking, fuzzy search, and large-scale history indexing.

### 6. How would you deploy this in production?

I would containerize the backend and frontend, run PostgreSQL and Redis as managed services or reliable containers, externalize secrets and environment config, and put the backend behind a reverse proxy/load balancer. For realtime scale, I would also move beyond the in-process STOMP broker.

### 7. What metrics would you monitor?

- websocket connection count
- active online users
- message send latency
- unread update latency
- refresh-token refresh rate and failures
- Redis connectivity and command latency
- database query latency and pool saturation
- error rates on auth, messaging, and attachment endpoints

### 8. What is the biggest bottleneck in the current design?

The biggest architectural bottleneck is the in-process websocket broker. It is fine for a single-instance or moderate setup, but it becomes the main scaling constraint once you want horizontal scaling for room fanout.

## HR / Simple Project Questions

### 1. Why did you build this project?

I wanted a project that shows more backend depth than a basic CRUD app. Chat systems naturally involve authentication, realtime communication, state synchronization, authorization, and tradeoffs around consistency, so it was a good way to practice real backend design.

### 2. What part of the project are you most proud of?

I’m most proud that I kept improving the project beyond the first working version. Adding Redis-backed presence, refresh-token rotation, security fixes, and backend tests made it much more defensible technically than a simple demo app.

### 3. What was the hardest part?

The hardest part was keeping realtime behavior, auth, and state synchronization clean at the same time. It is easy for chat projects to work in a demo and still have weak architecture. The challenge was making the flows easier to reason about and safer.

### 4. What did you learn from this project?

I learned how much design matters in backend systems with realtime behavior. I also learned that adding infrastructure like Redis only makes sense when it solves a clear problem, and that advanced features are much more credible when they are backed by tests.

### 5. If you were explaining this to a non-technical interviewer, how would you describe it?

I built a chat platform where people can communicate in real time, create rooms, send direct messages, and stay updated instantly when new activity happens. The interesting backend part is that I designed it to manage live connections, user sessions, and authentication in a more realistic way than a simple demo project.

### 6. Why is this project relevant for a backend role?

Because most of the complexity is in backend behavior: authentication, authorization, realtime messaging, state synchronization, Redis integration, database design, and testability. The frontend exists to make the system usable, but the strongest engineering work here is in the backend.

### 7. What would you say if an interviewer asks whether this is production-ready?

I would say it is production-style and thoughtfully designed, but not fully production-ready yet. It has good foundations like Redis-backed state, refresh-token rotation, and tests, but full multi-instance websocket fanout, stronger secret handling, and broader integration testing would still be needed for a true production deployment.

## Interview Talking Points

- I used Redis where it solved a real architectural problem, not as a generic cache. Presence and refresh-token state were moved behind store abstractions so the app can run in memory locally and use Redis when multi-instance coordination matters.
- I separated core writes from realtime fanout using Spring application events and transactional listeners. That kept message creation, DM request creation, and room updates easier to reason about.
- I treated websocket security as a backend concern. Typing events only go through validated app destinations so membership checks cannot be bypassed by direct topic publishing.
- I added backend tests around refresh-token rotation and presence behavior so the more advanced flows are not just demo features.

## Technical Decisions

### Redis for Presence

- `PresenceStore` abstracts presence tracking
- `InMemoryPresenceStore` supports simple local development
- `RedisPresenceStore` tracks websocket sessions, user session sets, and TTL refresh for distributed online state

Why it matters:

- presence is no longer tied to one JVM instance
- the implementation is still simple enough for a fresher project

### Refresh-Token Rotation

- refresh tokens carry a unique `jti`
- the backend stores valid refresh-token identities in a `RefreshTokenStore`
- refresh revokes the old token and issues a new token pair
- logout revokes the active refresh token

Why it matters:

- this is a more credible auth design than returning refresh tokens without lifecycle control

### Event-Driven Realtime Updates

- message creation publishes `MessageCreatedEvent`
- DM requests publish `DmRequestCreatedEvent`
- room mutations publish `RoomUpsertedEvent`

Why it matters:

- business writes stay in service code
- websocket side effects happen after commit

## Good Resume Keywords

- Spring Boot
- Java 17
- PostgreSQL
- Redis
- WebSocket
- STOMP
- JWT
- REST APIs
- Distributed presence
- Refresh-token rotation
- Event-driven backend
- Real-time messaging
- Backend testing

## Safe Claims You Can Make

- Built a real-time chat backend with Spring Boot, PostgreSQL, WebSocket/STOMP, and Redis
- Implemented distributed presence tracking and refresh-token rotation
- Designed layered backend services with event-driven realtime side effects
- Added automated tests for auth rotation and presence/session behavior

## Claims To Avoid Unless You Add More

- "Production-ready at scale"
- "Microservices architecture"
- "Fully distributed realtime messaging"
- "High-availability websocket infrastructure"

Right now the project is strong, but full multi-instance websocket fanout still uses the in-process Spring broker.
