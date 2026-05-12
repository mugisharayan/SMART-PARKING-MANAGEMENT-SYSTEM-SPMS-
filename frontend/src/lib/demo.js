/* ─────────────────────────────────────────────────────────
   demo.js  —  offline / no-backend fallback data store
   Mirrors prototype/state.js exactly.
   All mutations are in-memory so the demo feels live.
───────────────────────────────────────────────────────── */

const now = Date.now();
const min = 60000;
const hr  = 3600000;

export const demoDestinations = [
  { _id: 'd1', id: 'd1', name: 'Airtel Service Center',  anchorLat: 0.32690, anchorLng: 32.60607 },
  { _id: 'd2', id: 'd2', name: 'UAE Exchange Lugogo',    anchorLat: 0.32690, anchorLng: 32.60614 },
  { _id: 'd3', id: 'd3', name: 'Good African Coffee',    anchorLat: 0.32678, anchorLng: 32.60628 },
  { _id: 'd4', id: 'd4', name: 'Carrefour Lugogo',       anchorLat: 0.32672, anchorLng: 32.60656 },
  { _id: 'd5', id: 'd5', name: 'Banana Boat',            anchorLat: 0.32600, anchorLng: 32.60710 },
  { _id: 'd6', id: 'd6', name: 'Game Store',             anchorLat: 0.32590, anchorLng: 32.60696 },
  { _id: 'd7', id: 'd7', name: 'MTN',                    anchorLat: 0.32580, anchorLng: 32.60680 },
  { _id: 'd8', id: 'd8', name: 'ABSA Lugogo Branch',     anchorLat: 0.32645, anchorLng: 32.60677 },
];

export const demoLandmarks = [
  { _id: 'lm1', label: 'Entry Gate',    type: 'ENTRY_GATE',      lat: 0.32730, lng: 32.60650 },
  { _id: 'lm2', label: 'Exit Gate',     type: 'EXIT_GATE',       lat: 0.32610, lng: 32.60700 },
  { _id: 'lm3', label: 'Carrefour',     type: 'DESTINATION_POI', lat: 0.32700, lng: 32.60620 },
  { _id: 'lm4', label: 'Food Court',    type: 'DESTINATION_POI', lat: 0.32660, lng: 32.60640 },
  { _id: 'lm5', label: 'MTN Store',     type: 'DESTINATION_POI', lat: 0.32640, lng: 32.60660 },
  { _id: 'lm6', label: 'Cinema',        type: 'DESTINATION_POI', lat: 0.32620, lng: 32.60700 },
  { _id: 'lm7', label: 'Stanbic / ATMs',type: 'DESTINATION_POI', lat: 0.32650, lng: 32.60730 },
  { _id: 'lm8', label: 'Main Entrance', type: 'DESTINATION_POI', lat: 0.32710, lng: 32.60680 },
];

