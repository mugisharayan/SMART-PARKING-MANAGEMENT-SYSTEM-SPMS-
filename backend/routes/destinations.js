const router      = require('express').Router();
const Destination = require('../models/Destination');

// GET all destinations
router.get('/', async (req, res) => {
  try {
    const destinations = await Destination.find().sort({ name: 1 });
    res.json(destinations);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET single destination
router.get('/:id', async (req, res) => {
  try {
    const dest = await Destination.findById(req.params.id);
    if (!dest) return res.status(404).json({ message: 'Destination not found' });
    res.json(dest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST create destination
router.post('/', async (req, res) => {
  try {
    const { name, anchorLat, anchorLng } = req.body;
    if (!name || anchorLat === undefined || anchorLng === undefined)
      return res.status(400).json({ message: 'name, anchorLat and anchorLng are required' });
    const dest = await Destination.create({ name, anchorLat, anchorLng });
    res.status(201).json(dest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH update destination
router.patch('/:id', async (req, res) => {
  try {
    const allowed = ['name', 'anchorLat', 'anchorLng'];
    const update  = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) update[k] = req.body[k]; });
    const dest = await Destination.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!dest) return res.status(404).json({ message: 'Destination not found' });
    res.json(dest);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE destination
router.delete('/:id', async (req, res) => {
  try {
    const dest = await Destination.findByIdAndDelete(req.params.id);
    if (!dest) return res.status(404).json({ message: 'Destination not found' });
    res.json({ message: `Destination "${dest.name}" deleted` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
