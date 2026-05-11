# Design Document: Lugogo Mall Parking Management System

## Overview

The Lugogo Mall Parking Management System (PMS) is a web-based platform that automates vehicle entry and exit at Lugogo Shopping Mall in Kampala, Uganda. It integrates with physical ANPR cameras and barrier hardware, provides a real-time GPS-based parking map, and communicates slot assignments to drivers via WhatsApp and SMS.

The system serves two user roles:

- **Attendant** — operates entry/exit points, manages sessions, views the live map.
- **Operator** — manages destinations, slot layout, and views the management dashboard.

### Key Technical Goals

| Goal | Approach |
|---|---|
| Real-time slot status (≤5 s) | WebSocket push via Socket.IO |
| GPS-accurate parking map | Leaflet.js + OpenStreetMap tiles with custom markers |
| Plate capture | ANPR camera webhook → PMS REST endpoint |
| Nearest-slot assignment | Haversine distance from destination GPS anchor |
| Driver notification | Twilio (WhatsApp Business API + SMS) or Africa's Talking (SMS) |
| Role-based access | JWT with role claim; server-side route guards |
| Database | MongoDB with Mongoose ODM (MERN stack) |

---

## Architecture

The system follows a three-tier web architecture with a real-time layer added via WebSockets.

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Clients                          │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │
│  │  Attendant UI    │  │  Operator UI     │  │  Admin UI    │  │
│  │  (React SPA)     │  │  (React SPA)     │  │  (React SPA) │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │
│           │  HTTP/REST + Socket.IO (WSS)              │          │
└───────────┼──────────────────────────────────────────┼──────────┘
            │                                          │
┌───────────▼──────────────────────────────────────────▼──────────┐
│                        API Server (Node.js / Express)            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐   │
│  │  REST API    │  │  Socket.IO   │  │  ANPR Webhook        │   │
│  │  Routes      │  │  Server      │  │  Receiver            │   │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘   │
│         │                 │                      │               │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │                   Service Layer                            │  │
│  │  SessionService │ SlotService │ NotificationService │ ...  │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                             │                                    │
│  ┌──────────────────────────▼────────────────────────────────┐  │
│  │                   Data Access Layer (Mongoose ODM)         │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼──────────────────────────────────-┘
                              │
              ┌───────────────▼───────────────┐
              │         MongoDB Database       │
              │    (local or MongoDB Atlas)    │
              └───────────────────────────────┘

External Integrations:
  ┌──────────────────┐   ┌──────────────────┐   ┌──────────────────┐
  │  ANPR Cameras    │   │  Twilio / AT API  │   │  OSM Tile Server │
  │  (HTTP webhook)  │   │  (WhatsApp/SMS)   │   │  (map tiles)     │
  └──────────────────┘   └──────────────────┘   └──────────────────┘
