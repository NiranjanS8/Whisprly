# Whisprly — Frontend System Design

**Stack:** React 18 · TypeScript · Vite · STOMP.js · Zustand · CSS Modules  
**Backend:** Spring Boot 3.4 on port 9090 (REST + STOMP over WebSocket)  
**App Identity:** Whisprly — real-time chat, production-grade

---

## 1. Technology & Architectural Choices

### 1.1 Framework Selection: React

React is chosen over Angular, Vue, or Svelte for this project:

| Criterion | React | Angular | Vue | Svelte |
|---|---|---|---|---|
| **Real-time UI** | Fine-grained re-render control via `memo`, `useMemo`, `useCallback` | Zone.js change detection — entire component tree checked on every async event (WebSocket messages = constant re-renders) | Comparable reactivity, smaller ecosystem for WS tooling | Excellent reactivity but immature STOMP/WS library ecosystem |
| **Concurrent rendering** | React 18's `startTransition` deprioritizes expensive renders (message history) in favor of urgent updates (incoming message) | No equivalent | No equivalent | No equivalent |
| **Ecosystem** | STOMP.js, SockJS, Zustand, TanStack Query — all first-class React integrations | RxJS-native (good for streams, but heavier) | Pinia is excellent, but fewer WS-specific patterns | Limited |
| **Hiring & maintenance** | Largest talent pool | Second largest | Growing | Small |

**Why not Next.js?** A chat app is a **client-heavy SPA** — there is no SEO requirement for chat messages, no server-side rendering benefit. Next.js adds routing complexity, server components, and build-time overhead that provide zero value for a real-time messaging UI. Vite + React Router is simpler, faster to build, and faster to serve.

### 1.2 Folder Structure

```
src/
├── app/
│   ├── App.tsx                    ← Root layout, router, providers
│   ├── router.tsx                 ← Route definitions
│   └── providers.tsx              ← Context providers (auth, theme, websocket)
├── features/
│   ├── auth/
│   │   ├── components/            ← LoginForm, RegisterForm
│   │   ├── hooks/                 ← useAuth, useAuthGuard
│   │   ├── services/              ← authApi.ts (register, login, refresh)
│   │   ├── store/                 ← authStore.ts (Zustand slice)
│   │   └── types.ts
│   ├── rooms/
│   │   ├── components/            ← RoomList, RoomCard, CreateRoomModal
│   │   ├── hooks/                 ← useRooms, useRoomMembers
│   │   ├── services/              ← roomApi.ts
│   │   ├── store/                 ← roomStore.ts
│   │   └── types.ts
│   └── chat/
│       ├── components/            ← MessageList, MessageBubble, ChatInput
│       ├── hooks/                 ← useMessages, useWebSocket, useChatScroll
│       ├── services/              ← messageApi.ts, websocket.ts
│       ├── store/                 ← chatStore.ts
│       └── types.ts
├── shared/
│   ├── components/                ← Button, Input, Modal, Avatar, Skeleton
│   ├── hooks/                     ← useDebounce, useIntersectionObserver
│   ├── services/                  ← httpClient.ts (axios/fetch wrapper)
│   ├── styles/                    ← variables.css, reset.css, animations.css
│   └── utils/                     ← formatTime.ts, idempotencyKey.ts
└── assets/                        ← Icons, fonts
```

**Why feature-based, not layer-based:** In a layer-based structure (`components/`, `services/`, `hooks/`), adding a new feature touches every directory. In a feature-based structure, a new feature (e.g., "reactions") is a new folder under `features/` — self-contained. This matters for:
- **Cognitive load** — a developer working on chat doesn't see auth files
- **Lazy loading** — feature folders map cleanly to code-split boundaries
- **Deletion** — removing a feature is `rm -rf features/reactions/`

### 1.3 State Management Strategy

**Principle: Server state ≠ UI state. They require different tools.**

| State Type | Tool | Examples |
|---|---|---|
| **Server state** (cached data from API) | TanStack Query (React Query) | Room list, message history, user profile |
| **Real-time state** (WebSocket stream) | Zustand | Incoming messages, connection status, typing indicators |
| **UI state** (ephemeral, local) | `useState` / `useReducer` | Modal open/close, input value, sidebar collapsed |
| **Shared UI state** (cross-component) | Zustand or Context | Active room ID, theme, auth tokens |

