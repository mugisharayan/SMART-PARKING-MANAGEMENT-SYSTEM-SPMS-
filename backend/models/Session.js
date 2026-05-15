const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  plateNumber:     { type: String, required: true },
  driverPhone:     { type: String, required: true },
  destinationId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Destination', required: true },
  destinationName: { type: String, required: true },
  slotId:          { type: String, required: true },
  attendantId:     { type: String, required: true },
  attendantName:   { type: String, required: true },
  entryTime:       { type: Date, default: Date.now },
  exitTime:        { type: Date, default: null },
  status:          { type: String, enum: ['ACTIVE', 'CLOSED'], default: 'ACTIVE' },
}, { timestamps: true });

/* Index for fast plate lookups */
sessionSchema.index({ plateNumber: 1, status: 1 });
sessionSchema.index({ entryTime: -1 });

module.exports = mongoose.model('Session', sessionSchema);
