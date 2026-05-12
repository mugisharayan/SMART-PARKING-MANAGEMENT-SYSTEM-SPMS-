/* ─────────────────────────────────────────────────────────
   demo.js  —  offline / no-backend fallback data store
   Mirrors prototype/state.js exactly.
   All mutations are in-memory so the demo feels live.
───────────────────────────────────────────────────────── */

const now = Date.now();
const min = 60000;
const hr  = 3600000;

export const demoDestinations = [
  { _id: 'd1', id: 'd1', name: 'Carrefour Supermarket', anchorLat: 0.33180, anchorLng: 32.59280 },
  { _id: 'd2', id: 'd2', name: 'Food Court',            anchorLat: 0.33120, anchorLng: 32.59300 },
  { _id: 'd3', id: 'd3', name: 'MTN Store',             anchorLat: 0.33100, anchorLng: 32.59350 },
  { _id: 'd4', id: 'd4', name: 'Cinema (Ster-Kinekor)', anchorLat: 0.33080, anchorLng: 32.59400 },
  { _id: 'd5', id: 'd5', name: 'Stanbic Bank / ATMs',   anchorLat: 0.33150, anchorLng: 32.59420 },
  { _id: 'd6', id: 'd6', name: 'Gym & Fitness Centre',  anchorLat: 0.33200, anchorLng: 32.59260 },
  { _id: 'd7', id: 'd7', name: 'Pharmacy',              anchorLat: 0.33160, anchorLng: 32.59310 },
  { _id: 'd8', id: 'd8', name: 'Main Entrance / Lobby', anchorLat: 0.33220, anchorLng: 32.59330 },
];

export const demoLandmarks = [
  { _id: 'lm1', label: 'Entry Gate',    type: 'ENTRY_GATE',      lat: 0.33240, lng: 32.59290 },
  { _id: 'lm2', label: 'Exit Gate',     type: 'EXIT_GATE',       lat: 0.33060, lng: 32.59380 },
  { _id: 'lm3', label: 'Carrefour',     type: 'DESTINATION_POI', lat: 0.33180, lng: 32.59280 },
  { _id: 'lm4', label: 'Food Court',    type: 'DESTINATION_POI', lat: 0.33120, lng: 32.59300 },
  { _id: 'lm5', label: 'MTN Store',     type: 'DESTINATION_POI', lat: 0.33100, lng: 32.59350 },
  { _id: 'lm6', label: 'Cinema',        type: 'DESTINATION_POI', lat: 0.33080, lng: 32.59400 },
  { _id: 'lm7', label: 'Stanbic / ATMs',type: 'DESTINATION_POI', lat: 0.33150, lng: 32.59420 },
  { _id: 'lm8', label: 'Main Entrance', type: 'DESTINATION_POI', lat: 0.33220, lng: 32.59330 },
];

