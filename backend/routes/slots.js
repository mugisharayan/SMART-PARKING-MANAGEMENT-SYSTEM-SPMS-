const router  = require('express').Router();
const Slot     = require('../models/Slot');

/* ── Haversine distance in metres ── */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (x) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// GET nearest available slot for a destination
// GET /api/slots/nearest?destinationId=xxx
router.get('/nearest', async (req, res) => {
  try {
    const { destinationId } = req.query;
    if (!destinationId) return res.status(400).json({ message: 'destinationId is required' });

    const Destination = require('../models/Destination');
    const dest = await Destination.findById(destinationId);
    if (!dest) return res.status(404).json({ message: 'Destination not found' });

    const available = await Slot.find({ status: 'AVAILABLE', destinationId: destinationId.toString() });
    if (!available.length) return res.status(404).json({ message: 'No available slots for this destination' });

    const nearest = available
      .map((s) => ({ slot: s, dist: haversine(dest.anchorLat, dest.anchorLng, s.lat, s.lng) }))
      .sort((a, b) => a.dist - b.dist || a.slot.slotId.localeCompare(b.slot.slotId))[0].slot;

    res.json(nearest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET all slots
router.get('/', async (req, res) => {
  try {
    const slots = await Slot.find().sort({ slotId: 1 });
    // Normalize destinationId to string so frontend comparisons work reliably
    const normalized = slots.map((s) => ({
      ...s.toObject(),
      destinationId: s.destinationId ? s.destinationId.toString() : null,
    }));
    res.json(normalized);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single slot
router.get('/:slotId', async (req, res) => {
  try {
    const slot = await Slot.findOne({ slotId: req.params.slotId });
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create new slot
router.post('/', async (req, res) => {
  try {
    const { slotId, label, lat, lng, destinationId, status } = req.body;
    if (!slotId || !lat || !lng) return res.status(400).json({ message: 'slotId, lat and lng are required' });
    const existing = await Slot.findOne({ slotId });
    if (existing) return res.status(409).json({ message: `Slot ${slotId} already exists` });
    const slot = await Slot.create({
      slotId,
      label: label || slotId,
      lat,
      lng,
      destinationId: destinationId ? destinationId.toString() : null,
      status: status || 'AVAILABLE',
    });
    res.status(201).json({ ...slot.toObject(), destinationId: slot.destinationId ? slot.destinationId.toString() : null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH general update (status, lat, lng, label, destinationId)
router.patch('/:slotId', async (req, res) => {
  try {
    const allowed = ['status', 'lat', 'lng', 'label', 'destinationId'];
    const update  = {};
    allowed.forEach((key) => { if (req.body[key] !== undefined) update[key] = req.body[key]; });

    if (update.status && !['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'].includes(update.status))
      return res.status(400).json({ message: 'Invalid status value' });

    const slot = await Slot.findOneAndUpdate(
      { slotId: req.params.slotId },
      update,
      { new: true }
    );
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update slot status only
router.patch('/:slotId/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['AVAILABLE', 'OCCUPIED', 'OUT_OF_SERVICE'].includes(status))
      return res.status(400).json({ message: 'Invalid status value' });
    const slot = await Slot.findOneAndUpdate(
      { slotId: req.params.slotId },
      { status },
      { new: true }
    );
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update slot GPS position only
router.patch('/:slotId/position', async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (lat === undefined || lng === undefined)
      return res.status(400).json({ message: 'lat and lng are required' });
    const slot = await Slot.findOneAndUpdate(
      { slotId: req.params.slotId },
      { lat, lng },
      { new: true }
    );
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE slot
router.delete('/:slotId', async (req, res) => {
  try {
    const slot = await Slot.findOneAndDelete({ slotId: req.params.slotId });
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    res.json({ message: `Slot ${req.params.slotId} deleted` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
