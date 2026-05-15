const router   = require('express').Router();
const Landmark = require('../models/Landmark');

// GET all landmarks
router.get('/', async (req, res) => {
  try {
    const landmarks = await Landmark.find();
    res.json(landmarks);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST create landmark
router.post('/', async (req, res) => {
  try {
    const { label, type, lat, lng } = req.body;
    if (!label || !type || lat === undefined || lng === undefined)
      return res.status(400).json({ message: 'label, type, lat and lng are required' });
    const lm = await Landmark.create({ label, type, lat, lng });
    res.status(201).json(lm);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// PATCH update landmark
router.patch('/:id', async (req, res) => {
  try {
    const lm = await Landmark.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!lm) return res.status(404).json({ message: 'Landmark not found' });
    res.json(lm);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// DELETE landmark
router.delete('/:id', async (req, res) => {
  try {
    const lm = await Landmark.findByIdAndDelete(req.params.id);
    if (!lm) return res.status(404).json({ message: 'Landmark not found' });
    res.json({ message: 'Landmark deleted' });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
