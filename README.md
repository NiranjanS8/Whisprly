# Chat App

Full-stack real-time chat application with a Spring Boot backend and a React + Vite frontend.

## Tech Stack
- Backend: Java 17, Spring Boot 3.4, Spring Security, Spring Data JPA, WebSocket (STOMP)
- Database: PostgreSQL
- Frontend: React 19, TypeScript, Vite, Zustand
- Auth: JWT access + refresh tokens

## Repository Structure
- `src/` - Spring Boot backend source
- `frontend/` - React/Vite frontend
- `uploads/` - runtime attachment storage (ignored in git)

## Prerequisites
- Java 17+
- Maven 3.9+
- Node.js 20+
- PostgreSQL 14+

## Backend Setup
1. Create a PostgreSQL database named `chatapp`.
2. Update datasource and JWT config in `src/main/resources/application.yml` or override with environment variables.
3. Run backend:

```bash
mvn spring-boot:run
```

Backend default URL: `http://localhost:9090`

## Frontend Setup
1. Install dependencies:

```bash
cd frontend
npm install
```

2. Start dev server:

```bash
npm run dev
```

Frontend default URL is typically `http://localhost:5173`.

## Build
Backend:

```bash
mvn clean package
```

Frontend:

```bash
cd frontend
npm run build
```

## Notes
- WebSocket endpoint: `ws://localhost:9090/ws`
- File uploads are stored under `uploads/` by default.
- Current `application.yml` contains hardcoded local credentials/secrets for development. Move these to environment variables before sharing/deploying.