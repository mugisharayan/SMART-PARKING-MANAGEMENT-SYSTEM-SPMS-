# Implementation Plan: Lugogo Mall Parking Management System

## Overview

Implement the MERN-stack Parking Management System as a monorepo with a Node.js/Express backend and a React 18 + Vite frontend. Work proceeds in dependency order: project scaffolding → data models → auth → REST APIs → real-time layer → frontend shell → feature screens. Property-based tests use **fast-check**; unit tests use **Jest** (backend) and **Vitest + React Testing Library** (frontend).

---

## Tasks

- [ ] 1. Monorepo project structure and tooling
  - [ ] 1.1 Scaffold server package
    - Create root `package.json` with workspaces: `packages/server` and `packages/client`
    - Scaffold `packages/server` with Express 4, Mongoose 8, Socket.IO 4, dotenv, cors, helmet, morgan, ioredis, express-rate-limit; add `nodemon` + `jest` as dev deps
    - Create `packages/server/.env.example` documenting all required variables: MONGO_URI, JWT_SECRET, ANPR_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, AT_API_KEY, PORT, REDIS_URL, ALLOWED_CAMERA_IPS
    - _Requirements: 8.1, 17.6_

  - [ ] 1.2 Scaffold client package
    - Scaffold `packages/client` with Vite + React 18, Tailwind CSS, React Router v6, Zustand, Axios, react-hook-form, Zod, react-leaflet + leaflet, socket.io-client, date-fns, @tanstack/react-query
    - Create `packages/client/.env.example` documenting VITE_API_URL
    - Add root-level `fast-check` dev dependency for property tests
    - _Requirements: 8.1_

  - [ ] 1.3 Implement startup environment variable validation
    - Write `packages/server/src/validateEnv.js` that checks all required env vars on startup and calls `process.exit(1)` with a descriptive error if any are missing
    - Call `validateEnv()` as the first statement in `src/index.js` before any other initialisation
    - _Requirements: 17.6_

  - [ ] 1.4 Create database seed script
    - Write `packages/server/scripts/seed.js` that creates a default Operator account (username: `admin`, password prompted from CLI or env var `SEED_PASSWORD`) if no users exist
    - Document seed script usage in README
    - _Requirements: 17.7_

- [ ] 2. MongoDB connection and Mongoose models
  - [ ] 2.1 Implement MongoDB connection module
    - Write `packages/server/src/db.js` that connects via Mongoose using `MONGO_URI` env var, logs connection status, and exports the connection
    - _Requirements: 3.2, 5.2_

  - [ ] 2.2 Implement User, Destination, and Slot models
    - Write `models/User.js` with username, passwordHash, role enum (ATTENDANT/OPERATOR), failedLoginAttempts (default 0), lockedUntil (default null), timestamps; add pre-save hook to bcrypt-hash password; enforce password complexity (min 8 chars, uppercase, lowercase, digit) in Zod schema at the route layer
    - Write `models/Destination.js` with name (unique), anchorLat, anchorLng, timestamps
    - Write `models/Slot.js` with slotId (unique), label, lat, lng, status enum (AVAILABLE/OCCUPIED/OUT_OF_SERVICE), destinationId ref, timestamps
    - _Requirements: 2.2, 2.3, 8.4, 8.8, 13.2, 14.2, 16.2_

  - [ ] 2.3 Implement Session, Notification, BarrierLog, and Landmark models
    - Write `models/Session.js` with plateNumber, driverPhone, destinationId ref, destinationName snapshot, slotId, attendantId ref, entryTime, exitTime, status enum (ACTIVE/CLOSED); add compound indexes on plateNumber, driverPhone, status, entryTime
    - Write `models/Notification.js` with sessionId ref, channel enum (WHATSAPP/SMS), phone, message, success, sentAt
    - Write `models/BarrierLog.js` with barrier enum (ENTRY/EXIT), action, plateNumber, sessionId ref, attendantId ref, timestamp
    - Write `models/Landmark.js` with label, type enum (ENTRY_GATE/EXIT_GATE/DESTINATION_POI), lat, lng, timestamps
    - _Requirements: 7.1, 8.4, 8.5, 16.5_

  - [ ]* 2.4 Write property test for Session model indexes
    - **Property 9: Session History Is Reverse Chronological**
    - **Validates: Requirements 7.3**

