const mongoose = require('mongoose');

const barrierLogSchema = new mongoose.Schema({
  type:      { type: String, enum: ['ENTRY', 'EXIT'], required: true },
  plate:     { type: String, required: true },
  attendant: { type: String, default: '—' },
  slotId:    { type: String, default: '—' },
  time:      { type: Date, default: Date.now },
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', default: null },
  note:      { type: String, default: '' },
});

module.exports = mongoose.model('BarrierLog', barrierLogSchema);
