/* ============================================================
   LUGOGO MALL PMS — STATE STORE
   Phase 3a: Users, Destinations, Landmarks
   ============================================================ */

const PMS = window.PMS || {};
window.PMS = PMS;

/* --- Users --- */
PMS.users = [
  { id: 'u1', username: 'admin',    passwordHash: 'Admin@1234',  role: 'OPERATOR',  name: 'Sarah Nakato',    failedAttempts: 0, lockedUntil: null },
  { id: 'u2', username: 'attendant1', passwordHash: 'Attend@123', role: 'ATTENDANT', name: 'James Okello',    failedAttempts: 0, lockedUntil: null },
  { id: 'u3', username: 'attendant2', passwordHash: 'Attend@123', role: 'ATTENDANT', name: 'Grace Achieng',   failedAttempts: 0, lockedUntil: null },
  { id: 'u4', username: 'operator2',  passwordHash: 'Oper@1234',  role: 'OPERATOR',  name: 'David Ssemakula', failedAttempts: 0, lockedUntil: null },
];

/* --- Destinations --- */
PMS.destinations = [
  { id: 'd1', name: 'Carrefour Supermarket', anchorLat: 0.32845, anchorLng: 32.60412 },
  { id: 'd2', name: 'Food Court',            anchorLat: 0.32810, anchorLng: 32.60380 },
  { id: 'd3', name: 'MTN Store',             anchorLat: 0.32780, anchorLng: 32.60350 },
  { id: 'd4', name: 'Cinema (Ster-Kinekor)', anchorLat: 0.32760, anchorLng: 32.60440 },
  { id: 'd5', name: 'Stanbic Bank / ATMs',   anchorLat: 0.32830, anchorLng: 32.60460 },
  { id: 'd6', name: 'Gym & Fitness Centre',  anchorLat: 0.32795, anchorLng: 32.60320 },
  { id: 'd7', name: 'Pharmacy',              anchorLat: 0.32820, anchorLng: 32.60395 },
  { id: 'd8', name: 'Main Entrance / Lobby', anchorLat: 0.32860, anchorLng: 32.60370 },
];

/* --- Landmarks (gates + POIs on map) --- */
PMS.landmarks = [
  { id: 'lm1', label: 'Entry Gate',          type: 'ENTRY_GATE',      lat: 0.32880, lng: 32.60340 },
  { id: 'lm2', label: 'Exit Gate',           type: 'EXIT_GATE',       lat: 0.32870, lng: 32.60420 },
  { id: 'lm3', label: 'Carrefour',           type: 'DESTINATION_POI', lat: 0.32845, lng: 32.60412 },
  { id: 'lm4', label: 'Food Court',          type: 'DESTINATION_POI', lat: 0.32810, lng: 32.60380 },
  { id: 'lm5', label: 'MTN Store',           type: 'DESTINATION_POI', lat: 0.32780, lng: 32.60350 },
  { id: 'lm6', label: 'Cinema',              type: 'DESTINATION_POI', lat: 0.32760, lng: 32.60440 },
  { id: 'lm7', label: 'Stanbic / ATMs',      type: 'DESTINATION_POI', lat: 0.32830, lng: 32.60460 },
  { id: 'lm8', label: 'Main Entrance',       type: 'DESTINATION_POI', lat: 0.32860, lng: 32.60370 },
];

/* ============================================================
   Phase 3b: Slots Seed Data — 30 slots across 5 zones
   ============================================================ */