- [ ] 3. Authentication — login endpoint and JWT middleware
  - [ ] 3.1 Implement login endpoint and JWT utilities
    - Write `routes/auth.routes.js` with `POST /api/auth/login` — validate body with Zod (username required, password required, min 8 chars), compare bcrypt hash, check account lockout (lockedUntil), increment failedLoginAttempts on failure (lock after 5), reset on success, sign JWT (HS256, 12 h expiry, sub/role/jti claims), return `{ token, user }`
    - Write `POST /api/auth/logout` that adds jti to Redis blocklist with TTL equal to remaining token expiry
    - Write `middleware/auth.middleware.js` — verify JWT, check Redis blocklist, attach `req.user`; export `requireRole(...roles)` guard factory
    - Write `middleware/error.middleware.js` — map Mongoose validation errors → 400, duplicate key → 409, generic → 500
    - Apply `express-rate-limit` (10 req/min per IP) to the login route
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.6, 8.7, 8.8_

  - [ ]* 3.2 Write property test for authentication outcome
    - **Property 11: Authentication Outcome Matches Credential Validity**
    - **Validates: Requirements 8.2, 8.3**

- [ ] 4. Slot API (CRUD endpoints)
  - [ ] 4.1 Implement Slot routes and SlotService
    - Write `services/slot.service.js` with `listSlots()`, `createSlot(data)` (includes duplicate GPS check via Haversine < 1 m), `updateSlot(id, data)` (includes duplicate GPS check on coordinate change), `deleteSlot(id)`, `setStatus(slotId, status)`
    - Write `routes/slots.routes.js`: `GET /api/slots` (JWT), `POST /api/slots` (Operator), `PATCH /api/slots/:id` (Operator), `DELETE /api/slots/:id` (Operator)
    - _Requirements: 14.1, 14.2, 14.3, 16.2, 16.3, 16.4, 16.6_

  - [ ]* 4.2 Write property test for slot GPS round-trip
    - **Property 7: Slot GPS Coordinates Round-Trip**
    - **Validates: Requirements 16.2, 16.3, 16.4**

- [ ] 5. Destination API (CRUD endpoints)
  - [ ] 5.1 Implement Destination routes and service
    - Write `services/destination.service.js` with `listDestinations()`, `createDestination(data)`, `updateDestination(id, data)` (also updates `destinationName` field on all ACTIVE sessions referencing this destination), `deleteDestination(id)` (with active-session guard returning 409 if active sessions reference it)
    - Write `routes/destinations.routes.js`: `GET /api/destinations` (JWT), `POST /api/destinations` (Operator), `PATCH /api/destinations/:id` (Operator), `DELETE /api/destinations/:id` (Operator)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 5.2 Write property test for Destination CRUD round-trips
    - **Property 16: Destination CRUD Round-Trips**
    - **Validates: Requirements 13.2, 13.3, 13.4**

- [ ] 6. Landmark API (CRUD endpoints)
  - [ ] 6.1 Implement Landmark routes and service
    - Write `services/landmark.service.js` with `listLandmarks()`, `createLandmark(data)`, `updateLandmark(id, data)`, `deleteLandmark(id)`
    - Write `routes/landmarks.routes.js`: `GET /api/landmarks` (JWT), `POST /api/landmarks` (Operator), `PATCH /api/landmarks/:id` (Operator), `DELETE /api/landmarks/:id` (Operator)
    - _Requirements: 6.9, 6.10, 16.5_

  - [ ]* 6.2 Write property test for Landmark GPS round-trip
    - **Property 20: Landmark GPS Coordinates Round-Trip**
    - **Validates: Requirements 16.5**

- [ ] 7. Nearest-slot assignment algorithm
  - [ ] 7.1 Implement Haversine distance function and nearest-slot service
    - Write `services/nearest-slot.service.js` with `haversine(lat1, lng1, lat2, lng2)` returning distance in metres
    - Implement `findNearest(destinationId)`: fetch all AVAILABLE slots, compute Haversine distance to destination anchor, return slot with minimum distance; tie-break on alphanumeric slotId; return `null` if no available slots
    - _Requirements: 2.3, 2.4_

  - [ ]* 7.2 Write property test for nearest-slot algorithm
    - **Property 1: Nearest Slot Is Minimum Haversine Distance**
    - **Validates: Requirements 2.3**

  - [ ]* 7.3 Write property test for out-of-service slots never assigned
    - **Property 17: Out-of-Service Slots Are Never Assigned**
    - **Validates: Requirements 14.2**