```

### Deployment Topology

- **Single server** (VPS or cloud VM) running the Node.js API and serving the React SPA as static files.
- **MongoDB** on the same host or MongoDB Atlas (managed cloud service).
- **Nginx** as a reverse proxy, handling TLS termination and static file serving.
- ANPR cameras on the local network POST webhooks to the server's internal IP; the server is also reachable from the internet for map tiles and messaging APIs.

---

## Components and Interfaces

### 2.1 Frontend (React SPA)

Built with **React 18 + Vite**, **Tailwind CSS**, and **React Router v6**. The single build is served as static files; routing is client-side.

#### Pages / Views

| Route | Role | Description |
|---|---|---|
| `/login` | All | Login screen |
| `/` (redirect) | All | Redirects to `/attendant` or `/operator` based on role |
| `/attendant` | Attendant | Live parking map + entry/exit controls |
| `/attendant/entry` | Attendant | Entry form (plate, phone, destination, confirm) |
| `/attendant/exit` | Attendant | Manual exit form (plate lookup) |
| `/attendant/history` | Attendant | Session history log with search |
| `/operator` | Operator | Operator dashboard (stats) |
| `/operator/destinations` | Operator | Destination management CRUD |
| `/operator/slots` | Operator | Slot layout management (map-click placement) |
| `/operator/history` | Operator | Full session history log |

#### Key Frontend Libraries

| Library | Purpose |
|---|---|
| `react-leaflet` + `leaflet` | Interactive map with OSM tiles and custom markers |
| `socket.io-client` | WebSocket connection for real-time updates |
| `axios` | HTTP REST calls |
| `react-hook-form` + `zod` | Form handling and validation |
| `zustand` | Lightweight global state (auth token, slot state) |
| `date-fns` | Elapsed time formatting |
| `react-query` (TanStack Query) | Server state caching and refetch |

### 2.2 Backend (Node.js / Express)

**Node.js 20 LTS** with **Express 4**, **Socket.IO 4**, and **Mongoose ODM**.

#### Module Structure

```
src/
  routes/
    auth.routes.js          # POST /api/auth/login, POST /api/auth/logout
    sessions.routes.js      # POST /api/sessions, GET /api/sessions, PATCH /api/sessions/:id/exit
    slots.routes.js         # GET /api/slots, PATCH /api/slots/:id
    destinations.routes.js  # CRUD /api/destinations
    landmarks.routes.js     # CRUD /api/landmarks (gates, POIs)
    anpr.routes.js          # POST /api/anpr/entry, POST /api/anpr/exit
    notifications.routes.js # POST /api/notifications/send
    dashboard.routes.js     # GET /api/dashboard/stats
  services/
    session.service.js
    slot.service.js
    notification.service.js
    anpr.service.js
    nearest-slot.service.js
  middleware/
    auth.middleware.js       # JWT verification + role check
    error.middleware.js
  socket/
    slot-events.js           # Emits slot_updated, session_created, session_closed
    dashboard-events.js      # Emits stats_updated
  models/
    User.js
    Slot.js
    Destination.js
    Session.js
    Notification.js
    BarrierLog.js
    Landmark.js