PMS.slots = [
  /* Zone A — Carrefour (6 slots) */
  { id: 's1',  slotId: 'A1', label: 'A1', lat: 0.32850, lng: 32.60390, status: 'OCCUPIED',      destinationId: 'd1' },
  { id: 's2',  slotId: 'A2', label: 'A2', lat: 0.32848, lng: 32.60400, status: 'AVAILABLE',     destinationId: 'd1' },
  { id: 's3',  slotId: 'A3', label: 'A3', lat: 0.32846, lng: 32.60410, status: 'OCCUPIED',      destinationId: 'd1' },
  { id: 's4',  slotId: 'A4', label: 'A4', lat: 0.32844, lng: 32.60420, status: 'AVAILABLE',     destinationId: 'd1' },
  { id: 's5',  slotId: 'A5', label: 'A5', lat: 0.32842, lng: 32.60430, status: 'OUT_OF_SERVICE', destinationId: 'd1' },
  { id: 's6',  slotId: 'A6', label: 'A6', lat: 0.32840, lng: 32.60440, status: 'AVAILABLE',     destinationId: 'd1' },

  /* Zone B — Food Court (6 slots) */
  { id: 's7',  slotId: 'B1', label: 'B1', lat: 0.32820, lng: 32.60360, status: 'OCCUPIED',      destinationId: 'd2' },
  { id: 's8',  slotId: 'B2', label: 'B2', lat: 0.32818, lng: 32.60370, status: 'OCCUPIED',      destinationId: 'd2' },
  { id: 's9',  slotId: 'B3', label: 'B3', lat: 0.32816, lng: 32.60380, status: 'AVAILABLE',     destinationId: 'd2' },
  { id: 's10', slotId: 'B4', label: 'B4', lat: 0.32814, lng: 32.60390, status: 'AVAILABLE',     destinationId: 'd2' },
  { id: 's11', slotId: 'B5', label: 'B5', lat: 0.32812, lng: 32.60400, status: 'OCCUPIED',      destinationId: 'd2' },
  { id: 's12', slotId: 'B6', label: 'B6', lat: 0.32810, lng: 32.60410, status: 'AVAILABLE',     destinationId: 'd2' },

  /* Zone C — MTN / Gym (6 slots) */
  { id: 's13', slotId: 'C1', label: 'C1', lat: 0.32795, lng: 32.60330, status: 'AVAILABLE',     destinationId: 'd3' },
  { id: 's14', slotId: 'C2', label: 'C2', lat: 0.32793, lng: 32.60340, status: 'OCCUPIED',      destinationId: 'd3' },
  { id: 's15', slotId: 'C3', label: 'C3', lat: 0.32791, lng: 32.60350, status: 'AVAILABLE',     destinationId: 'd3' },
  { id: 's16', slotId: 'C4', label: 'C4', lat: 0.32789, lng: 32.60360, status: 'OUT_OF_SERVICE', destinationId: 'd3' },
  { id: 's17', slotId: 'C5', label: 'C5', lat: 0.32787, lng: 32.60370, status: 'AVAILABLE',     destinationId: 'd3' },
  { id: 's18', slotId: 'C6', label: 'C6', lat: 0.32785, lng: 32.60380, status: 'OCCUPIED',      destinationId: 'd3' },

  /* Zone D — Cinema (6 slots) */
  { id: 's19', slotId: 'D1', label: 'D1', lat: 0.32770, lng: 32.60420, status: 'OCCUPIED',      destinationId: 'd4' },
  { id: 's20', slotId: 'D2', label: 'D2', lat: 0.32768, lng: 32.60430, status: 'AVAILABLE',     destinationId: 'd4' },
  { id: 's21', slotId: 'D3', label: 'D3', lat: 0.32766, lng: 32.60440, status: 'AVAILABLE',     destinationId: 'd4' },
  { id: 's22', slotId: 'D4', label: 'D4', lat: 0.32764, lng: 32.60450, status: 'OCCUPIED',      destinationId: 'd4' },
  { id: 's23', slotId: 'D5', label: 'D5', lat: 0.32762, lng: 32.60460, status: 'AVAILABLE',     destinationId: 'd4' },
  { id: 's24', slotId: 'D6', label: 'D6', lat: 0.32760, lng: 32.60470, status: 'OCCUPIED',      destinationId: 'd4' },

  /* Zone E — Bank / ATMs (6 slots) */
  { id: 's25', slotId: 'E1', label: 'E1', lat: 0.32835, lng: 32.60450, status: 'AVAILABLE',     destinationId: 'd5' },
  { id: 's26', slotId: 'E2', label: 'E2', lat: 0.32833, lng: 32.60460, status: 'OCCUPIED',      destinationId: 'd5' },
  { id: 's27', slotId: 'E3', label: 'E3', lat: 0.32831, lng: 32.60470, status: 'AVAILABLE',     destinationId: 'd5' },
  { id: 's28', slotId: 'E4', label: 'E4', lat: 0.32829, lng: 32.60480, status: 'OCCUPIED',      destinationId: 'd5' },
  { id: 's29', slotId: 'E5', label: 'E5', lat: 0.32827, lng: 32.60490, status: 'AVAILABLE',     destinationId: 'd5' },
  { id: 's30', slotId: 'E6', label: 'E6', lat: 0.32825, lng: 32.60500, status: 'OUT_OF_SERVICE', destinationId: 'd5' },
];