- [ ] 8. Session API (create, list with search, exit)
  - [ ] 8.1 Implement SessionService and session routes
    - Write `services/session.service.js` with:
      - `createSession({ plateNumber, driverPhone, destinationId, attendantId })` — validates phone format (+256 or 07 + 8 digits), calls `findNearest`, throws 409 PARKING_FULL if null, creates Session, marks slot OCCUPIED, creates BarrierLog (ENTRY)
      - `listSessions({ search, page, limit })` — text search on plateNumber/driverPhone (case-insensitive), sorted by entryTime descending; default page size 50
      - `exitSession(sessionId, attendantId)` — sets exitTime, status CLOSED, marks slot AVAILABLE, creates BarrierLog (EXIT)
    - Write `routes/sessions.routes.js`: `POST /api/sessions` (Attendant), `GET /api/sessions` (JWT), `PATCH /api/sessions/:id/exit` (Attendant)
    - _Requirements: 2.2, 3.1, 3.2, 3.3, 5.2, 5.3, 5.4, 7.1, 7.2, 7.3, 7.4, 7.5, 8.4, 8.5_

  - [ ]* 8.2 Write property test for session creation data capture
    - **Property 2: Session Creation Captures All Entry Data**
    - **Validates: Requirements 3.2, 8.4**

  - [ ]* 8.3 Write property test for exit round-trip
    - **Property 4: Exit Round-Trip Closes Session and Frees Slot**
    - **Validates: Requirements 5.2, 5.4**

  - [ ]* 8.4 Write property test for session history search
    - **Property 8: Session History Search Filters Correctly**
    - **Validates: Requirements 7.4**

  - [ ]* 8.5 Write property test for session history ordering
    - **Property 9: Session History Is Reverse Chronological**
    - **Validates: Requirements 7.3**

  - [ ]* 8.6 Write property test for active sessions null exit time
    - **Property 10: Active Sessions Have Null Exit Time in History**
    - **Validates: Requirements 7.5**

  - [ ]* 8.7 Write property test for barrier log attendant identity
    - **Property 12: Barrier Log Records Attendant Identity**
    - **Validates: Requirements 8.5**

- [ ] 9. Checkpoint — backend core complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 10. ANPR webhook endpoints
  - [ ] 10.1 Implement ANPR service and webhook routes
    - Write `services/anpr.service.js` with `normalisePlate(raw)` (uppercase, strip spaces/hyphens), `isConfident(score, threshold=0.85)`
    - Write `middleware/cameraAuth.middleware.js` — validates `X-API-Key` header AND checks that `req.ip` is in the `ALLOWED_CAMERA_IPS` env var allowlist; rejects with 403 if either check fails
    - Write `routes/anpr.routes.js`:
      - `POST /api/anpr/entry` (camera auth) — normalise plate, emit `anpr_plate_read` via Socket.IO
      - `POST /api/anpr/exit` (camera auth) — normalise plate, look up active session, trigger `exitSession` if found, emit `anpr_plate_read`; return 404 SESSION_NOT_FOUND if no active session
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.2, 5.6, 5.7_

- [ ] 11. Notification service (WhatsApp + SMS)
  - [ ] 11.1 Implement notification service with Twilio and Africa's Talking
    - Write `services/notification.service.js` with `sendWhatsApp(phone, slotId, destination)` using Twilio WhatsApp Business API and `sendSMS(phone, slotId, destination)` using Africa's Talking SMS API
    - Implement one retry on failure; log each attempt to the Notification collection (success and failure)
    - Write `routes/notifications.routes.js`: `POST /api/notifications/send` (Attendant) — accepts `{ sessionId, channel: 'WHATSAPP'|'SMS' }`, returns `{ success, error? }`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [ ]* 11.2 Write property test for notification message content
    - **Property 5: Notification Message Contains Slot Identifier**
    - **Validates: Requirements 4.2, 4.3**

