const router      = require('express').Router();
const Slot        = require('../models/Slot');
const Session     = require('../models/Session');
const Destination = require('../models/Destination');

/**
 * DELETE /api/admin/slots
 * Wipes ALL slots from the database so you can start fresh.
 */
router.delete('/slots', async (req, res) => {
  try {
    const result = await Slot.deleteMany({});
    res.json({ message: `Deleted ${result.deletedCount} slots. Database is now empty.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/admin/destinations
 * Wipes ALL destinations from the database.
 */
router.delete('/destinations', async (req, res) => {
  try {
    const result = await Destination.deleteMany({});
    res.json({ message: `Deleted ${result.deletedCount} destinations.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/admin/sessions
 * Wipes ALL sessions from the database.
 */
router.delete('/sessions', async (req, res) => {
  try {
    const result = await Session.deleteMany({});
    res.json({ message: `Deleted ${result.deletedCount} sessions.` });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * DELETE /api/admin/all
 * Wipes everything — slots, sessions, destinations.
 */
router.delete('/all', async (req, res) => {
  try {
    const [s, se, d] = await Promise.all([
      Slot.deleteMany({}),
      Session.deleteMany({}),
      Destination.deleteMany({}),
    ]);
    res.json({
      message: `Database cleared. Deleted: ${s.deletedCount} slots, ${se.deletedCount} sessions, ${d.deletedCount} destinations.`,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