/* mutable — mutations update this array in place */
export const demoSlots = [
  /* Zone A — West lot, Row 1 (Carrefour side) — 6 slots running north-south */
  { _id: 's1',  slotId: 'A1', lat: 0.33220, lng: 32.59268, status: 'OCCUPIED',       destinationId: 'd1' },
  { _id: 's2',  slotId: 'A2', lat: 0.33208, lng: 32.59268, status: 'AVAILABLE',      destinationId: 'd1' },
  { _id: 's3',  slotId: 'A3', lat: 0.33196, lng: 32.59268, status: 'OCCUPIED',       destinationId: 'd1' },
  { _id: 's4',  slotId: 'A4', lat: 0.33184, lng: 32.59268, status: 'AVAILABLE',      destinationId: 'd1' },
  { _id: 's5',  slotId: 'A5', lat: 0.33172, lng: 32.59268, status: 'OUT_OF_SERVICE', destinationId: 'd1' },
  { _id: 's6',  slotId: 'A6', lat: 0.33160, lng: 32.59268, status: 'AVAILABLE',      destinationId: 'd1' },

  /* Zone B — West lot, Row 2 (Food Court side) — 6 slots running north-south */
  { _id: 's7',  slotId: 'B1', lat: 0.33220, lng: 32.59282, status: 'OCCUPIED',       destinationId: 'd2' },
  { _id: 's8',  slotId: 'B2', lat: 0.33208, lng: 32.59282, status: 'OCCUPIED',       destinationId: 'd2' },
  { _id: 's9',  slotId: 'B3', lat: 0.33196, lng: 32.59282, status: 'AVAILABLE',      destinationId: 'd2' },
  { _id: 's10', slotId: 'B4', lat: 0.33184, lng: 32.59282, status: 'AVAILABLE',      destinationId: 'd2' },
  { _id: 's11', slotId: 'B5', lat: 0.33172, lng: 32.59282, status: 'OCCUPIED',       destinationId: 'd2' },
  { _id: 's12', slotId: 'B6', lat: 0.33160, lng: 32.59282, status: 'AVAILABLE',      destinationId: 'd2' },

  /* Zone C — West lot, Row 3 (MTN / Gym side) — 6 slots running north-south */
  { _id: 's13', slotId: 'C1', lat: 0.33220, lng: 32.59296, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's14', slotId: 'C2', lat: 0.33208, lng: 32.59296, status: 'OCCUPIED',       destinationId: 'd3' },
  { _id: 's15', slotId: 'C3', lat: 0.33196, lng: 32.59296, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's16', slotId: 'C4', lat: 0.33184, lng: 32.59296, status: 'OUT_OF_SERVICE', destinationId: 'd3' },
  { _id: 's17', slotId: 'C5', lat: 0.33172, lng: 32.59296, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's18', slotId: 'C6', lat: 0.33160, lng: 32.59296, status: 'OCCUPIED',       destinationId: 'd3' },

  /* Zone D — South lot, Row 1 (Cinema side) — 6 slots running east-west */
  { _id: 's19', slotId: 'D1', lat: 0.33092, lng: 32.59320, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's20', slotId: 'D2', lat: 0.33092, lng: 32.59336, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's21', slotId: 'D3', lat: 0.33092, lng: 32.59352, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's22', slotId: 'D4', lat: 0.33092, lng: 32.59368, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's23', slotId: 'D5', lat: 0.33092, lng: 32.59384, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's24', slotId: 'D6', lat: 0.33092, lng: 32.59400, status: 'OCCUPIED',       destinationId: 'd4' },

  /* Zone E — South lot, Row 2 (Bank / ATMs side) — 6 slots running east-west */
  { _id: 's25', slotId: 'E1', lat: 0.33078, lng: 32.59320, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's26', slotId: 'E2', lat: 0.33078, lng: 32.59336, status: 'OCCUPIED',       destinationId: 'd5' },
  { _id: 's27', slotId: 'E3', lat: 0.33078, lng: 32.59352, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's28', slotId: 'E4', lat: 0.33078, lng: 32.59368, status: 'OCCUPIED',       destinationId: 'd5' },
  { _id: 's29', slotId: 'E5', lat: 0.33078, lng: 32.59384, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's30', slotId: 'E6', lat: 0.33078, lng: 32.59400, status: 'OUT_OF_SERVICE', destinationId: 'd5' },
];

/* mutable session list — new sessions prepended */
export const demoSessions = [
  { _id: 'ss1',  plateNumber: 'UAA 123B', driverPhone: '+256701234567', destinationId: 'd1', destinationName: 'Carrefour Supermarket', slotId: 'A1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 2*hr - 15*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss2',  plateNumber: 'UBB 456C', driverPhone: '+256772345678', destinationId: 'd2', destinationName: 'Food Court',            slotId: 'B1', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 1*hr - 40*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss3',  plateNumber: 'UCC 789D', driverPhone: '+256753456789', destinationId: 'd2', destinationName: 'Food Court',            slotId: 'B2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 3*hr - 5*min).toISOString(),  exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss4',  plateNumber: 'UDD 321E', driverPhone: '+256784567890', destinationId: 'd3', destinationName: 'MTN Store',             slotId: 'C2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 45*min).toISOString(),         exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss5',  plateNumber: 'UEE 654F', driverPhone: '+256705678901', destinationId: 'd4', destinationName: 'Cinema (Ster-Kinekor)', slotId: 'D1', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 1*hr - 20*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss6',  plateNumber: 'UFF 987G', driverPhone: '+256776789012', destinationId: 'd4', destinationName: 'Cinema (Ster-Kinekor)', slotId: 'D4', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 2*hr - 50*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss7',  plateNumber: 'UGG 147H', driverPhone: '+256757890123', destinationId: 'd5', destinationName: 'Stanbic Bank / ATMs',  slotId: 'E2', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 30*min).toISOString(),         exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss8',  plateNumber: 'UHH 258I', driverPhone: '+256788901234', destinationId: 'd5', destinationName: 'Stanbic Bank / ATMs',  slotId: 'E4', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 1*hr - 10*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss9',  plateNumber: 'UII 369J', driverPhone: '+256709012345', destinationId: 'd1', destinationName: 'Carrefour Supermarket', slotId: 'A3', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 4*hr).toISOString(),           exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss10', plateNumber: 'UJJ 741K', driverPhone: '+256770123456', destinationId: 'd3', destinationName: 'MTN Store',             slotId: 'C6', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 55*min).toISOString(),         exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss11', plateNumber: 'UKK 852L', driverPhone: '+256751234567', destinationId: 'd4', destinationName: 'Cinema (Ster-Kinekor)', slotId: 'D6', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 5*hr - 30*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss12', plateNumber: 'ULL 963M', driverPhone: '+256782345678', destinationId: 'd1', destinationName: 'Carrefour Supermarket', slotId: 'A2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 6*hr).toISOString(),           exitTime: new Date(now - 4*hr).toISOString(),          status: 'CLOSED' },
  { _id: 'ss13', plateNumber: 'UMM 074N', driverPhone: '+256713456789', destinationId: 'd2', destinationName: 'Food Court',            slotId: 'B3', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 5*hr).toISOString(),           exitTime: new Date(now - 3*hr - 30*min).toISOString(), status: 'CLOSED' },
  { _id: 'ss14', plateNumber: 'UNN 185O', driverPhone: '+256744567890', destinationId: 'd3', destinationName: 'MTN Store',             slotId: 'C1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 7*hr).toISOString(),           exitTime: new Date(now - 5*hr - 45*min).toISOString(), status: 'CLOSED' },
  { _id: 'ss15', plateNumber: 'UOO 296P', driverPhone: '+256775678901', destinationId: 'd8', destinationName: 'Main Entrance / Lobby', slotId: 'B4', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 8*hr).toISOString(),           exitTime: new Date(now - 6*hr - 20*min).toISOString(), status: 'CLOSED' },
];

