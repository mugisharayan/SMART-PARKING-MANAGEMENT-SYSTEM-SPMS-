const mongoose    = require('mongoose');
const Destination = require('./models/Destination');
const Landmark    = require('./models/Landmark');
require('dotenv').config();

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  /* ── Destinations ── */
  const existingDests = await Destination.countDocuments();
  if (existingDests === 0) {
    await Destination.insertMany([
      { name: 'Airtel Service Center',  anchorLat: 0.32690, anchorLng: 32.60607 },
      { name: 'UAE Exchange Lugogo',    anchorLat: 0.32690, anchorLng: 32.60614 },
      { name: 'Good African Coffee',    anchorLat: 0.32678, anchorLng: 32.60628 },
      { name: 'Carrefour Lugogo',       anchorLat: 0.32672, anchorLng: 32.60656 },
      { name: 'Banana Boat',            anchorLat: 0.32600, anchorLng: 32.60710 },
      { name: 'Game Store',             anchorLat: 0.32590, anchorLng: 32.60696 },
      { name: 'MTN',                    anchorLat: 0.32580, anchorLng: 32.60680 },
      { name: 'ABSA Lugogo Branch',     anchorLat: 0.32645, anchorLng: 32.60677 },
    ]);
    console.log('✅ Seeded 8 destinations');
  } else {
    console.log(`ℹ️  Destinations already exist (${existingDests})`);
  }

  /* ── Landmarks ── */
  const existingLm = await Landmark.countDocuments();
  if (existingLm === 0) {
    await Landmark.insertMany([
      { label: 'Entry Gate', type: 'ENTRY_GATE', lat: 0.32730, lng: 32.60650 },
      { label: 'Exit Gate',  type: 'EXIT_GATE',  lat: 0.32610, lng: 32.60700 },
    ]);
    console.log('✅ Seeded 2 landmarks');
  } else {
    console.log(`ℹ️  Landmarks already exist (${existingLm})`);
  }

  console.log('\n✅ Seed complete.');
  console.log('ℹ️  Slots are NOT seeded — add them via Operator → Slot Layout → click map.');
  await mongoose.disconnect();
}

seed().catch(err => { console.error(err); process.exit(1); });