/* ============================================================
   Phase 3c: Sessions Seed Data + State Store + Helpers
   ============================================================ */

const now = Date.now();
const min = 60000;
const hr  = 3600000;

PMS.sessions = [
  { id: 'ss1',  plateNumber: 'UAA 123B', driverPhone: '+256701234567', destinationId: 'd1', destinationName: 'Carrefour Supermarket', slotId: 'A1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 2*hr - 15*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss2',  plateNumber: 'UBB 456C', driverPhone: '+256772345678', destinationId: 'd2', destinationName: 'Food Court',            slotId: 'B1', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 1*hr - 40*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss3',  plateNumber: 'UCC 789D', driverPhone: '+256753456789', destinationId: 'd2', destinationName: 'Food Court',            slotId: 'B2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 3*hr - 5*min),  exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss4',  plateNumber: 'UDD 321E', driverPhone: '+256784567890', destinationId: 'd3', destinationName: 'MTN Store',             slotId: 'C2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 0*hr - 45*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss5',  plateNumber: 'UEE 654F', driverPhone: '+256705678901', destinationId: 'd4', destinationName: 'Cinema (Ster-Kinekor)', slotId: 'D1', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 1*hr - 20*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss6',  plateNumber: 'UFF 987G', driverPhone: '+256776789012', destinationId: 'd4', destinationName: 'Cinema (Ster-Kinekor)', slotId: 'D4', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 2*hr - 50*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss7',  plateNumber: 'UGG 147H', driverPhone: '+256757890123', destinationId: 'd5', destinationName: 'Stanbic Bank / ATMs',  slotId: 'E2', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 0*hr - 30*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss8',  plateNumber: 'UHH 258I', driverPhone: '+256788901234', destinationId: 'd5', destinationName: 'Stanbic Bank / ATMs',  slotId: 'E4', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 1*hr - 10*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss9',  plateNumber: 'UII 369J', driverPhone: '+256709012345', destinationId: 'd1', destinationName: 'Carrefour Supermarket', slotId: 'A3', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 4*hr - 0*min),  exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss10', plateNumber: 'UJJ 741K', driverPhone: '+256770123456', destinationId: 'd3', destinationName: 'MTN Store',             slotId: 'C6', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 0*hr - 55*min), exitTime: null,                          status: 'ACTIVE'  },
  { id: 'ss11', plateNumber: 'UKK 852L', driverPhone: '+256751234567', destinationId: 'd4', destinationName: 'Cinema (Ster-Kinekor)', slotId: 'D6', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 5*hr - 30*min), exitTime: null,                          status: 'ACTIVE'  },
  /* Closed sessions (history) */
  { id: 'ss12', plateNumber: 'ULL 963M', driverPhone: '+256782345678', destinationId: 'd1', destinationName: 'Carrefour Supermarket', slotId: 'A2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 6*hr),          exitTime: new Date(now - 4*hr),          status: 'CLOSED'  },
  { id: 'ss13', plateNumber: 'UMM 074N', driverPhone: '+256713456789', destinationId: 'd2', destinationName: 'Food Court',            slotId: 'B3', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 5*hr),          exitTime: new Date(now - 3*hr - 30*min), status: 'CLOSED'  },
  { id: 'ss14', plateNumber: 'UNN 185O', driverPhone: '+256744567890', destinationId: 'd3', destinationName: 'MTN Store',             slotId: 'C1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 7*hr),          exitTime: new Date(now - 5*hr - 45*min), status: 'CLOSED'  },
  { id: 'ss15', plateNumber: 'UOO 296P', driverPhone: '+256775678901', destinationId: 'd8', destinationName: 'Main Entrance / Lobby', slotId: 'B4', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 8*hr),          exitTime: new Date(now - 6*hr - 20*min), status: 'CLOSED'  },
];