- [ ] 12. Dashboard stats endpoint
  - [ ] 12.1 Implement dashboard stats route
    - Write `routes/dashboard.routes.js`: `GET /api/dashboard/stats` (Operator) — aggregate slot counts by status (total, occupied, available, out_of_service) and count sessions with entryTime since midnight **East Africa Time (UTC+3)** as `totalToday`
    - Use the EAT midnight calculation: `new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' }) + 'T00:00:00+03:00')`
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 17.4_

  - [ ]* 12.2 Write property test for dashboard stats consistency
    - **Property 14: Dashboard Stats Are Consistent With Slot State**
    - **Validates: Requirements 12.1, 12.2, 12.3**

  - [ ]* 12.3 Write property test for today's entry count
    - **Property 15: Today's Entry Count Matches Sessions Since Midnight**
    - **Validates: Requirements 12.4**

- [ ] 13. Socket.IO setup and real-time events
  - [ ] 13.1 Initialise Socket.IO server and define event emitters
    - Attach Socket.IO to the Express HTTP server; all clients join room `parking` on connect
    - Write `socket/slot-events.js` exporting `emitSlotUpdated(io, slotId, status, sessionId?)`, `emitSessionCreated(io, session)`, `emitSessionClosed(io, sessionId, slotId)`, `emitParkingFull(io, full)`
    - Write `socket/dashboard-events.js` exporting `emitStatsUpdated(io, stats)`
    - Wire emitters into SessionService (after slot status changes) and ANPRService (after plate read → `anpr_plate_read`)
    - _Requirements: 3.4, 5.5, 6.7, 6.8, 12.5, 15.1, 15.3_

  - [ ]* 13.2 Write property test for slot status change emits WebSocket event
    - **Property 3: Slot Status Transitions Emit WebSocket Events**
    - **Validates: Requirements 3.4, 5.5_

  - [ ]* 13.3 Write property test for parking full state
    - **Property 19: Parking Full State Reflects Available Slot Count**
    - **Validates: Requirements 15.1, 15.3**

- [ ] 14. Checkpoint — full backend complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. React app scaffolding (routing, auth context, protected routes)
  - [ ] 15.1 Set up React Router, Zustand auth store, and Axios instance
    - Configure React Router v6 with all routes from the design (`/login`, `/attendant`, `/attendant/entry`, `/attendant/exit`, `/attendant/history`, `/operator`, `/operator/destinations`, `/operator/slots`, `/operator/history`)
    - Write Zustand `authStore` holding `{ token, user, setAuth, clearAuth }`; persist to localStorage
    - Write Axios instance in `lib/api.js` with request interceptor injecting `Authorization: Bearer <token>` and response interceptor redirecting to `/login` on 401
    - Wrap app in `TanStack QueryClientProvider`
    - _Requirements: 8.1, 8.6_

  - [ ] 15.2 Implement ProtectedRoute component and root redirect
    - Write `<ProtectedRoute roles={[...]}>` that reads from authStore, redirects unauthenticated users to `/login`, and redirects wrong-role users to their home route
    - Implement root `/` redirect: ATTENDANT → `/attendant`, OPERATOR → `/operator`
    - _Requirements: 8.1, 8.2_

- [ ] 16. Login page
  - [ ] 16.1 Build the Login page
    - Write `pages/Login.jsx` with react-hook-form + Zod schema (username required, password required)
    - On submit call `POST /api/auth/login`; on success store token/user in authStore and redirect; on failure show inline error message
    - Style with Tailwind CSS; ensure the form is accessible (labels, aria-invalid)
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 17. Attendant entry form
  - [ ] 17.1 Build the entry form page
    - Write `pages/attendant/EntryForm.jsx` with fields: Plate Number (pre-filled from `anpr_plate_read` Socket.IO event), Driver Phone, Destination (select from `GET /api/destinations`), assigned slot display
    - On destination select, call `GET /api/slots` + nearest-slot logic display (or show result from server after POST)
    - On confirm, call `POST /api/sessions`; on 409 PARKING_FULL show full-parking banner; on success show slot assignment and notification options (WhatsApp / SMS buttons)
    - Notification buttons call `POST /api/notifications/send`; show retry on failure
    - _Requirements: 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 4.4, 15.2_

