const router  = require('express').Router();
const Slot    = require('../models/Slot');
const Session = require('../models/Session');

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const [slots, todaySessions] = await Promise.all([
      Slot.find(),
      Session.find({
        entryTime: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    const total     = slots.length;
    const occupied  = slots.filter((s) => s.status === 'OCCUPIED').length;
    const available = slots.filter((s) => s.status === 'AVAILABLE').length;
    const oos       = slots.filter((s) => s.status === 'OUT_OF_SERVICE').length;

    res.json({
      total,
      occupied,
      available,
      oos,
      totalToday: todaySessions.length,
      occupancyRate: total > 0 ? Math.round((occupied / (total - oos)) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