```

#### REST API Summary

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | None | Authenticate, return JWT |
| POST | `/api/auth/logout` | JWT | Invalidate session |
| GET | `/api/slots` | JWT | All slots with current status |
| PATCH | `/api/slots/:id` | Operator | Update slot (status, GPS, label) |
| POST | `/api/slots` | Operator | Create new slot |
| DELETE | `/api/slots/:id` | Operator | Remove slot |
| GET | `/api/destinations` | JWT | List destinations |
| POST | `/api/destinations` | Operator | Create destination |
| PATCH | `/api/destinations/:id` | Operator | Update destination |
| DELETE | `/api/destinations/:id` | Operator | Remove destination |
| GET | `/api/landmarks` | JWT | Gates, POIs |
| POST | `/api/landmarks` | Operator | Create landmark |
| PATCH | `/api/landmarks/:id` | Operator | Update landmark |
| DELETE | `/api/landmarks/:id` | Operator | Remove landmark |
| POST | `/api/sessions` | Attendant | Create session (entry confirm) |
| GET | `/api/sessions` | JWT | Session history (with search params) |
| PATCH | `/api/sessions/:id/exit` | Attendant | Close session (exit) |
| POST | `/api/anpr/entry` | API Key | ANPR camera webhook — entry plate |
| POST | `/api/anpr/exit` | API Key | ANPR camera webhook — exit plate |
| POST | `/api/notifications/send` | Attendant | Send WhatsApp or SMS to driver |
| GET | `/api/dashboard/stats` | Operator | Aggregate stats |
| GET | `/api/barrier-logs` | Operator | Barrier log entries with attendant details |

#### WebSocket Events (Socket.IO)

| Event | Direction | Payload | Description |
|---|---|---|---|
| `slot_updated` | Server → Client | `{ slotId, status, sessionId? }` | Slot status changed |
| `session_created` | Server → Client | `{ session }` | New session opened |
| `session_closed` | Server → Client | `{ sessionId, slotId }` | Session ended |
| `stats_updated` | Server → Client | `{ occupied, available, totalToday }` | Dashboard stats refresh |
| `anpr_plate_read` | Server → Client | `{ camera: 'entry'|'exit', plate }` | Camera read result for attendant UI |
| `parking_full` | Server → Client | `{ full: boolean }` | Parking full state change |

All clients join a shared room `parking` on connect. The server broadcasts to this room on any state change.

### 2.3 ANPR Integration

ANPR cameras (e.g., Hikvision, Dahua, or Plate Recognizer Snapshot Cloud) are configured to POST an HTTP webhook to the PMS on each plate read.

**Entry camera webhook** — `POST /api/anpr/entry`
```json
{
  "plate": "UAA 123B",
  "confidence": 0.97,
  "image_url": "http://camera-ip/snapshot.jpg",
  "timestamp": "2025-01-15T08:30:00Z"
}
```

**Exit camera webhook** — `POST /api/anpr/exit`
```json
{
  "plate": "UAA 123B",
  "confidence": 0.97,
  "timestamp": "2025-01-15T10:45:00Z"
}
```

The PMS authenticates the camera using a shared API key in the `X-API-Key` header. On receipt:
1. The plate is normalised (uppercase, spaces stripped).
2. The result is broadcast to all connected clients via `anpr_plate_read`.
3. For exit: the active session is looked up and the exit flow is triggered automatically if found.

**Fallback**: If the camera fails or confidence is below threshold (< 0.85), the attendant is alerted and can type the plate manually.

### 2.4 Notification Service

The notification service abstracts over two channels:

- **WhatsApp**: Twilio WhatsApp Business API (`whatsapp:+<phone>` addressing). Requires a pre-approved message template for outbound notifications.
- **SMS**: Africa's Talking SMS API (preferred for Uganda due to local carrier relationships and lower latency) with Twilio SMS as fallback.

Message template (slot assignment):
```
Your parking slot at Lugogo Mall is: *{slotId}*
Destination: {destination}
Have a great visit!
```

The service retries once on failure and returns a structured result to the caller so the attendant UI can show a retry option.

### 2.5 Nearest-Slot Assignment Algorithm

Each `Destination` record stores a GPS anchor point (lat/lng). Each `Slot` stores its GPS coordinates. When an attendant selects a destination, the service:

1. Fetches all slots with `status = AVAILABLE`.
2. Computes the Haversine distance between each available slot's GPS coordinates and the destination's GPS anchor.
3. Returns the slot with the minimum distance.

```
haversine(lat1, lon1, lat2, lon2):
  R = 6371000  // Earth radius in metres
  φ1 = lat1 * π/180
  φ2 = lat2 * π/180
  Δφ = (lat2 - lat1) * π/180
  Δλ = (lon2 - lon1) * π/180
  a = sin²(Δφ/2) + cos(φ1)·cos(φ2)·sin²(Δλ/2)
  c = 2·atan2(√a, √(1−a))
  d = R · c
```

At Lugogo Mall's scale (a few hundred metres), Haversine is accurate to within centimetres — no spherical correction needed.

**Tie-breaking**: If two slots are equidistant (within 1 metre), the slot with the lower alphanumeric identifier is chosen for determinism.

---

## Data Models

### Mongoose Schemas

```js
// models/User.js
const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role:         { type: String, enum: ['ATTENDANT', 'OPERATOR'], required: true },
}, { timestamps: true });

// models/Destination.js
const destinationSchema = new mongoose.Schema({
  name:      { type: String, required: true, unique: true },
  anchorLat: { type: Number, required: true },  // GPS latitude of destination anchor
  anchorLng: { type: Number, required: true },  // GPS longitude of destination anchor
}, { timestamps: true });

