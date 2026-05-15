const mongoose    = require('mongoose');
require('dotenv').config();
const Destination = require('./models/Destination');

const destinations = [
  { name: 'Airtel Service Center', anchorLat: 0.32690, anchorLng: 32.60607 },
  { name: 'UAE Exchange Lugogo',   anchorLat: 0.32690, anchorLng: 32.60614 },
  { name: 'Good African Coffee',   anchorLat: 0.32678, anchorLng: 32.60628 },
  { name: 'Carrefour Lugogo',      anchorLat: 0.32672, anchorLng: 32.60656 },
  { name: 'Banana Boat',           anchorLat: 0.32600, anchorLng: 32.60710 },
  { name: 'Game Store',            anchorLat: 0.32590, anchorLng: 32.60696 },
  { name: 'MTN',                   anchorLat: 0.32580, anchorLng: 32.60680 },
  { name: 'ABSA Lugogo Branch',    anchorLat: 0.32645, anchorLng: 32.60677 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const existing = await Destination.countDocuments();
  if (existing > 0) {
    console.log(`Destinations already seeded (${existing} found). Skipping.`);
    process.exit(0);
  }

  const created = await Destination.insertMany(destinations);
  console.log(`✅ Seeded ${created.length} destinations.`);
  created.forEach((d) => console.log(`  ${d.name} → ${d._id}`));
  process.exit(0);
}

seed().catch((err) => { console.error(err); process.exit(1); });
