# Whisprly

Whisprly is a **real-time messaging platform** built with **Spring Boot
and React**.\
It supports direct messaging, group rooms, attachments, message
lifecycle features, and live presence updates using WebSockets.

The project focuses on **real-time communication architecture,
conversation state management, and scalable messaging features similar
to modern chat platforms.**

------------------------------------------------------------------------

# UI Preview

Add screenshots here.

/screenshots chat.png room-settings.png pinned-message.png
attachments.png

Example:

![Chat UI](screenshots/chat.png)

------------------------------------------------------------------------

# Key Features

-   Real-time messaging using **WebSocket/STOMP**
-   Direct messages and **group chat rooms**
-   **Message editing and soft deletion**
-   **Pinned messages**
-   **File and media attachments**
-   **Unread message counters**
-   **Presence and typing indicators**
-   **Global and room-level message search**
-   **Self-destructing messages**
-   **JWT-based authentication**

------------------------------------------------------------------------

# Tech Stack

### Backend

-   Java 17
-   Spring Boot 3
-   Spring Security (JWT)
-   Spring Data JPA / Hibernate
-   Spring WebSocket (STOMP)
-   PostgreSQL
-   Maven

### Frontend

-   React
-   WebSocket client
-   REST API integration

------------------------------------------------------------------------

# System Architecture

React Client │ │ REST / WebSocket ▼ Spring Boot API │ ├── Controller
Layer ├── Service Layer ├── Repository Layer └── WebSocket Broker │ ▼
PostgreSQL Database

The backend manages authentication, message delivery, room membership,
presence updates, and message lifecycle events.

------------------------------------------------------------------------

# Core Domain Concepts

### User

Authenticated account identity.

### ChatRoom

Conversation container supporting **DM or GROUP modes**.

### ChatRoomMember

Tracks per-user membership state including roles, pin state, and read
markers.

### Message

Represents chat events including text or attachments with lifecycle
states such as edited, deleted, pinned, or expired.

### DmRequest

Workflow used to initiate direct message conversations.

------------------------------------------------------------------------

# Real-Time Communication Flow

1.  Client authenticates and connects to the WebSocket endpoint.
2.  Client subscribes to room-specific and user-specific channels.
3.  Messages, typing indicators, and presence updates are broadcast via
    STOMP.
4.  Backend persists message state and publishes derived updates such as
    unread counters.

------------------------------------------------------------------------

# Message Lifecycle

-   Messages are stored with sender and room metadata.
-   Attachments are validated and stored with retrievable URLs.
-   Edited or deleted messages update lifecycle state without breaking
    timeline continuity.
-   Expired messages are handled by scheduler-driven cleanup tasks.
-   Read acknowledgements update per-member `lastReadAt` markers.

------------------------------------------------------------------------

# Backend Architecture

Layered architecture design:

controller service repository model dto security storage

-   **Controller Layer** -- REST and WebSocket entry points
-   **Service Layer** -- business logic and rules
-   **Repository Layer** -- database access via JPA
-   **Security Layer** -- JWT authentication and request protection
-   **Storage Layer** -- attachment validation and file storage

------------------------------------------------------------------------

# API Capabilities

### Authentication

-   Register
-   Login
-   Token validation

### Rooms

-   Create room
-   Join room
-   Manage members
-   Update room configuration

### Messages

-   Send message
-   Edit message
-   Delete message
-   Pin / unpin message
-   Fetch message history
-   Attachment retrieval

### Search

-   Global message search
-   Room-specific search

### Presence

-   Online status
-   Typing indicators

### Unread Tracking

-   Per-room read markers
-   Unread message counters

------------------------------------------------------------------------

# Running the Project

### Requirements

-   Java 17
-   Node.js
-   PostgreSQL

### Backend

cd backend mvn spring-boot:run

### Frontend

cd frontend npm install npm start

### Database

Create a PostgreSQL database:

CREATE DATABASE whisprly;

Update connection details in:

src/main/resources/application.properties

------------------------------------------------------------------------

# Project Characteristics

-   Conversation-centric architecture
-   Real-time-first user experience
-   Durable persistence for message history
-   Modern messaging features such as pinning, presence, unread
    counters, and ephemeral messaging