// models/Slot.js
const slotSchema = new mongoose.Schema({
  slotId:        { type: String, required: true, unique: true }, // operator-assigned e.g. "A1"
  label:         { type: String, required: true },
  lat:           { type: Number, required: true },  // GPS latitude
  lng:           { type: Number, required: true },  // GPS longitude
  status:        { type: String, enum: ['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'], default: 'AVAILABLE' },
  destinationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Destination', default: null },
}, { timestamps: true });

// models/Session.js
const sessionSchema = new mongoose.Schema({
  plateNumber:     { type: String, required: true },
  driverPhone:     { type: String, required: true },
  destinationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Destination', required: true },
  destinationName: { type: String, required: true }, // snapshot at time of entry
  slotId:          { type: String, required: true },  // references Slot.slotId
  attendantId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  entryTime:       { type: Date, default: Date.now },
  exitTime:        { type: Date, default: null },
  status:          { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
}, { timestamps: true });

sessionSchema.index({ plateNumber: 1 });
sessionSchema.index({ driverPhone: 1 });
sessionSchema.index({ status: 1 });
sessionSchema.index({ entryTime: -1 });

// models/Notification.js
const notificationSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true },
  channel:   { type: String, enum: ['WHATSAPP', 'SMS'], required: true },
  phone:     { type: String, required: true },
  message:   { type: String, required: true },
  success:   { type: Boolean, required: true },
  sentAt:    { type: Date, default: Date.now },
});

// models/BarrierLog.js
const barrierLogSchema = new mongoose.Schema({
  barrier:     { type: String, enum: ['ENTRY', 'EXIT'], required: true },
  action:      { type: String, default: 'OPEN' },
  plateNumber: { type: String, required: true },
  sessionId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  attendantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  timestamp:   { type: Date, default: Date.now },
});

// models/Landmark.js
const landmarkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type:  { type: String, enum: ['ENTRY_GATE', 'EXIT_GATE', 'DESTINATION_POI'], required: true },
  lat:   { type: Number, required: true },
  lng:   { type: Number, required: true },
}, { timestamps: true });
```

### Key Design Decisions in the Data Model

- **Slot uses a custom `slotId` field** (e.g., "A1") as the human-readable identifier, separate from MongoDB's `_id`. Attendants and drivers refer to slots by their physical label.
- **Session snapshots `destinationName`** at entry time so historical records remain accurate even if the destination is later renamed or deleted.
- **Destination has an anchor GPS point** separate from slot GPS, allowing the nearest-slot algorithm to compute distance to the destination's physical entrance.
- **BarrierLog** is a separate collection so every barrier open event is traceable to an attendant and session.
- **Landmark** stores gates and POIs as a flexible collection so the operator can configure them via the map UI without code changes.
- **MongoDB Atlas** is recommended for production — it provides free tier hosting, automatic backups, and a connection string that works with Mongoose out of the box.

---

## API Design Details

### Authentication Flow

1. `POST /api/auth/login` with `{ username, password }` → returns `{ token, user: { id, username, role } }`.
2. Token is a **JWT** signed with `HS256`, payload: `{ sub: userId, role, iat, exp }`. Expiry: 12 hours (one shift).
3. All protected routes require `Authorization: Bearer <token>`.
4. Role-based middleware rejects Attendant tokens on Operator-only routes (HTTP 403).
5. On logout, the token's `jti` (JWT ID) is added to a Redis blocklist (required for production). The blocklist entry TTL matches the token's remaining expiry time so entries are automatically purged. An in-memory blocklist is acceptable only for local development and is explicitly not suitable for production because it is lost on server restart.
6. The login endpoint SHALL be rate-limited to 10 requests per minute per IP address. After 5 consecutive failed login attempts for the same username, that account SHALL be locked for 15 minutes (Requirement 8.4).
7. The ANPR webhook endpoints SHALL additionally validate that the request originates from an allowlisted IP address (the camera's local network IP), in addition to the `X-API-Key` check.

### Timezone Handling

All date/time values are stored in MongoDB as UTC. All "midnight" boundary calculations (e.g. `totalToday` in the dashboard) are computed relative to **East Africa Time (UTC+3)**. The server sets `process.env.TZ = 'Africa/Nairobi'` on startup, and the dashboard query computes midnight as:

```js
const now = new Date();
const midnightEAT = new Date(now.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }) + 'T00:00:00+03:00');
```

### Entry Flow (Sequence)

```
Camera          PMS Server          Attendant Browser
  │                │                       │
  │─POST /anpr/entry──►│                   │
  │                │──emit anpr_plate_read─►│  (plate pre-filled)
  │                │                       │
  │                │◄──POST /api/sessions──│  (plate, phone, destinationId)
  │                │                       │
  │                │  find nearest slot    │
  │                │  create Session       │
  │                │  mark slot OCCUPIED   │
  │                │──emit slot_updated───►│  (all clients)
  │                │──emit session_created►│
  │                │──open entry barrier   │
  │                │──►response { session }│
  │                │                       │
  │                │◄──POST /notifications/send (WhatsApp or SMS)
  │                │──►{ success }─────────►│
