const router  = require('express').Router();
const Slot     = require('../models/Slot');

// GET all slots
router.get('/', async (req, res) => {
  try {
    const slots = await Slot.find().sort({ slotId: 1 });
    res.json(slots);
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
      destinationId: destinationId || null,
      status: status || 'AVAILABLE',
    });
    res.status(201).json(slot);
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