/* ============================================================
   State Store
   ============================================================ */
PMS.state = {
  currentUser:    null,
  slots:          PMS.slots,
  sessions:       PMS.sessions,
  destinations:   PMS.destinations,
  landmarks:      PMS.landmarks,
  users:          PMS.users,
  listeners:      [],

  subscribe(fn) { this.listeners.push(fn); },

  notify(event, data) {
    this.listeners.forEach(fn => fn(event, data));
  },

  /* Auth */
  login(username, password) {
    const user = this.users.find(u => u.username === username);
    if (!user) return { ok: false, error: 'Invalid username or password.' };
    if (user.lockedUntil && Date.now() < user.lockedUntil) {
      const mins = Math.ceil((user.lockedUntil - Date.now()) / 60000);
      return { ok: false, error: `Account locked. Try again in ${mins} minute(s).` };
    }
    if (user.passwordHash !== password) {
      user.failedAttempts = (user.failedAttempts || 0) + 1;
      if (user.failedAttempts >= 5) {
        user.lockedUntil = Date.now() + 15 * 60000;
        return { ok: false, error: 'Too many failed attempts. Account locked for 15 minutes.' };
      }
      return { ok: false, error: `Invalid username or password. (${5 - user.failedAttempts} attempts left)` };
    }
    user.failedAttempts = 0;
    user.lockedUntil = null;
    this.currentUser = user;
    localStorage.setItem('pms_user', JSON.stringify({ id: user.id, username: user.username, role: user.role, name: user.name }));
    return { ok: true, user };
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('pms_user');
  },

  restoreSession() {
    const saved = localStorage.getItem('pms_user');
    if (saved) {
      const u = JSON.parse(saved);
      this.currentUser = this.users.find(x => x.id === u.id) || null;
    }
    return this.currentUser;
  },

  /* Slots */
  getSlot(slotId)       { return this.slots.find(s => s.slotId === slotId); },
  getSlotById(id)       { return this.slots.find(s => s.id === id); },
  availableSlots()      { return this.slots.filter(s => s.status === 'AVAILABLE'); },
  occupiedSlots()       { return this.slots.filter(s => s.status === 'OCCUPIED'); },
  oosSlots()            { return this.slots.filter(s => s.status === 'OUT_OF_SERVICE'); },

  setSlotStatus(slotId, status) {
    const slot = this.getSlot(slotId);
    if (slot) { slot.status = status; this.notify('slot_updated', { slotId, status }); }
  },

  /* Sessions */
  activeSessionForSlot(slotId) {
    return this.sessions.find(s => s.slotId === slotId && s.status === 'ACTIVE');
  },
  activeSessionForPlate(plate) {
    return this.sessions.find(s => s.plateNumber === plate.toUpperCase().replace(/\s+/g,' ').trim() && s.status === 'ACTIVE');
  },
  searchSessions(term) {
    if (!term) return [...this.sessions].sort((a,b) => b.entryTime - a.entryTime);
    const t = term.toLowerCase();
    return this.sessions
      .filter(s => s.plateNumber.toLowerCase().includes(t) || s.driverPhone.includes(t))
      .sort((a,b) => b.entryTime - a.entryTime);
  },

  createSession(data) {
    const session = {
      id:              'ss' + Date.now(),
      plateNumber:     data.plateNumber.toUpperCase().replace(/\s+/g,' ').trim(),
      driverPhone:     data.driverPhone,
      destinationId:   data.destinationId,
      destinationName: data.destinationName,
      slotId:          data.slotId,
      attendantId:     this.currentUser.id,
      attendantName:   this.currentUser.name,
      entryTime:       new Date(),
      exitTime:        null,
      status:          'ACTIVE',
    };
    this.sessions.unshift(session);
    this.setSlotStatus(data.slotId, 'OCCUPIED');
    this.notify('session_created', session);
    this.notify('parking_full', { full: this.availableSlots().length === 0 });
    return session;
  },

  closeSession(plate) {
    const session = this.activeSessionForPlate(plate);
    if (!session) return null;
    session.exitTime = new Date();
    session.status   = 'CLOSED';
    this.setSlotStatus(session.slotId, 'AVAILABLE');
    this.notify('session_closed', { sessionId: session.id, slotId: session.slotId });
    this.notify('parking_full', { full: false });
    return session;
  },

  /* Destinations */
  getDestination(id) { return this.destinations.find(d => d.id === id); },

  addDestination(name, anchorLat, anchorLng) {
    const dest = { id: 'd' + Date.now(), name, anchorLat: parseFloat(anchorLat), anchorLng: parseFloat(anchorLng) };
    this.destinations.push(dest);
    this.notify('destination_added', dest);
    return dest;
  },

  updateDestination(id, name, anchorLat, anchorLng) {
    const dest = this.getDestination(id);
    if (!dest) return;
    dest.name = name;
    dest.anchorLat = parseFloat(anchorLat);
    dest.anchorLng = parseFloat(anchorLng);
    this.sessions.filter(s => s.destinationId === id && s.status === 'ACTIVE')
      .forEach(s => s.destinationName = name);
    this.notify('destination_updated', dest);
  },

  deleteDestination(id) {
    const active = this.sessions.filter(s => s.destinationId === id && s.status === 'ACTIVE');
    if (active.length > 0) return { ok: false, activeSessions: active.length };
    this.destinations = this.destinations.filter(d => d.id !== id);
    this.notify('destination_deleted', { id });
    return { ok: true };
  },

  /* Nearest slot (Haversine) */
  findNearestSlot(destinationId) {
    const dest = this.getDestination(destinationId);
    if (!dest) return null;
    const available = this.availableSlots();
    if (!available.length) return null;
    const haversine = (lat1, lng1, lat2, lng2) => {
      const R = 6371000, toRad = x => x * Math.PI / 180;
      const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng/2)**2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    return available
      .map(s => ({ slot: s, dist: haversine(dest.anchorLat, dest.anchorLng, s.lat, s.lng) }))
      .sort((a,b) => a.dist - b.dist || a.slot.slotId.localeCompare(b.slot.slotId))[0].slot;
  },

  /* Dashboard stats */
  getStats() {
    const midnight = new Date(); midnight.setHours(0,0,0,0);
    return {
      total:      this.slots.length,
      occupied:   this.occupiedSlots().length,
      available:  this.availableSlots().length,
      oos:        this.oosSlots().length,
      totalToday: this.sessions.filter(s => new Date(s.entryTime) >= midnight).length,
    };
  },
};

/* ============================================================
   Helpers
   ============================================================ */
PMS.formatElapsed = function(entryTime) {
  const ms   = Date.now() - new Date(entryTime).getTime();
  const h    = Math.floor(ms / 3600000);
  const m    = Math.floor((ms % 3600000) / 60000);
  return `${h}h ${m}m`;
};

PMS.formatTime = function(date) {
  if (!date) return '—';
  return new Date(date).toLocaleTimeString('en-UG', { hour: '2-digit', minute: '2-digit', hour12: true });
};

PMS.formatDateTime = function(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-UG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true });
};

PMS.validateUgandaPhone = function(phone) {
  return /^(\+2567\d{8}|07\d{8})$/.test(phone.replace(/\s/g,''));
};

PMS.toast = function(type, title, message) {
  const icons = {
    success: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
    error:   `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    warning: `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
    info:    `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `${icons[type]}<div class="toast-content"><div class="toast-title">${title}</div>${message ? `<div class="toast-message">${message}</div>` : ''}</div><button class="toast-close" onclick="this.parentElement.remove()"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
  container.appendChild(el);
  setTimeout(() => el.remove(), 4000);
};