```

### Exit Flow (Sequence)

```
Camera          PMS Server          Attendant Browser
  │                │                       │
  │─POST /anpr/exit───►│                   │
  │                │  find active session  │
  │                │  close session        │
  │                │  mark slot AVAILABLE  │
  │                │──emit slot_updated───►│  (all clients)
  │                │──emit session_closed─►│
  │                │──open exit barrier    │
  │                │──emit anpr_plate_read►│  (for attendant awareness)
```

### Slot Layout Management (Map Click)

1. Operator opens `/operator/slots` — map loads with existing slot markers.
2. Operator clicks an empty position on the map → frontend captures `latlng` from Leaflet click event.
3. A modal prompts for slot ID (e.g., "A1") and optional destination zone assignment.
4. `POST /api/slots` with `{ id, label, lat, lng, destinationId? }`.
5. Server saves and broadcasts `slot_updated` — the new marker appears on all live maps immediately.
6. Drag-to-reposition: Leaflet `marker.on('dragend')` fires `PATCH /api/slots/:id` with new `{ lat, lng }`.

---

## Error Handling

### ANPR Failure

- If the camera webhook is not received within a configurable timeout (default: 30 seconds after vehicle detection trigger), the attendant UI shows an alert: *"Camera read failed — please enter plate manually."*
- Manual entry bypasses the camera and proceeds normally.
- Low-confidence reads (< 0.85) are treated as failures and trigger the same manual-entry alert.

### Messaging Failure

- The notification service wraps Twilio/Africa's Talking calls in a try/catch.
- On failure, the API returns `{ success: false, error: "..." }`.
- The attendant UI shows a dismissible error banner with a **Retry** button.
- Notification attempts (success and failure) are logged in the `Notification` collection for audit.

### No Available Slot

- `SlotService.findNearest()` returns `null` when no `AVAILABLE` slots exist.
- The API returns HTTP 409 with `{ code: "PARKING_FULL" }`.
- The frontend shows the "Parking Full" banner (Requirement 15) and disables the entry form.

### Exit — No Active Session

- If no active session matches the plate at exit, the API returns HTTP 404 with `{ code: "SESSION_NOT_FOUND" }`.
- The attendant UI alerts the attendant and keeps the barrier closed.

### WebSocket Reconnection

- Socket.IO's built-in reconnection with exponential backoff handles transient network drops.
- On reconnect, the client calls `GET /api/slots` to re-sync full slot state (in case events were missed during disconnection).

### Database Errors

- Mongoose errors are caught in the service layer and mapped to HTTP 500 with a generic message.
- Duplicate key errors (e.g., duplicate slot ID or username) return HTTP 409 with a descriptive message.
- Mongoose validation errors (e.g., missing required field) return HTTP 400.

### Duplicate GPS Coordinates

- When creating or repositioning a slot, the service checks whether any existing slot has GPS coordinates within 1 metre (Haversine distance) of the new coordinates.
- If a duplicate is detected, the API returns HTTP 409 with `{ code: "DUPLICATE_GPS" }`.
- The frontend shows a warning modal requiring the Operator to confirm or reposition.

### Startup Validation

- On server startup, a validation module checks that all required environment variables are present and non-empty: `MONGO_URI`, `JWT_SECRET`, `ANPR_API_KEY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `AT_API_KEY`, `PORT`.
- If any variable is missing, the process logs a descriptive error and exits with code 1 before accepting any connections.

