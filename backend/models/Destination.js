const mongoose = require('mongoose');

const destinationSchema = new mongoose.Schema({
  name:       { type: String, required: true },
  anchorLat:  { type: Number, required: true },
  anchorLng:  { type: Number, required: true },
}, { timestamps: true });

module.exports = mongoose.model('Destination', destinationSchema);
