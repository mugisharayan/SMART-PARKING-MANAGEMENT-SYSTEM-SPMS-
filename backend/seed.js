const mongoose = require('mongoose');
require('dotenv').config();
const Slot = require('./models/Slot');

const slots = [
  // Zone A — Carrefour (6 slots)
  { slotId: 'A1', label: 'A1', lat: 0.32850, lng: 32.60390, status: 'AVAILABLE', destinationId: 'd1' },
  { slotId: 'A2', label: 'A2', lat: 0.32848, lng: 32.60400, status: 'AVAILABLE', destinationId: 'd1' },
  { slotId: 'A3', label: 'A3', lat: 0.32846, lng: 32.60410, status: 'AVAILABLE', destinationId: 'd1' },
  { slotId: 'A4', label: 'A4', lat: 0.32844, lng: 32.60420, status: 'AVAILABLE', destinationId: 'd1' },
  { slotId: 'A5', label: 'A5', lat: 0.32842, lng: 32.60430, status: 'OUT_OF_SERVICE', destinationId: 'd1' },
  { slotId: 'A6', label: 'A6', lat: 0.32840, lng: 32.60440, status: 'AVAILABLE', destinationId: 'd1' },

  // Zone B — Food Court (6 slots)
  { slotId: 'B1', label: 'B1', lat: 0.32820, lng: 32.60360, status: 'AVAILABLE', destinationId: 'd2' },
  { slotId: 'B2', label: 'B2', lat: 0.32818, lng: 32.60370, status: 'AVAILABLE', destinationId: 'd2' },
  { slotId: 'B3', label: 'B3', lat: 0.32816, lng: 32.60380, status: 'AVAILABLE', destinationId: 'd2' },
  { slotId: 'B4', label: 'B4', lat: 0.32814, lng: 32.60390, status: 'AVAILABLE', destinationId: 'd2' },
  { slotId: 'B5', label: 'B5', lat: 0.32812, lng: 32.60400, status: 'AVAILABLE', destinationId: 'd2' },
  { slotId: 'B6', label: 'B6', lat: 0.32810, lng: 32.60410, status: 'AVAILABLE', destinationId: 'd2' },

  // Zone C — MTN / Gym (6 slots)
  { slotId: 'C1', label: 'C1', lat: 0.32795, lng: 32.60330, status: 'AVAILABLE', destinationId: 'd3' },
  { slotId: 'C2', label: 'C2', lat: 0.32793, lng: 32.60340, status: 'AVAILABLE', destinationId: 'd3' },
  { slotId: 'C3', label: 'C3', lat: 0.32791, lng: 32.60350, status: 'AVAILABLE', destinationId: 'd3' },
  { slotId: 'C4', label: 'C4', lat: 0.32789, lng: 32.60360, status: 'OUT_OF_SERVICE', destinationId: 'd3' },
  { slotId: 'C5', label: 'C5', lat: 0.32787, lng: 32.60370, status: 'AVAILABLE', destinationId: 'd3' },
  { slotId: 'C6', label: 'C6', lat: 0.32785, lng: 32.60380, status: 'AVAILABLE', destinationId: 'd3' },

  // Zone D — Cinema (6 slots)
  { slotId: 'D1', label: 'D1', lat: 0.32770, lng: 32.60420, status: 'AVAILABLE', destinationId: 'd4' },
  { slotId: 'D2', label: 'D2', lat: 0.32768, lng: 32.60430, status: 'AVAILABLE', destinationId: 'd4' },
  { slotId: 'D3', label: 'D3', lat: 0.32766, lng: 32.60440, status: 'AVAILABLE', destinationId: 'd4' },
  { slotId: 'D4', label: 'D4', lat: 0.32764, lng: 32.60450, status: 'AVAILABLE', destinationId: 'd4' },
  { slotId: 'D5', label: 'D5', lat: 0.32762, lng: 32.60460, status: 'AVAILABLE', destinationId: 'd4' },
  { slotId: 'D6', label: 'D6', lat: 0.32760, lng: 32.60470, status: 'AVAILABLE', destinationId: 'd4' },

  // Zone E — Bank / ATMs (6 slots)
  { slotId: 'E1', label: 'E1', lat: 0.32835, lng: 32.60450, status: 'AVAILABLE', destinationId: 'd5' },
  { slotId: 'E2', label: 'E2', lat: 0.32833, lng: 32.60460, status: 'AVAILABLE', destinationId: 'd5' },
  { slotId: 'E3', label: 'E3', lat: 0.32831, lng: 32.60470, status: 'AVAILABLE', destinationId: 'd5' },
  { slotId: 'E4', label: 'E4', lat: 0.32829, lng: 32.60480, status: 'AVAILABLE', destinationId: 'd5' },
  { slotId: 'E5', label: 'E5', lat: 0.32827, lng: 32.60490, status: 'AVAILABLE', destinationId: 'd5' },
  { slotId: 'E6', label: 'E6', lat: 0.32825, lng: 32.60500, status: 'OUT_OF_SERVICE', destinationId: 'd5' },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await Slot.countDocuments();
  if (existing > 0) {
    console.log(`Slots already seeded (${existing} found). Skipping.`);
    process.exit(0);
  }

  await Slot.insertMany(slots);
  console.log(`✅ Seeded ${slots.length} slots successfully.`);
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