---

## Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend framework | React 18 + Vite | Fast HMR, wide ecosystem, tablet-friendly |
| Map library | Leaflet.js + react-leaflet | Free, OSM-compatible, supports custom markers and drag events |
| Map tiles | OpenStreetMap (via tile.openstreetmap.org) | Free, no API key, good Uganda coverage |
| Real-time | Socket.IO 4 | Reliable WebSocket with fallback, rooms, reconnection |
| Backend runtime | Node.js 20 LTS | Same language as frontend, large ecosystem |
| Backend framework | Express 4 | Minimal, well-understood, easy middleware |
| ODM | Mongoose 8 | Schema validation, middleware hooks, MongoDB-native |
| Database | MongoDB (Atlas or local) | Document model fits flexible slot/session data; free Atlas tier available |
| Auth | JWT (jsonwebtoken) | Stateless, works well with SPA |
| ANPR | Plate Recognizer Snapshot Cloud or camera-native webhook | Camera-agnostic HTTP webhook model |
| WhatsApp | Twilio WhatsApp Business API | Supports Uganda (+256), template messaging |
| SMS | Africa's Talking SMS API | Local Uganda carrier relationships, lower latency in East Africa |
| CSS | Tailwind CSS | Utility-first, fast to build tablet UI |
| Form validation | Zod + react-hook-form | Type-safe schema validation |
| State management | Zustand | Lightweight, no boilerplate |
| HTTP client | Axios | Interceptors for auth token injection |
| Process manager | PM2 | Node.js process management, auto-restart |
| Reverse proxy | Nginx | TLS, static file serving, WebSocket proxy |
| Token blocklist | Redis (ioredis) | Persistent JWT blocklist; survives server restarts |
| Rate limiting | express-rate-limit | Brute-force protection on login endpoint |

### Why MongoDB over a Relational Database

MongoDB fits naturally into the MERN stack — the same JavaScript/JSON data format flows from React through Express to MongoDB without any impedance mismatch. The document model suits this system well: a Session document can embed a snapshot of the destination name and slot ID without needing joins. MongoDB Atlas provides a free tier that is sufficient for a single-mall deployment, with easy scaling if needed. Mongoose adds schema validation and middleware hooks (e.g., hashing passwords before save) that keep the codebase clean.

### Why Africa's Talking for SMS

Africa's Talking has direct carrier integrations with MTN Uganda and Airtel Uganda, the two dominant networks. This results in lower latency and higher delivery rates for Ugandan numbers compared to routing through Twilio's global network. Twilio remains the recommended provider for WhatsApp.

---

## Testing Strategy

### Unit Tests

- **Nearest-slot algorithm**: Test `findNearest()` with various slot/destination GPS combinations, including edge cases (no available slots, single slot, equidistant slots).
- **Session service**: Test session creation, exit flow, and state transitions.
- **Notification service**: Mock Twilio/Africa's Talking clients; test success and failure paths.
- **Auth middleware**: Test JWT validation, expiry, role enforcement.
- **ANPR service**: Test plate normalisation, confidence threshold filtering.

Framework: **Jest** (Node.js) + **React Testing Library** (frontend).

### Property-Based Tests

See Correctness Properties section below.

Framework: **fast-check** (JavaScript/TypeScript property-based testing library, 100+ iterations per property).

### Integration Tests