/* ── Haversine nearest-slot ── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function demoNearestSlot(destinationId) {
  const dest = demoDestinations.find((d) => d._id === destinationId || d.id === destinationId);
  if (!dest) return null;
  const available = demoSlots.filter((s) => s.status === 'AVAILABLE');
  if (!available.length) return null;
  return available
    .map((s) => ({ slot: s, dist: haversine(dest.anchorLat, dest.anchorLng, s.lat, s.lng) }))
    .sort((a, b) => a.dist - b.dist || a.slot.slotId.localeCompare(b.slot.slotId))[0].slot;
}

/* ── Demo mutations ── */
export function demoCreateSession({ plateNumber, driverPhone, destinationId, slotId, attendantName = 'James Okello', attendantId = 'u2' }) {
  const dest = demoDestinations.find((d) => d._id === destinationId || d.id === destinationId);
  const session = {
    _id:             'ss_' + Date.now(),
    plateNumber:     plateNumber.toUpperCase().replace(/\s+/g, ' ').trim(),
    driverPhone,
    destinationId,
    destinationName: dest?.name || '',
    slotId,
    attendantId,
    attendantName,
    entryTime:       new Date().toISOString(),
    exitTime:        null,
    status:          'ACTIVE',
  };
  demoSessions.unshift(session);
  const slot = demoSlots.find((s) => s.slotId === slotId);
  if (slot) slot.status = 'OCCUPIED';
  return session;
}

export function demoCloseSession(sessionId) {
  const session = demoSessions.find((s) => s._id === sessionId);
  if (!session || session.status !== 'ACTIVE') return null;
  session.exitTime = new Date().toISOString();
  session.status   = 'CLOSED';
  const slot = demoSlots.find((s) => s.slotId === session.slotId);
  if (slot) slot.status = 'AVAILABLE';
  return session;
}

export function demoActiveSessionForPlate(plate) {
  const norm = plate.toUpperCase().replace(/\s+/g, ' ').trim();
  return demoSessions.find((s) => s.plateNumber === norm && s.status === 'ACTIVE') || null;
}

export function demoSearchSessions(term) {
  const sorted = [...demoSessions].sort((a, b) => new Date(b.entryTime) - new Date(a.entryTime));
  if (!term) return sorted;
  const t = term.toLowerCase();
  return sorted.filter((s) => s.plateNumber.toLowerCase().includes(t) || s.driverPhone.includes(t));
}

/* ── isDemoMode: true when token starts with "demo-" ── */
export function isDemoMode() {
  try {
    const stored = localStorage.getItem('pms_auth');
    if (!stored) return false;
    const { token } = JSON.parse(stored);
    return typeof token === 'string' && token.startsWith('demo-token-');
  } catch {
    return false;
  }
}