**Why separate server state from real-time state?**

TanStack Query is optimized for **request-response** patterns: caching, background refetching, stale-while-revalidate. But WebSocket messages are **push-based** — they arrive without a request. Forcing WebSocket data through TanStack Query (manually calling `queryClient.setQueryData`) creates a leaky abstraction:
- Stale time and refetch intervals don't apply to pushed data
- Cache invalidation logic conflicts with the real-time stream
- You lose TanStack Query's `isLoading` / `isFetching` semantics

Instead: TanStack Query handles REST data (message history, room list). Zustand stores real-time data (live messages, connection status). The chat component merges both: `[...queryData.messages, ...zustandStore.liveMessages]`.

### 1.4 Why Component-Driven Design Matters in Real-Time Apps

In a real-time chat, a single WebSocket message triggers an update that could re-render the **entire** message list, sidebar room previews, unread counts, and notification badges. Without component boundaries:

```
WebSocket message arrives
  → chatStore updates
  → App re-renders (root subscriber)
  → Sidebar re-renders (doesn't need this message)
  → RoomList re-renders (only needs unread count update, not message content)
  → MessageList re-renders (correct, but re-renders ALL messages)
  → ChatInput re-renders (doesn't need this at all)
```

With isolated, memoized components:

```
WebSocket message arrives
  → chatStore updates
  → MessageList re-renders (subscribed to messages array for active room)
  → RoomList re-renders ONLY the affected room's preview (subscribed to room-level data)
  → Other components: no re-render (React.memo boundary + Zustand selector equality)
```

**Zustand selectors are the key:** `const messages = useChatStore(state => state.rooms[roomId]?.messages)` — this selector only triggers re-render when the specific room's messages array changes, not when any store property changes.

---

## 2. Authentication Flow & Security

### 2.1 Token Storage Strategy