- Entry flow end-to-end: POST to `/api/anpr/entry` → verify slot status change → verify WebSocket event emitted.
- Exit flow end-to-end: POST to `/api/anpr/exit` → verify session closed → verify slot available.
- Messaging: POST to `/api/notifications/send` with mocked Twilio client → verify correct API call made.
- Auth: Login with valid/invalid credentials → verify JWT returned/rejected.
- Rate limiting: Submit 11 login requests in under a minute from the same IP → verify HTTP 429 on the 11th.
- Account lockout: Submit 5 consecutive failed logins for the same username → verify HTTP 423 on the 6th attempt.
- Startup validation: Start server with a missing env var → verify process exits with code 1 and a descriptive error message.
- Duplicate GPS: Create two slots at identical coordinates → verify HTTP 409 DUPLICATE_GPS.

### Manual / Smoke Tests

- Map renders correctly centred on Lugogo Mall coordinates.
- Slot markers appear at configured GPS positions.
- Drag-to-reposition updates marker and persists on page reload.
- Barrier open commands reach the physical hardware (requires on-site testing).
- WhatsApp and SMS messages received on a real Ugandan number.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Nearest Slot Is Minimum Haversine Distance

*For any* destination GPS anchor point and any non-empty set of available slots with GPS coordinates, the slot assigned by the nearest-slot algorithm shall be the slot whose Haversine distance to the destination anchor is less than or equal to the distance of every other available slot.

**Validates: Requirements 2.3**

---

### Property 2: Session Creation Captures All Entry Data

*For any* valid entry request (plate number, driver phone, destination ID, available slot), after session creation the stored session record shall contain the exact plate number, driver phone, destination ID, slot ID, and attendant ID that were provided in the request.

**Validates: Requirements 3.2, 8.4**

---

### Property 3: Slot Status Transitions Emit WebSocket Events

*For any* slot status change (AVAILABLE → OCCUPIED on session creation, OCCUPIED → AVAILABLE on session exit), a `slot_updated` WebSocket event shall be emitted to all connected clients containing the correct slot ID and the new status value.

**Validates: Requirements 3.4, 5.5**

---

### Property 4: Exit Round-Trip Closes Session and Frees Slot

*For any* active session (created with a given plate number and slot), after the exit flow is triggered with that plate number, the session status shall be CLOSED, the session's exitTime shall be set to a non-null timestamp, and the associated slot's status shall be AVAILABLE.

**Validates: Requirements 5.2, 5.4**

---

### Property 5: Notification Message Contains Slot Identifier

*For any* session with any slot ID and any driver phone number, the message body sent via WhatsApp or SMS shall contain the slot ID string as a substring.

**Validates: Requirements 4.2, 4.3**

---

### Property 6: Slot Marker Color Reflects Slot Status

*For any* slot, the color of its map marker shall be determined solely by its status: green when AVAILABLE, red when OCCUPIED, and grey when OUT_OF_SERVICE. No other status value shall produce a valid marker color.

**Validates: Requirements 6.4, 6.5, 6.6, 14.4**

---

### Property 7: Slot GPS Coordinates Round-Trip

*For any* GPS coordinates (latitude, longitude) saved for a slot — whether on initial creation or after a drag-to-reposition update — retrieving that slot from the API shall return the same latitude and longitude values (within floating-point precision of 6 decimal places).

**Validates: Requirements 16.2, 16.3, 16.4**

---

### Property 8: Session History Search Filters Correctly

*For any* search term and any set of sessions in the database, the session history API shall return exactly the sessions whose plate number or driver phone contains the search term as a substring (case-insensitive), and shall not omit any matching session.

**Validates: Requirements 7.4**

---

### Property 9: Session History Is Reverse Chronological

*For any* collection of sessions with distinct entry times, the session history API shall return them in descending order of entry time (most recent first).

**Validates: Requirements 7.3**

---

### Property 10: Active Sessions Have Null Exit Time in History