- [ ] 18. Attendant exit form
  - [ ] 18.1 Build the manual exit form page
    - Write `pages/attendant/ExitForm.jsx` with a plate number input (pre-filled from `anpr_plate_read` exit event)
    - On submit, call `PATCH /api/sessions/:id/exit` (look up active session by plate via `GET /api/sessions?search=<plate>&status=ACTIVE`); on 404 SESSION_NOT_FOUND show alert and keep barrier closed indicator
    - Show confirmation of slot released on success
    - _Requirements: 5.6, 5.7_

- [ ] 19. Real-time parking map
  - [ ] 19.1 Build the core parking map component
    - Write `components/ParkingMap.jsx` using `react-leaflet` `<MapContainer>` centred on Lugogo Mall (0.3282° N, 32.6037° E) with OpenStreetMap tile layer
    - Fetch slots from `GET /api/slots` and landmarks from `GET /api/landmarks` on mount using TanStack Query
    - Render a `<CircleMarker>` or custom `<Marker>` for each slot: green (AVAILABLE), red (OCCUPIED), grey (OUT_OF_SERVICE)
    - Render landmark markers (entry gate, exit gate, destination POIs) with labels
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.9, 6.10_

  - [ ] 19.2 Add real-time updates, elapsed time, and click-to-view details
    - Subscribe to `slot_updated` Socket.IO event; update slot state in Zustand store; re-render markers within 5 s
    - On reconnect, re-fetch `GET /api/slots` to re-sync full state
    - For OCCUPIED slots, display elapsed time overlay using `date-fns` formatted as `{N}h {M}m`; update every 60 s via `setInterval`
    - On marker click: show popup/panel with session details (plate, phone, destination, entry time) for OCCUPIED; slot ID for AVAILABLE; "Out of Service" for OUT_OF_SERVICE
    - Show "Parking Full" banner when `parking_full` event fires with `full: true`; dismiss when `full: false`
    - _Requirements: 6.7, 6.8, 9.1, 9.2, 9.3, 11.1, 11.2, 11.3, 15.1, 15.3_

  - [ ]* 19.3 Write property test for slot marker colour logic
    - **Property 6: Slot Marker Color Reflects Slot Status**
    - **Validates: Requirements 6.4, 6.5, 6.6, 14.4**

  - [ ]* 19.4 Write property test for elapsed time format
    - **Property 13: Elapsed Time Format Is Always Hours and Minutes**
    - **Validates: Requirements 9.3**

- [ ] 20. Session history log with search
  - [ ] 20.1 Build the session history page
    - Write `pages/attendant/History.jsx` (reused at `/operator/history`) with a search input wired to `GET /api/sessions?search=<term>`
    - Display results in a table: Plate Number, Driver Phone, Destination, Slot, Entry Time, Exit Time (blank if active); sorted newest first
    - Use TanStack Query with debounced search refetch
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 21. Operator dashboard
  - [ ] 21.1 Build the operator dashboard page
    - Write `pages/operator/Dashboard.jsx` fetching `GET /api/dashboard/stats` via TanStack Query
    - Display stat cards: Total Slots, Occupied, Available, Today's Entries
    - Subscribe to `stats_updated` Socket.IO event and invalidate the query to refresh within 5 s of any slot change
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 22. Destination management screen
  - [ ] 22.1 Build the destination management CRUD page
    - Write `pages/operator/Destinations.jsx` listing destinations from `GET /api/destinations`
    - Add form (react-hook-form + Zod) to create a destination with name, anchorLat, anchorLng; calls `POST /api/destinations`
    - Inline edit row calls `PATCH /api/destinations/:id`
    - Delete button calls `DELETE /api/destinations/:id`; if server returns 409 (active sessions), show confirmation modal before retrying with a `force` flag or display warning
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [ ] 23. Slot layout management screen
  - [ ] 23.1 Build the slot layout management map page
    - Write `pages/operator/SlotLayout.jsx` with the same Leaflet base map as ParkingMap
    - On map click, capture `latlng` from Leaflet click event; open modal prompting for slotId, label, and optional destinationId; on save call `POST /api/slots`
    - Render existing slot markers as draggable (`draggable={true}`); on `dragend` call `PATCH /api/slots/:id` with new lat/lng
    - Add status toggle buttons per slot: mark OUT_OF_SERVICE / back in service (calls `PATCH /api/slots/:id`); if slot has active session, show confirmation modal before proceeding
    - Add landmark placement: separate mode to click-place ENTRY_GATE, EXIT_GATE, DESTINATION_POI markers with label prompt; calls `POST /api/landmarks`
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 16.1, 16.2, 16.3, 16.4, 16.5_

  - [ ]* 23.2 Write property test for out-of-service round-trip
    - **Property 18: Out-of-Service Round-Trip Restores Availability**
    - **Validates: Requirements 14.3**

