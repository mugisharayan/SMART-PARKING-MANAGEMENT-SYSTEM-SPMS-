const router      = require('express').Router();
const Session     = require('../models/Session');
const BarrierLog  = require('../models/BarrierLog');

// GET /api/barrier-logs — all barrier events
router.get('/', async (req, res) => {
  try {
    /* Try dedicated BarrierLog collection first */
    const logs = await BarrierLog.find().sort({ time: -1 }).limit(500);
    if (logs.length > 0) return res.json(logs);

    /* Fallback: derive from sessions */
    const sessions = await Session.find().sort({ entryTime: -1 }).limit(500);
    const derived  = [];
    sessions.forEach((s) => {
      derived.push({ type: 'ENTRY', plate: s.plateNumber, attendant: s.attendantName || '—', slotId: s.slotId, time: s.entryTime, sessionId: s._id });
      if (s.exitTime) derived.push({ type: 'EXIT', plate: s.plateNumber, attendant: s.attendantName || '—', slotId: s.slotId, time: s.exitTime, sessionId: s._id });
    });
    derived.sort((a, b) => new Date(b.time) - new Date(a.time));
    res.json(derived);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// POST /api/barrier-logs/force — manual override log
router.post('/force', async (req, res) => {
  try {
    const { plate, note } = req.body;
    const log = await BarrierLog.create({
      type: 'EXIT', plate: plate || 'UNKNOWN',
      attendant: 'Manual Override', slotId: '—',
      time: new Date(), note: note || 'Force open',
    });
    res.status(201).json(log);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
