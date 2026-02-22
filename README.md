# Chat App

Real-time chat service built with Java 17, Spring Boot 3.4, PostgreSQL, and WebSocket (STOMP).

## Features

- **Authentication** — JWT-based (register, login, access/refresh tokens)
- **Chat Rooms** — Create rooms, manage members (OWNER/ADMIN/MEMBER roles)
- **Real-Time Messaging** — STOMP over WebSocket with post-commit broadcast
- **Message History** — Paginated REST endpoint
- **Idempotency** — Duplicate message prevention via client-generated keys
- **Security** — BCrypt password hashing, JWT handshake auth for WebSocket

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Spring Boot 3.4 |
| Database | PostgreSQL |
| Auth | JWT (HMAC-SHA384) + BCrypt |
| Real-Time | STOMP over WebSocket |
| ORM | Spring Data JPA (Hibernate) |

## Prerequisites

- Java 17+
- PostgreSQL with a database named `chatapp`
- Maven

## Run

```bash
mvn spring-boot:run
```

App starts on **port 9090**.

## API

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | No | Register a new user |
| POST | `/api/auth/login` | No | Login, get JWT |
| POST | `/api/rooms` | Yes | Create a chat room |
| GET | `/api/rooms` | Yes | List your rooms |
| GET | `/api/rooms/{id}` | Yes | Room details |
| GET | `/api/rooms/{id}/members` | Yes | List members |
| POST | `/api/rooms/{id}/members` | Yes | Add a member |
| DELETE | `/api/rooms/{id}/members/{userId}` | Yes | Remove a member |
| GET | `/api/rooms/{id}/messages?page=0&size=50` | Yes | Message history |

**WebSocket:** `ws://localhost:9090/ws?token=<JWT>`
- Subscribe: `/topic/room/{roomId}`
- Send: `/app/chat/{roomId}`