- [ ] 24. Full parking alert (frontend integration)
  - [ ] 24.1 Wire parking-full state into the attendant main view
    - In `pages/attendant/Index.jsx`, subscribe to `parking_full` Socket.IO event and store state in Zustand
    - Show a prominent red banner "PARKING FULL — No slots available" when full; hide when a slot becomes available
    - Disable the "New Entry" navigation link / button while parking is full
    - _Requirements: 15.1, 15.2, 15.3_

- [ ] 25. Barrier log audit trail screen
  - [ ] 25.1 Build the barrier log page
    - Write `pages/operator/BarrierLog.jsx` fetching barrier log entries from `GET /api/barrier-logs`; display in a table: Barrier (ENTRY/EXIT), Plate Number, Attendant username, Session link, Timestamp
    - Add dedicated `routes/barrier-logs.routes.js` (Operator) that returns BarrierLog records populated with attendant username, sorted by timestamp descending
    - Register the new route in `src/index.js` and add it to the REST API table in the design document
    - _Requirements: 8.5_

- [ ] 26. Nginx and deployment configuration
  - [ ] 26.1 Write Nginx configuration
    - Write `deploy/nginx.conf` with: TLS termination (HTTPS on 443, redirect HTTP 80 → 443), reverse proxy to Node.js API (`/api` and `/socket.io`), static file serving for the React build, WebSocket upgrade headers for Socket.IO
    - Document PM2 ecosystem file (`ecosystem.config.js`) for process management and auto-restart
    - _Requirements: 17.1, 17.5_

- [ ] 27. Final checkpoint — full system integration
  - Ensure all tests pass, ask the user if questions arise.

  - [ ]* 27.1 Write property test for duplicate GPS rejection
    - **Property 21: Duplicate GPS Coordinates Are Rejected**
    - **Validates: Requirements 16.6**

  - [ ]* 27.2 Write property test for destination name propagation to sessions
    - **Property 22: Destination Name Update Propagates to Active Sessions**
    - **Validates: Requirements 13.3**

  - [ ]* 27.3 Write property test for login rate limiting
    - **Property 23: Rate Limit Blocks Excessive Login Attempts**
    - **Validates: Requirements 17.6**

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints at tasks 9, 14, and 26 ensure incremental validation
- Property tests use **fast-check** and validate universal correctness properties; unit tests validate specific examples and edge cases
- The Socket.IO room `parking` is used for all broadcasts — no per-user rooms needed for this deployment
- Slot GPS coordinates should be stored and returned with at least 6 decimal places of precision
- The `destinationName` snapshot on Session ensures historical records remain accurate after destination renames
- Africa's Talking is the primary SMS provider; Twilio is primary for WhatsApp and SMS fallback

---

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.3", "2.1"] },
    { "id": 1, "tasks": ["1.4", "2.2", "2.3"] },
    { "id": 2, "tasks": ["2.4", "3.1", "7.1"] },
    { "id": 3, "tasks": ["3.2", "4.1", "5.1", "6.1", "7.2", "7.3"] },
    { "id": 4, "tasks": ["4.2", "5.2", "6.2", "8.1"] },
    { "id": 5, "tasks": ["8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "10.1", "11.1", "12.1"] },
    { "id": 6, "tasks": ["11.2", "12.2", "12.3", "13.1"] },
    { "id": 7, "tasks": ["13.2", "13.3", "15.1", "15.2"] },
    { "id": 8, "tasks": ["16.1"] },
    { "id": 9, "tasks": ["17.1", "18.1", "19.1", "20.1", "21.1", "22.1"] },
    { "id": 10, "tasks": ["19.2", "23.1"] },
    { "id": 11, "tasks": ["19.3", "19.4", "23.2", "24.1"] },
    { "id": 12, "tasks": ["25.1", "26.1"] },
    { "id": 13, "tasks": ["27.1", "27.2", "27.3"] }
  ]
}
```