/* mutable — mutations update this array in place */
export const demoSlots = [
  /* Zone A — West lot, Row 1 — north-south */
  { _id: 's1',  slotId: 'A1', lat: 0.32720, lng: 32.60600, status: 'OCCUPIED',       destinationId: 'd1' },
  { _id: 's2',  slotId: 'A2', lat: 0.32708, lng: 32.60600, status: 'AVAILABLE',      destinationId: 'd1' },
  { _id: 's3',  slotId: 'A3', lat: 0.32696, lng: 32.60600, status: 'OCCUPIED',       destinationId: 'd1' },
  { _id: 's4',  slotId: 'A4', lat: 0.32684, lng: 32.60600, status: 'AVAILABLE',      destinationId: 'd1' },
  { _id: 's5',  slotId: 'A5', lat: 0.32672, lng: 32.60600, status: 'OUT_OF_SERVICE', destinationId: 'd1' },
  { _id: 's6',  slotId: 'A6', lat: 0.32660, lng: 32.60600, status: 'AVAILABLE',      destinationId: 'd1' },
  { _id: 's7',  slotId: 'B1', lat: 0.32720, lng: 32.60614, status: 'OCCUPIED',       destinationId: 'd1' },
  { _id: 's8',  slotId: 'B2', lat: 0.32708, lng: 32.60614, status: 'OCCUPIED',       destinationId: 'd1' },
  { _id: 's9',  slotId: 'B3', lat: 0.32696, lng: 32.60614, status: 'AVAILABLE',      destinationId: 'd1' },
  { _id: 's10', slotId: 'B4', lat: 0.32684, lng: 32.60614, status: 'AVAILABLE',      destinationId: 'd1' },
  { _id: 's11', slotId: 'B5', lat: 0.32672, lng: 32.60614, status: 'OCCUPIED',       destinationId: 'd1' },
  { _id: 's12', slotId: 'B6', lat: 0.32660, lng: 32.60614, status: 'AVAILABLE',      destinationId: 'd1' },

  { _id: 's13', slotId: 'C1', lat: 0.32720, lng: 32.60628, status: 'AVAILABLE',      destinationId: 'd2' },
  { _id: 's14', slotId: 'C2', lat: 0.32708, lng: 32.60628, status: 'OCCUPIED',       destinationId: 'd2' },
  { _id: 's15', slotId: 'C3', lat: 0.32696, lng: 32.60628, status: 'AVAILABLE',      destinationId: 'd2' },
  { _id: 's16', slotId: 'C4', lat: 0.32684, lng: 32.60628, status: 'OUT_OF_SERVICE', destinationId: 'd2' },
  { _id: 's17', slotId: 'C5', lat: 0.32672, lng: 32.60628, status: 'AVAILABLE',      destinationId: 'd2' },
  { _id: 's18', slotId: 'C6', lat: 0.32660, lng: 32.60628, status: 'OCCUPIED',       destinationId: 'd2' },
  { _id: 's19', slotId: 'D1', lat: 0.32640, lng: 32.60640, status: 'OCCUPIED',       destinationId: 'd2' },
  { _id: 's20', slotId: 'D2', lat: 0.32640, lng: 32.60656, status: 'AVAILABLE',      destinationId: 'd2' },
  { _id: 's21', slotId: 'D3', lat: 0.32640, lng: 32.60672, status: 'AVAILABLE',      destinationId: 'd2' },
  { _id: 's22', slotId: 'D4', lat: 0.32640, lng: 32.60688, status: 'OCCUPIED',       destinationId: 'd3' },
  { _id: 's23', slotId: 'D5', lat: 0.32640, lng: 32.60704, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's24', slotId: 'D6', lat: 0.32640, lng: 32.60720, status: 'OCCUPIED',       destinationId: 'd3' },
  { _id: 's25', slotId: 'E1', lat: 0.32626, lng: 32.60640, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's26', slotId: 'E2', lat: 0.32626, lng: 32.60656, status: 'OCCUPIED',       destinationId: 'd3' },
  { _id: 's27', slotId: 'E3', lat: 0.32626, lng: 32.60672, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's28', slotId: 'E4', lat: 0.32626, lng: 32.60688, status: 'OCCUPIED',       destinationId: 'd3' },
  { _id: 's29', slotId: 'E5', lat: 0.32626, lng: 32.60704, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's30', slotId: 'E6', lat: 0.32626, lng: 32.60720, status: 'OUT_OF_SERVICE', destinationId: 'd3' },

  { _id: 's31', slotId: 'F1', lat: 0.32720, lng: 32.60642, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's32', slotId: 'F2', lat: 0.32708, lng: 32.60642, status: 'OCCUPIED',       destinationId: 'd3' },
  { _id: 's33', slotId: 'F3', lat: 0.32696, lng: 32.60642, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's34', slotId: 'F4', lat: 0.32684, lng: 32.60642, status: 'AVAILABLE',      destinationId: 'd3' },
  { _id: 's35', slotId: 'F5', lat: 0.32672, lng: 32.60642, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's36', slotId: 'F6', lat: 0.32660, lng: 32.60642, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's37', slotId: 'F7', lat: 0.32648, lng: 32.60642, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's38', slotId: 'F8', lat: 0.32636, lng: 32.60642, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's39', slotId: 'G1', lat: 0.32720, lng: 32.60656, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's40', slotId: 'G2', lat: 0.32708, lng: 32.60656, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's41', slotId: 'G3', lat: 0.32696, lng: 32.60656, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's42', slotId: 'G4', lat: 0.32684, lng: 32.60656, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's43', slotId: 'G5', lat: 0.32672, lng: 32.60656, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's44', slotId: 'G6', lat: 0.32660, lng: 32.60656, status: 'OUT_OF_SERVICE', destinationId: 'd4' },
  { _id: 's45', slotId: 'G7', lat: 0.32648, lng: 32.60656, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's46', slotId: 'G8', lat: 0.32636, lng: 32.60656, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's47', slotId: 'H1', lat: 0.32612, lng: 32.60640, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's48', slotId: 'H2', lat: 0.32612, lng: 32.60656, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's49', slotId: 'H3', lat: 0.32612, lng: 32.60672, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's50', slotId: 'H4', lat: 0.32612, lng: 32.60688, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's51', slotId: 'H5', lat: 0.32612, lng: 32.60704, status: 'OCCUPIED',       destinationId: 'd5' },
  { _id: 's52', slotId: 'H6', lat: 0.32612, lng: 32.60720, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's53', slotId: 'H7', lat: 0.32612, lng: 32.60736, status: 'OCCUPIED',       destinationId: 'd5' },
  { _id: 's54', slotId: 'H8', lat: 0.32612, lng: 32.60752, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's55', slotId: 'I1', lat: 0.32598, lng: 32.60640, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's56', slotId: 'I2', lat: 0.32598, lng: 32.60656, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's57', slotId: 'I3', lat: 0.32598, lng: 32.60672, status: 'AVAILABLE',      destinationId: 'd4' },
  { _id: 's58', slotId: 'I4', lat: 0.32598, lng: 32.60688, status: 'OCCUPIED',       destinationId: 'd4' },
  { _id: 's59', slotId: 'I5', lat: 0.32598, lng: 32.60704, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's60', slotId: 'I6', lat: 0.32598, lng: 32.60720, status: 'OCCUPIED',       destinationId: 'd5' },
  { _id: 's61', slotId: 'I7', lat: 0.32598, lng: 32.60736, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's62', slotId: 'I8', lat: 0.32598, lng: 32.60752, status: 'OUT_OF_SERVICE', destinationId: 'd5' },

  { _id: 's63', slotId: 'J1', lat: 0.32720, lng: 32.60670, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's64', slotId: 'J2', lat: 0.32708, lng: 32.60670, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's65', slotId: 'J3', lat: 0.32696, lng: 32.60670, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's66', slotId: 'J4', lat: 0.32684, lng: 32.60670, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's67', slotId: 'J5', lat: 0.32672, lng: 32.60670, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's68', slotId: 'J6', lat: 0.32660, lng: 32.60670, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's69', slotId: 'J7', lat: 0.32648, lng: 32.60670, status: 'OCCUPIED',       destinationId: 'd6' },
  { _id: 's70', slotId: 'J8', lat: 0.32636, lng: 32.60670, status: 'AVAILABLE',      destinationId: 'd6' },
  { _id: 's71', slotId: 'K1', lat: 0.32720, lng: 32.60684, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's72', slotId: 'K2', lat: 0.32708, lng: 32.60684, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's73', slotId: 'K3', lat: 0.32696, lng: 32.60684, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's74', slotId: 'K4', lat: 0.32684, lng: 32.60684, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's75', slotId: 'K5', lat: 0.32672, lng: 32.60684, status: 'AVAILABLE',      destinationId: 'd6' },
  { _id: 's76', slotId: 'K6', lat: 0.32660, lng: 32.60684, status: 'AVAILABLE',      destinationId: 'd6' },
  { _id: 's77', slotId: 'K7', lat: 0.32648, lng: 32.60684, status: 'OCCUPIED',       destinationId: 'd6' },
  { _id: 's78', slotId: 'K8', lat: 0.32636, lng: 32.60684, status: 'OUT_OF_SERVICE', destinationId: 'd6' },
  { _id: 's79', slotId: 'L1', lat: 0.32720, lng: 32.60698, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's80', slotId: 'L2', lat: 0.32708, lng: 32.60698, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's81', slotId: 'L3', lat: 0.32696, lng: 32.60698, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's82', slotId: 'L4', lat: 0.32684, lng: 32.60698, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's83', slotId: 'L5', lat: 0.32672, lng: 32.60698, status: 'AVAILABLE',      destinationId: 'd7' },
  { _id: 's84', slotId: 'L6', lat: 0.32660, lng: 32.60698, status: 'OCCUPIED',       destinationId: 'd7' },
  { _id: 's85', slotId: 'L7', lat: 0.32648, lng: 32.60698, status: 'AVAILABLE',      destinationId: 'd7' },
  { _id: 's86', slotId: 'L8', lat: 0.32636, lng: 32.60698, status: 'AVAILABLE',      destinationId: 'd7' },
  { _id: 's87', slotId: 'M1', lat: 0.32584, lng: 32.60640, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's88', slotId: 'M2', lat: 0.32584, lng: 32.60656, status: 'OCCUPIED',       destinationId: 'd5' },
  { _id: 's89', slotId: 'M3', lat: 0.32584, lng: 32.60672, status: 'AVAILABLE',      destinationId: 'd5' },
  { _id: 's90', slotId: 'M4', lat: 0.32584, lng: 32.60688, status: 'OCCUPIED',       destinationId: 'd5' },
  { _id: 's91', slotId: 'M5', lat: 0.32584, lng: 32.60704, status: 'AVAILABLE',      destinationId: 'd6' },
  { _id: 's92', slotId: 'M6', lat: 0.32584, lng: 32.60720, status: 'AVAILABLE',      destinationId: 'd6' },
  { _id: 's93', slotId: 'M7', lat: 0.32584, lng: 32.60736, status: 'OCCUPIED',       destinationId: 'd7' },
  { _id: 's94', slotId: 'M8', lat: 0.32584, lng: 32.60752, status: 'OUT_OF_SERVICE', destinationId: 'd7' },
  { _id: 's95',  slotId: 'N1', lat: 0.32570, lng: 32.60640, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's96',  slotId: 'N2', lat: 0.32570, lng: 32.60656, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's97',  slotId: 'N3', lat: 0.32570, lng: 32.60672, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's98',  slotId: 'N4', lat: 0.32570, lng: 32.60688, status: 'OCCUPIED',       destinationId: 'd8' },
  { _id: 's99',  slotId: 'N5', lat: 0.32570, lng: 32.60704, status: 'AVAILABLE',      destinationId: 'd8' },
  { _id: 's100', slotId: 'N6', lat: 0.32570, lng: 32.60720, status: 'OCCUPIED',       destinationId: 'd8' },
];