*For any* session with status ACTIVE, the session record returned by the history API shall have a null exit time field.

**Validates: Requirements 7.5**

---

### Property 11: Authentication Outcome Matches Credential Validity

*For any* username and password pair, the login endpoint shall return a JWT with the correct role claim if and only if the credentials match a user record in the database. Invalid credentials shall always return HTTP 401.

**Validates: Requirements 8.2, 8.3**

---

### Property 12: Barrier Log Records Attendant Identity

*For any* barrier open action (entry or exit) performed by any authenticated attendant, a BarrierLog record shall be created containing the attendant's user ID, the barrier type, and the plate number associated with the action.

**Validates: Requirements 8.5**

---

### Property 13: Elapsed Time Format Is Always Hours and Minutes

*For any* non-negative session duration (in milliseconds), the formatted elapsed time string shall match the pattern `{N}h {M}m` where N is the whole number of hours and M is the remaining whole minutes (0 ≤ M < 60).

**Validates: Requirements 9.3**

---

### Property 14: Dashboard Stats Are Consistent With Slot State

*For any* collection of slots with known statuses, the dashboard statistics endpoint shall return a total count equal to the number of all slots, an occupied count equal to the number of OCCUPIED slots, an available count equal to the number of AVAILABLE slots, and the three counts shall satisfy: total = occupied + available + out_of_service.

**Validates: Requirements 12.1, 12.2, 12.3**

---

### Property 15: Today's Entry Count Matches Sessions Since Midnight

*For any* set of sessions with varying entry times, the dashboard's `totalToday` value shall equal the count of sessions whose entry time falls on the current calendar day (midnight to now in the local timezone).

**Validates: Requirements 12.4**

---

### Property 16: Destination CRUD Round-Trips

*For any* valid destination name, after creation via the API, the destination shall appear in the list endpoint. After an update with a new name, the list endpoint shall return the updated name. After deletion, the list endpoint shall not include the destination.

**Validates: Requirements 13.2, 13.3, 13.4**

---

### Property 17: Out-of-Service Slots Are Never Assigned

*For any* slot with status OUT_OF_SERVICE, the nearest-slot algorithm shall never return that slot as the assigned slot, regardless of destination or the positions of other slots.

**Validates: Requirements 14.2**

---

### Property 18: Out-of-Service Round-Trip Restores Availability

*For any* slot with status AVAILABLE, marking it OUT_OF_SERVICE and then marking it back in service shall result in the slot having status AVAILABLE.

**Validates: Requirements 14.3**

---

### Property 19: Parking Full State Reflects Available Slot Count

*For any* slot state transition, the `parking_full` WebSocket event shall emit `true` when and only when the count of AVAILABLE slots is zero, and shall emit `false` when the count of AVAILABLE slots transitions from zero to a positive number.

**Validates: Requirements 15.1, 15.3**

---

### Property 20: Landmark GPS Coordinates Round-Trip

*For any* landmark (type, label, latitude, longitude) created via the API, retrieving the landmark shall return the same type, label, and GPS coordinates that were provided on creation.

**Validates: Requirements 16.5**

---

### Property 21: Duplicate GPS Coordinates Are Rejected

*For any* two slots whose Haversine distance is less than 1 metre, the API shall reject the second slot creation or reposition with HTTP 409 DUPLICATE_GPS and shall not persist the duplicate coordinates.

**Validates: Requirements 16.6**

---

### Property 22: Destination Name Update Propagates to Active Sessions

*For any* destination that is renamed via the API, all Session records that reference that destination by ID shall reflect the updated destination name when retrieved from the session history API after the rename.

**Validates: Requirements 13.3**

---

### Property 23: Rate Limit Blocks Excessive Login Attempts

*For any* sequence of more than 10 login requests from the same IP address within a 60-second window, all requests beyond the 10th shall receive HTTP 429, regardless of credential validity.

**Validates: Requirements 17.6 (security)**

---
