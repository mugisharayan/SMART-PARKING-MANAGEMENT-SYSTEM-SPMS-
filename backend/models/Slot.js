const mongoose = require('mongoose');

const slotSchema = new mongoose.Schema({
  slotId:        { type: String, required: true, unique: true }, // e.g. "A1"
  label:         { type: String, required: true },
  lat:           { type: Number, required: true },
  lng:           { type: Number, required: true },
  status:        { type: String, enum: ['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'], default: 'AVAILABLE' },
  destinationId: { type: String, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Slot', slotSchema);