/* mutable session list — new sessions prepended */
export const demoSessions = [
  { _id: 'ss1',  plateNumber: 'UAA 123B', driverPhone: '+256701234567', destinationId: 'd1', destinationName: 'Airtel Service Center',  slotId: 'A1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 2*hr - 15*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss2',  plateNumber: 'UBB 456C', driverPhone: '+256772345678', destinationId: 'd1', destinationName: 'Airtel Service Center',  slotId: 'B1', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 1*hr - 40*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss3',  plateNumber: 'UCC 789D', driverPhone: '+256753456789', destinationId: 'd2', destinationName: 'UAE Exchange Lugogo',    slotId: 'C2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 3*hr - 5*min).toISOString(),  exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss4',  plateNumber: 'UDD 321E', driverPhone: '+256784567890', destinationId: 'd2', destinationName: 'UAE Exchange Lugogo',    slotId: 'D1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 45*min).toISOString(),         exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss5',  plateNumber: 'UEE 654F', driverPhone: '+256705678901', destinationId: 'd3', destinationName: 'Good African Coffee',    slotId: 'D4', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 1*hr - 20*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss6',  plateNumber: 'UFF 987G', driverPhone: '+256776789012', destinationId: 'd4', destinationName: 'Carrefour Lugogo',       slotId: 'G1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 2*hr - 50*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss7',  plateNumber: 'UGG 147H', driverPhone: '+256757890123', destinationId: 'd5', destinationName: 'Banana Boat',            slotId: 'H4', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 30*min).toISOString(),         exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss8',  plateNumber: 'UHH 258I', driverPhone: '+256788901234', destinationId: 'd6', destinationName: 'Game Store',             slotId: 'K5', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 1*hr - 10*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss9',  plateNumber: 'UII 369J', driverPhone: '+256709012345', destinationId: 'd7', destinationName: 'MTN',                    slotId: 'L5', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 4*hr).toISOString(),           exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss10', plateNumber: 'UJJ 741K', driverPhone: '+256770123456', destinationId: 'd8', destinationName: 'ABSA Lugogo Branch',     slotId: 'J2', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 55*min).toISOString(),         exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss11', plateNumber: 'UKK 852L', driverPhone: '+256751234567', destinationId: 'd8', destinationName: 'ABSA Lugogo Branch',     slotId: 'N4', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 5*hr - 30*min).toISOString(), exitTime: null, status: 'ACTIVE'  },
  { _id: 'ss12', plateNumber: 'ULL 963M', driverPhone: '+256782345678', destinationId: 'd1', destinationName: 'Airtel Service Center',  slotId: 'A3', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 6*hr).toISOString(),           exitTime: new Date(now - 4*hr).toISOString(),          status: 'CLOSED' },
  { _id: 'ss13', plateNumber: 'UMM 074N', driverPhone: '+256713456789', destinationId: 'd4', destinationName: 'Carrefour Lugogo',       slotId: 'F3', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 5*hr).toISOString(),           exitTime: new Date(now - 3*hr - 30*min).toISOString(), status: 'CLOSED' },
  { _id: 'ss14', plateNumber: 'UNN 185O', driverPhone: '+256744567890', destinationId: 'd3', destinationName: 'Good African Coffee',    slotId: 'E1', attendantId: 'u2', attendantName: 'James Okello',  entryTime: new Date(now - 7*hr).toISOString(),           exitTime: new Date(now - 5*hr - 45*min).toISOString(), status: 'CLOSED' },
  { _id: 'ss15', plateNumber: 'UOO 296P', driverPhone: '+256775678901', destinationId: 'd8', destinationName: 'ABSA Lugogo Branch',     slotId: 'K1', attendantId: 'u3', attendantName: 'Grace Achieng', entryTime: new Date(now - 8*hr).toISOString(),           exitTime: new Date(now - 6*hr - 20*min).toISOString(), status: 'CLOSED' },
];