| Storage | XSS Vulnerable? | CSRF Vulnerable? | Survives Refresh? | Verdict |
|---|---|---|---|---|
| **localStorage** | ✅ Yes — any XSS reads it | No | Yes | ❌ Rejected |
| **sessionStorage** | ✅ Yes — any XSS reads it | No | No | ❌ Rejected |
| **In-memory variable** | ❌ No (not in DOM) | No | No | ✅ Access token |
| **HttpOnly cookie** | ❌ No (JS can't read it) | ✅ Yes (mitigated with SameSite) | Yes | ✅ Refresh token (future, requires backend support) |

**Phase 1 approach:** Store the access token in a **Zustand store** (in-memory JavaScript variable). It is never written to localStorage, sessionStorage, or cookies. This means:
- XSS cannot exfiltrate the token (no DOM API to read it)
- Tab refresh loses the token → user must re-login (acceptable tradeoff for Phase 1)
- Multiple tabs each have their own token instance

```typescript
// authStore.ts — token lives in closure, not in persistent storage
interface AuthState {
  accessToken: string | null;        // in-memory only
  userId: string | null;
  username: string | null;
  setAuth: (response: AuthResponse) => void;
  clearAuth: () => void;
}
```

### 2.2 Handling Short-Lived Access Tokens

The access token expires in 15 minutes. The frontend must handle this transparently:

```
User action → API call → 401 Unauthorized
  → Intercept in httpClient
  → Call /api/auth/refresh (sends refresh token)
  → New access token received
  → Retry original request with new token
  → If refresh fails → redirect to login
```

**Critical implementation detail — request queuing:** If three API calls happen simultaneously and the token is expired, all three receive 401. Without coordination, all three trigger a refresh call → three concurrent refresh requests → backend invalidates the first two refresh tokens (rotation) → two valid tokens exist → security risk.

**Solution: Mutex on refresh.** A single `refreshPromise` variable:

```typescript
let refreshPromise: Promise<string> | null = null;

async function getValidToken(): Promise<string> {
  if (isTokenExpired(store.accessToken)) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    return refreshPromise;
  }
  return store.accessToken;
}
```

All concurrent callers await the same promise. Only one refresh request is made.

### 2.3 Protecting WebSocket Connection

The WebSocket handshake carries the JWT as a query parameter:

```typescript
const socket = new SockJS(`http://localhost:9090/ws?token=${accessToken}`);
```

**Security concerns and mitigations:**

| Concern | Mitigation |
|---|---|
| Token in URL visible in browser history | Access token is short-lived (15 min); URL is `ws://` not `http://` — not saved in browser history |
| Token in server access logs | Backend must scrub query params from access logs |
| Token in dev tools Network tab | Unavoidable for developers; token is short-lived |
| Token intercepted in transit | TLS (wss://) encrypts the URL in transit |

### 2.4 Reconnection When Token Expires

```
WebSocket connected (token valid)
  ├── Token expires (15 min)
  │   ├── Server closes connection (or next SEND fails)
  │   ├── Client detects disconnect
  │   ├── Client calls refresh endpoint
  │   ├── New access token received
  │   ├── Client reconnects with new token:
  │   │   new SockJS(`/ws?token=${newToken}`)
  │   └── Client re-subscribes to room topics
  │
  └── Refresh token also expired (7 days)
      └── Redirect to login page
```

**Pitfall — zombie subscriptions:** After reconnection, the STOMP client gets a new session ID. Old subscriptions are gone. The client must **re-subscribe** to all active rooms after each reconnect. Failure to do so = messages stop arriving silently with no error.

### 2.5 Token Leakage Prevention

| Action | Rule |
|---|---|
| `console.log(response)` | **Never** log auth response objects in production. Use a logger that strips `accessToken` / `refreshToken` fields. |
| Error reporting (Sentry) | Configure `beforeSend` to scrub `Authorization` headers and URL query params. |
| React DevTools | Zustand store is inspectable in React DevTools. Disable Zustand devtools middleware in production builds. |
| Network tab | Token is visible in the WebSocket upgrade request. Unavoidable; relies on short token lifetime. |

---

## 3. WebSocket Lifecycle Management

### 3.1 Connection Initialization & Teardown

```
Component mounts (ChatLayout)
  → useWebSocket() hook initializes
  → Checks: accessToken exists?
  → Creates SockJS connection
  → Creates STOMP client over SockJS
  → STOMP CONNECT
  → On CONNECTED: set connectionStatus = 'connected'
  → Subscribe to /topic/room/{activeRoomId}
  → Subscribe to /user/queue/errors

Component unmounts
  → STOMP DISCONNECT (sends DISCONNECT frame)
  → SockJS close()
  → connectionStatus = 'disconnected'
  → Clear all subscription references
```

**Where does the WebSocket live?** Not in a component. In a **Zustand store action** or a **standalone service singleton**. Components mount and unmount — if the WebSocket is tied to a component's lifecycle, navigating between routes kills the connection.

```typescript
// websocket.ts — singleton, not tied to React lifecycle
class WebSocketService {
  private client: Client | null = null;
  private subscriptions: Map<string, StompSubscription> = new Map();

  connect(token: string) { /* ... */ }
  subscribe(roomId: string) { /* ... */ }
  unsubscribe(roomId: string) { /* ... */ }
  disconnect() { /* ... */ }
}

export const wsService = new WebSocketService();
```

### 3.2 Reconnection with Exponential Backoff

When the connection drops (network loss, server restart, token expiry):

```
Attempt 1: wait   1s → reconnect
Attempt 2: wait   2s → reconnect
Attempt 3: wait   4s → reconnect
Attempt 4: wait   8s → reconnect
Attempt 5: wait  16s → reconnect
Attempt 6: wait  30s → reconnect (cap)
...
Attempt N: wait  30s → reconnect (cap)
```

**Why exponential backoff?** If the server is down and 10,000 clients immediately retry every 1 second, the server faces a reconnection storm the instant it comes back up — potentially crashing it again. Exponential backoff spreads reconnection attempts over time.

**Why a cap at 30s?** Without a cap, backoff reaches minutes or hours — unacceptable for a chat app. 30 seconds is the maximum wait a user can tolerate before assuming the app is broken.

**Jitter:** Add random jitter (±20%) to prevent synchronized reconnections. Without jitter, clients that disconnected at the same time will all retry at the same time, recreating the thundering herd problem.

```typescript
function getReconnectDelay(attempt: number): number {
  const base = Math.min(1000 * Math.pow(2, attempt), 30000);
  const jitter = base * 0.2 * (Math.random() * 2 - 1); // ±20%
  return base + jitter;
}
```

### 3.3 Preventing Duplicate Subscriptions

**Problem:** If the user switches rooms quickly (Room A → Room B → Room A), and the subscription to Room A was never unsubscribed, re-subscribing creates a duplicate. Each message is now delivered twice — once per subscription.

**Solution:** Track subscriptions by room ID in a `Map`. Before subscribing, check if a subscription already exists:

```typescript
subscribe(roomId: string) {
  if (this.subscriptions.has(roomId)) return; // already subscribed

  const sub = this.client.subscribe(`/topic/room/${roomId}`, (msg) => {
    // handle message
  });
  this.subscriptions.set(roomId, sub);
}

unsubscribe(roomId: string) {
  const sub = this.subscriptions.get(roomId);
  if (sub) {
    sub.unsubscribe();
    this.subscriptions.delete(roomId);
  }
}
```

### 3.4 Handling Network Loss Without Message Duplication

When the network drops and reconnects:

1. Messages sent during the outage are **not received** via WebSocket
2. After reconnection, the client must fetch missed messages via REST
3. But some messages may have already been received via WebSocket before the drop

**Reconciliation strategy:**

```
Reconnect
  → Record timestamp of last received WebSocket message
  → Fetch messages from REST: GET /api/rooms/{id}/messages?since={lastTimestamp}
  → Merge with existing in-memory messages
  → Deduplicate by message ID (UUID)
  → Sort by createdAt
```

**Deduplication is mandatory.** Without it, the overlap between "messages received before disconnect" and "messages fetched from REST after reconnect" produces visible duplicates in the UI.

### 3.5 Syncing WebSocket with REST History

**Initial room load:**
1. Fetch last 50 messages via REST (`GET /api/rooms/{id}/messages?page=0&size=50`)
2. Subscribe to `/topic/room/{roomId}` via WebSocket
3. Any messages that arrive via WebSocket between steps 1 and 2 could be missed

**Race condition window:** If a message is sent after the REST response but before the WebSocket subscription is established, the message is lost — never delivered.

**Solution — subscribe first, then fetch:**
1. Subscribe to `/topic/room/{roomId}` — buffer incoming messages
2. Fetch last 50 messages via REST
3. Merge WebSocket buffer with REST results, dedup by ID
4. Render the combined, deduplicated, sorted list

This ordering ensures no messages are missed. Some messages may appear in both the buffer and the REST response — deduplication handles that.

---

## 4. Chat State Management

### 4.1 Message List Consistency

The canonical message list for a room is constructed from two sources:

```
                     ┌───────────────────────┐
                     │    Rendered Messages   │
                     │  (sorted by createdAt) │
                     └───────┬───────────────┘
                             │ merge + dedup
                ┌────────────┴────────────┐
                │                         │
    ┌───────────┴──────────┐  ┌──────────┴─────────┐
    │   REST (TanStack Q)  │  │  WebSocket (Zustand) │
    │  Paginated history   │  │  Live incoming msgs  │
    │  Page 0, 1, 2...     │  │  Appended in order   │
    └──────────────────────┘  └──────────────────────┘
```

```typescript
// In the ChatPanel component:
const historyMessages = useQuery(['messages', roomId], () => fetchMessages(roomId));
const liveMessages = useChatStore(state => state.liveMessages[roomId] ?? []);

const allMessages = useMemo(() => {
  const merged = [...(historyMessages.data ?? []), ...liveMessages];
  // Deduplicate by message ID
  const seen = new Set<string>();
  return merged
    .filter(msg => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    })
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}, [historyMessages.data, liveMessages]);
```

### 4.2 Deduplication Strategy

Messages can arrive from multiple sources with overlap:

| Source | When |
|---|---|
| REST fetch on room open | Page load |
| WebSocket subscription | Real-time |
| REST refetch after reconnect | Gap fill |
| Scroll-up pagination fetch | User scrolls to history |

**All messages pass through the same deduplication logic.** The message `id` (UUID, server-assigned) is the dedup key. The `idempotencyKey` (client-generated) is for server-side dedup only — the frontend uses the server-assigned `id`.

### 4.3 Optimistic UI vs Server-Confirmed Rendering

| Strategy | Behavior | When to Use |
|---|---|---|
| **Optimistic** | Message appears instantly in the sender's UI before server confirms. Reverted on failure. | Low-latency feel, casual chat apps |
| **Server-confirmed** | Message appears only after the server broadcast returns via WebSocket. | Financial, medical, or compliance-sensitive contexts |

**Whisprly uses optimistic UI with confirmation:**

```
User types "hello" → presses Send
  → Message appears immediately in UI with status: "sending" (dimmed, no checkmark)
  → STOMP SEND to /app/chat/{roomId}
  → Server persists, broadcasts to /topic/room/{roomId}
  → Client receives own message back via WebSocket subscription
  → Match by idempotencyKey → update status: "sent" (full opacity, checkmark)
  → If timeout (5s, no confirmation) → status: "failed" (red, retry button)
```

**Why match by `idempotencyKey` and not content?** Two users can send the same text simultaneously. Content matching would incorrectly confirm the wrong message. The `idempotencyKey` is unique per send attempt.

**The delivery status model:**

```typescript
type MessageStatus = 'sending' | 'sent' | 'failed';

interface ChatMessage {
  id?: string;              // absent for optimistic messages (not yet server-confirmed)
  idempotencyKey: string;   // client-generated, used for matching
  content: string;
  senderId: string;
  senderUsername: string;
  createdAt: string;
  status: MessageStatus;
}
```

### 4.4 Message Ordering & Pagination Drift

**Problem:** User scrolls up to load page 2 of history. While loading, 3 new messages arrive via WebSocket. The REST response for page 2 was calculated based on the old message count — the offset has shifted by 3. Result: messages at the boundary between page 1 and page 2 may be duplicated or skipped.

**Solution — cursor-based pagination instead of offset-based:**

```
GET /api/rooms/{id}/messages?before={oldestMessageId}&size=50
```

Instead of `?page=1&size=50` (offset-based, shifts when new messages arrive), use `?before={id}` (cursor-based, stable regardless of new inserts). The cursor is the ID of the oldest currently-loaded message.

> **Note:** This requires a backend change. If the backend only supports offset pagination, the frontend must accept occasional duplicates at page boundaries and deduplicate client-side.

---

## 5. UI/UX Design Principles

### 5.1 Layout Strategy

```
┌─────────────────────────────────────────────────────────────┐
│  Whisprly                                    🌙  👤 alice   │
├──────────────┬──────────────────────────────────────────────┤
│              │                                              │
│  🔍 Search   │  # General                        👥 5       │
│              │                                              │
│  ┌──────────┐│  ┌──────────────────────────────────────┐    │
│  │ General ●││  │ alice: Hey everyone!      2:30 PM    │    │
│  │          ││  │ bob: What's up?           2:31 PM    │    │
│  │ Design   ││  │ alice: Working on the UI  2:32 PM    │    │
│  │          ││  │                                      │    │
│  │ Random   ││  │                                      │    │
│  │          ││  │                                      │    │
│  └──────────┘│  └──────────────────────────────────────┘    │
│              │                                              │
│  + New Room  │  ┌──────────────────────────────── Send ┐    │
│              │  │ Type a message...                     │    │
│              │  └──────────────────────────────────────┘    │
├──────────────┴──────────────────────────────────────────────┤
│  ● Connected                                                │
└─────────────────────────────────────────────────────────────┘
```

**Desktop:** Fixed sidebar (280px) + fluid main panel. Sidebar shows rooms with unread indicators. Main panel has message list (flex-grow) + input (fixed bottom).

**Mobile (< 768px):** Sidebar is a full-screen overlay triggered by a hamburger menu. Selecting a room closes the sidebar and shows the chat panel. Back button returns to the room list.

**CSS architecture:**

```css
/* Layout uses CSS Grid, not flexbox nesting */
.app-layout {
  display: grid;
  grid-template-columns: 280px 1fr;
  grid-template-rows: 56px 1fr 32px;
  height: 100vh;
}

@media (max-width: 768px) {
  .app-layout {
    grid-template-columns: 1fr;
  }
  .sidebar {
    position: fixed;
    inset: 0;
    z-index: 100;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
  }
  .sidebar.open {
    transform: translateX(0);
  }
}
```

### 5.2 Message Virtualization

A room with 10,000 messages cannot render 10,000 DOM nodes. The browser will freeze.

**Virtualization:** Only messages visible in the viewport (+ a small buffer above/below) are rendered as DOM nodes. As the user scrolls, off-screen nodes are destroyed and new ones created.

**Library choice:** `react-virtuoso` — purpose-built for chat with:
- **Reverse scrolling** (newest at bottom, older messages load on scroll-up)
- **Sticky bottom** behavior (auto-scroll when a new message arrives, but not if the user has scrolled up)
- **Dynamic item heights** (messages vary in length — fixed-height virtualization breaks)

```typescript
<Virtuoso
  data={messages}
  initialTopMostItemIndex={messages.length - 1}
  followOutput="smooth"        // auto-scroll on new message if at bottom
  itemContent={(index, msg) => <MessageBubble message={msg} />}
  components={{ Header: () => isLoadingMore ? <Spinner /> : null }}
  startReached={loadOlderMessages}  // infinite scroll upward
/>
```

**Why not `react-window`?** `react-window` requires fixed item heights or pre-measured heights. Chat messages have variable heights (short messages, long paragraphs, code blocks). `react-virtuoso` handles dynamic heights natively.

### 5.3 Loading States & Skeletons

| State | UI |
|---|---|
| Room list loading | 5 skeleton cards (pulsing rectangles mimicking room name + last message preview) |
| Message history loading | 8 skeleton bubbles alternating left/right |
| Sending a message | Optimistic bubble with reduced opacity + spinner icon |
| WebSocket connecting | "Connecting..." pill in status bar |
| WebSocket reconnecting | "Reconnecting..." pill with animated dots |
| Error (failed to load) | Inline error with "Retry" button inside the content area, not a toast |

**Rule:** Never show a blank screen. Skeletons maintain layout stability and signal progress. They should match the dimensions of the actual content to prevent layout shift when data loads.

### 5.4 Typing Indicators & Presence (Design Only)

**Typing indicators** — not implemented in Phase 1, but designed for:

```
User starts typing → send STOMP /app/typing/{roomId} with { userId, isTyping: true }
  → Other clients receive on /topic/room/{roomId}/typing
  → Show "alice is typing..." below message list
  → Debounce: if no keystroke for 3 seconds, send { isTyping: false }
  → Server does NOT persist typing events — fire-and-forget
```

**Presence** — online/offline status:

```
STOMP CONNECT → server marks user as online
STOMP DISCONNECT → server marks user as offline
  → Broadcast presence change to rooms the user is in
  → Client shows green/grey dot next to username
  → Timeout: if no heartbeat in 30s, mark as offline (handles ungraceful disconnect)
```

### 5.5 Slow Network & Offline UX

| Network State | Behavior |
|---|---|
| **Slow (> 2s latency)** | Messages stay in "sending" state longer. No special UI — the status indicator is sufficient. |
| **Offline (no connection)** | Status bar: "You are offline". Input disabled with tooltip "Reconnect to send messages". Messages received before disconnect remain visible. |
| **Reconnecting** | Status bar: "Reconnecting... (attempt 3)". Messages are queued locally. On reconnect, queued messages are sent in order with their original `idempotencyKey` → server deduplicates if any were partially sent. |

---

## 6. Performance & Scalability

### 6.1 List Virtualization

Covered in §5.2. The critical metric: rendering 10,000 messages should use < 50 DOM nodes at any time.

### 6.2 Minimizing Re-Renders

**The #1 performance killer in real-time React apps is unnecessary re-rendering.**

**Problem:** A chat room with 30 participants sending 5 messages/second = 150 store updates/second. If each update re-renders the entire message list, the UI freezes.

**Strategies:**

| Technique | What It Prevents |
|---|---|
| `React.memo()` on `MessageBubble` | Re-rendering unchanged messages when a new message is appended |
| Zustand selectors with equality | Re-rendering components that subscribe to unrelated store slices |
| `useMemo()` for merged message list | Re-deriving the sorted, deduped list on every render |
| `useCallback()` for event handlers | Recreating handler functions that are passed as props |
| Virtualization | Rendering DOM nodes for off-screen messages |

**Zustand subscription granularity:**

```typescript
// ❌ BAD: re-renders on ANY store change
const store = useChatStore();

// ✅ GOOD: re-renders only when this room's messages change
const messages = useChatStore(
  state => state.rooms[roomId]?.messages,
  shallow  // shallow equality comparison
);
```

### 6.3 Memory Management for Long Sessions

A user may keep a chat tab open for **days**. Memory grows unbounded if messages accumulate:

| Strategy | Implementation |
|---|---|
| **Cap in-memory messages per room** | Keep latest 200 messages in Zustand. Older messages exist only in TanStack Query cache (evictable). |
| **Remove inactive room data** | If a room hasn't been viewed in 10 minutes, evict its messages from the Zustand store. Re-fetch on next view. |
| **WebSocket heartbeat** | STOMP heartbeats (every 10s) detect zombie connections. If the tab is backgrounded and heartbeats fail, disconnect gracefully to free server resources. |
| **Cleanup on tab visibility** | Use `document.visibilitychange` event. When the tab becomes hidden, reduce polling frequency. When visible again, sync missed messages via REST. |

### 6.4 Throttling UI Updates Under Burst Traffic

If 100 messages arrive in 1 second (e.g., a bot floods a room), rendering each one individually causes 100 re-renders. Instead:

**Batch incoming messages:**

```typescript
// Buffer incoming WebSocket messages and flush every 100ms
let messageBuffer: ChatMessage[] = [];
let flushTimer: number | null = null;

function onMessageReceived(msg: ChatMessage) {
  messageBuffer.push(msg);

  if (!flushTimer) {
    flushTimer = window.setTimeout(() => {
      chatStore.appendMessages(activeRoomId, messageBuffer);
      messageBuffer = [];
      flushTimer = null;
    }, 100);  // 100ms flush interval → max 10 re-renders/second
  }
}
```

**React 18's automatic batching** already batches state updates within the same microtask. But WebSocket callbacks run in separate macrotasks — each message = one render cycle. The manual buffer above solves this.

---

## 7. Error Handling & Resilience

### 7.1 Failed Message Sends

```
User sends message → optimistic render (status: 'sending')
  → STOMP SEND to /app/chat/{roomId}
  │
  ├── Success: server broadcasts back → status: 'sent' ✓
  │
  ├── No confirmation after 5s → status: 'failed'
  │     → Show retry button on the message bubble
  │     → User taps retry → resend with SAME idempotencyKey
  │     → Server deduplicates if original actually succeeded
  │
  └── WebSocket disconnected during send → message queued in local buffer
        → On reconnect: replay buffer in order
        → Each message retains its original idempotencyKey
```

### 7.2 Retry UX

| Failure | User Sees | Action |
|---|---|---|
| Single message fails | Red indicator on message + "Retry" / "Delete" | Tap retry to resend |
| Multiple messages fail | Red banner: "3 messages failed to send" | "Retry All" button |
| Room data fails to load | Inline error with "Retry" button | Refetches room data |
| Auth refresh fails | Redirect to login page with "Session expired" message | Re-login |

**Never use silent retries for user-initiated actions.** If the user clicked "Send" and it failed, they need to know. Silent retry risks duplicates (if the original partially succeeded) and confuses the user (message appears to have been sent but no one responds).

### 7.3 WebSocket Disconnect Behavior

```
Disconnect detected
  → Status bar: "Reconnecting..." (yellow)
  → Input field: remains enabled (messages queued locally)
  → After 3 failed attempts: status bar turns red: "Unable to connect"
  → Input field: show tooltip "Messages will be sent when reconnected"
  → After successful reconnect:
      → Status bar: "Connected" (green, fades after 3s)
      → Flush queued messages
      → Fetch missed messages via REST
      → Merge + dedup
```

### 7.4 Distinguishing Error Types

| Error | Source | User-Facing Behavior |
|---|---|---|
| **401 Unauthorized** | REST API / WebSocket handshake | Token expired → attempt refresh → if refresh fails → redirect to login |
| **403 Forbidden** | REST API | "You don't have access to this room" — do NOT retry |
| **Network error** (`ERR_CONNECTION_REFUSED`) | Fetch / WebSocket | "Unable to reach server" — retry with backoff |
| **WebSocket close frame** | Server | Check close code: 1000 (normal) vs 1008 (policy violation = auth failure) vs 1006 (abnormal = network) |
| **STOMP ERROR frame** | Server | Display error message from frame body in a non-intrusive banner |

**Critical distinction:** A 403 should **not** trigger a retry or reconnect. The user is authenticated but not authorized. Retrying will always fail. The UI should show a clear "Access denied" message and potentially navigate the user away from the restricted resource.

---

## 8. Accessibility & Modern Design

### 8.1 Responsive Layout

| Breakpoint | Layout |
|---|---|
| **≥ 1024px** (desktop) | Sidebar (280px) + chat panel. Both visible. |
| **768px–1023px** (tablet) | Sidebar collapses to icons (64px). Hover/click expands. |
| **< 768px** (mobile) | Full-screen views. Room list → tap room → full-screen chat. Back button navigates. |

### 8.2 Keyboard Navigation

| Key | Action |
|---|---|
| `Enter` | Send message |
| `Shift+Enter` | New line in message input |
| `Escape` | Close modal / deselect |
| `↑` / `↓` | Navigate room list when sidebar is focused |
| `Ctrl+K` / `Cmd+K` | Focus room search |
| `Tab` | Navigate between sidebar → message area → input |

**ARIA attributes:**
- Message list: `role="log"`, `aria-live="polite"` (screen reader announces new messages without interrupting)
- Room list: `role="listbox"`, each room is `role="option"` with `aria-selected`
- Chat input: `role="textbox"`, `aria-label="Type a message"`
- Status bar: `role="status"`, `aria-live="polite"`

### 8.3 Theme Architecture

**CSS custom properties** with a theme class on `<html>`:

```css
/* shared/styles/variables.css */
:root {
  /* Light theme (default) */
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f7;
  --bg-tertiary: #e8e8ed;
  --text-primary: #1d1d1f;
  --text-secondary: #6e6e73;
  --accent: #6c5ce7;
  --accent-hover: #5a4bd1;
  --message-own: #6c5ce7;
  --message-own-text: #ffffff;
  --message-other: #f0f0f5;
  --message-other-text: #1d1d1f;
  --danger: #ff3b30;
  --success: #34c759;
  --warning: #ff9500;
  --border: #d2d2d7;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
}

[data-theme="dark"] {
  --bg-primary: #1a1a2e;
  --bg-secondary: #16213e;
  --bg-tertiary: #0f3460;
  --text-primary: #e4e4e7;
  --text-secondary: #a1a1aa;
  --accent: #a78bfa;
  --accent-hover: #8b5cf6;
  --message-own: #7c3aed;
  --message-own-text: #ffffff;
  --message-other: #27274a;
  --message-other-text: #e4e4e7;
  --danger: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --border: #2d2d5e;
  --shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
}
```

**Theme toggle:** `document.documentElement.setAttribute('data-theme', 'dark')`. Preference persisted to `localStorage('whisprly-theme')` and respects `prefers-color-scheme` on first visit.

**Why CSS custom properties over CSS-in-JS theming?** CSS custom properties update at the browser level — one DOM mutation toggles the entire theme. CSS-in-JS (styled-components, Emotion) recomputes styles in JavaScript and re-renders every themed component. For a real-time app receiving frequent updates, this is measurable overhead.

### 8.4 Animation Guidelines

| Animation | Duration | Easing | Purpose |
|---|---|---|---|
| New message slide-in | 200ms | `ease-out` | Signal arrival without jarring pop-in |
| Message status transition | 150ms | `ease` | Smooth transition from "sending" to "sent" |
| Sidebar toggle (mobile) | 250ms | `ease-in-out` | Spatial continuity |
| Modal open/close | 200ms | `cubic-bezier(0.4, 0, 0.2, 1)` | Material Design standard |
| Skeleton pulse | 1.5s loop | `ease-in-out` | Loading indicator |
| Connection status fade | 300ms | `ease` | Status bar transitions |

**Performance rules:**
- **Only animate `transform` and `opacity`** — these are GPU-composited. Animating `width`, `height`, `margin`, or `top` triggers layout recalculation → jank.
- **Use `will-change: transform`** sparingly on elements that will animate — warns the browser to promote to a GPU layer. Overuse wastes GPU memory.
- **Disable animations for `prefers-reduced-motion`:**

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## Appendix: Phase 1 Frontend vs Future Enhancements

| Concern | Phase 1 | Future |
|---|---|---|
| Token storage | In-memory (Zustand) | HttpOnly cookie for refresh token |
| Token refresh | Re-login on expiry | Silent refresh via `/api/auth/refresh` |
| Pagination | Offset-based (backend) | Cursor-based |
| Typing indicators | Not implemented | STOMP fire-and-forget events |
| Presence | Not implemented | Heartbeat-based online/offline |
| File attachments | Not supported | Upload to S3, render preview in bubble |
| Push notifications | Not supported | Service Worker + Web Push API |
| E2E encryption | Not implemented | Signal Protocol (libsignal) |
| Offline support | Not supported | Service Worker cache + IndexedDB message store |
