const mongoose = require('mongoose');

const landmarkSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type:  { type: String, enum: ['ENTRY_GATE', 'EXIT_GATE', 'DESTINATION_POI'], required: true },
  lat:   { type: Number, required: true },
  lng:   { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Landmark', landmarkSchema);