/* ── Boot-time restore — apply saved positions to demoSlots immediately
   so every import of demoSlots already has the correct coordinates ── */
;(function restoreOnBoot() {
  try {
    const SLOT_POS_KEY = 'pms_slot_positions_v2';
    const local   = localStorage.getItem(SLOT_POS_KEY);
    const session = sessionStorage.getItem(SLOT_POS_KEY);
    const raw     = local || session;
    if (!raw) return;
    const saved = JSON.parse(raw);
    demoSlots.forEach((s) => {
      if (saved[s.slotId]) {
        s.lat = saved[s.slotId].lat;
        s.lng = saved[s.slotId].lng;
      }
    });
    /* sync back if one storage was missing */
    if (!local && session) localStorage.setItem(SLOT_POS_KEY, session);
    if (!session && local) sessionStorage.setItem(SLOT_POS_KEY, local);
  } catch {}
})();

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
  /* Only consider slots assigned to this destination */
  const available = demoSlots.filter(
    (s) => s.status === 'AVAILABLE' && (s.destinationId === destinationId)
  );
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

/* ── Slot position persistence ──
   Positions are saved to BOTH localStorage and sessionStorage.
   On load, localStorage is checked first, then sessionStorage as backup.
   Key includes a version so browser never auto-evicts it.
──────────────────────────────────────────────────────────────── */
const SLOT_POS_KEY = 'pms_slot_positions_v2';

export function saveSlotPosition(slotId, lat, lng) {
  try {
    /* update in-memory demoSlots immediately */
    const slot = demoSlots.find((s) => s.slotId === slotId);
    if (slot) { slot.lat = lat; slot.lng = lng; }

    /* persist to both storages */
    const stored = JSON.parse(localStorage.getItem(SLOT_POS_KEY) || '{}');
    stored[slotId] = { lat, lng };
    const json = JSON.stringify(stored);
    localStorage.setItem(SLOT_POS_KEY, json);
    sessionStorage.setItem(SLOT_POS_KEY, json); /* backup */
  } catch {}
}

export function loadSlotPositions() {
  try {
    /* try localStorage first, fall back to sessionStorage */
    const local   = localStorage.getItem(SLOT_POS_KEY);
    const session = sessionStorage.getItem(SLOT_POS_KEY);
    const raw     = local || session;
    if (!raw) return {};
    /* if localStorage was empty but session had data, restore localStorage */
    if (!local && session) localStorage.setItem(SLOT_POS_KEY, session);
    return JSON.parse(raw);
  } catch { return {}; }
}

export function clearSlotPositions() {
  localStorage.removeItem(SLOT_POS_KEY);
  sessionStorage.removeItem(SLOT_POS_KEY);
  /* reset in-memory positions back to seed */
}

/* Apply any saved positions on top of the seed data.
   Also mutates demoSlots in place so all code sees updated coords. */
export function applyPersistedPositions(slots) {
  const saved = loadSlotPositions();
  if (!Object.keys(saved).length) return slots;
  return slots.map((s) => {
    if (saved[s.slotId]) {
      /* mutate the shared demoSlots object so haversine uses correct coords */
      s.lat = saved[s.slotId].lat;
      s.lng = saved[s.slotId].lng;
    }
    return s;
  });
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
