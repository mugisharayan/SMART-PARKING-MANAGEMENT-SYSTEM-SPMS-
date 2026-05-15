const router      = require('express').Router();
const Session     = require('../models/Session');
const Slot        = require('../models/Slot');
const Destination = require('../models/Destination');

/* ── GET /api/sessions ── */
router.get('/', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const t = req.query.search;
      filter.$or = [
        { plateNumber:  { $regex: t, $options: 'i' } },
        { driverPhone:  { $regex: t, $options: 'i' } },
        { destinationName: { $regex: t, $options: 'i' } },
        { slotId:       { $regex: t, $options: 'i' } },
      ];
    }
    if (req.query.attendant && req.query.attendant !== 'ALL')
      filter.attendantName = req.query.attendant;

    const limit = parseInt(req.query.limit) || 500;
    const sessions = await Session.find(filter).sort({ entryTime: -1 }).limit(limit);
    res.json(sessions);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── GET /api/sessions/active?plate=X ── */
router.get('/active', async (req, res) => {
  try {
    const { plate } = req.query;
    if (!plate) return res.status(400).json({ message: 'plate query param is required' });
    const norm    = plate.toUpperCase().replace(/\s+/g, ' ').trim();
    const session = await Session.findOne({ plateNumber: norm, status: 'ACTIVE' });
    if (!session) return res.status(404).json({ message: 'No active session found' });
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── POST /api/sessions ── */
router.post('/', async (req, res) => {
  try {
    const { plateNumber, driverPhone, destinationId, slotId } = req.body;
    if (!plateNumber || !driverPhone || !destinationId || !slotId)
      return res.status(400).json({ message: 'plateNumber, driverPhone, destinationId and slotId are required' });

    const dest = await Destination.findById(destinationId);
    if (!dest) return res.status(404).json({ message: 'Destination not found' });

    const slot = await Slot.findOne({ slotId });
    if (!slot)                       return res.status(404).json({ message: `Slot ${slotId} not found` });
    if (slot.status !== 'AVAILABLE') return res.status(409).json({ message: `Slot ${slotId} is not available` });

    const authHeader = req.headers.authorization || '';
    const token      = authHeader.replace('Bearer ', '');
    const { attendantId, attendantName } = resolveAttendant(token);
    const norm = plateNumber.toUpperCase().replace(/\s+/g, ' ').trim();

    const session = await Session.create({
      plateNumber: norm, driverPhone: driverPhone.trim(),
      destinationId: dest._id, destinationName: dest.name,
      slotId, attendantId, attendantName,
    });

    await Slot.findOneAndUpdate({ slotId }, { status: 'OCCUPIED' });

    const io = req.app.get('io');
    if (io) {
      io.emit('session_created', { session });
      io.emit('slot_updated', { slotId, status: 'OCCUPIED' });
      const avail = await Slot.countDocuments({ status: 'AVAILABLE' });
      io.emit('parking_full', { full: avail === 0 });
      io.emit('stats_updated', {});
    }
    res.status(201).json({ session });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

/* ── PATCH /api/sessions/:id/exit ── */
router.patch('/:id/exit', async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session)                    return res.status(404).json({ message: 'Session not found' });
    if (session.status !== 'ACTIVE') return res.status(409).json({ message: 'Session already closed' });

    session.exitTime = new Date();
    session.status   = 'CLOSED';
    await session.save();
    await Slot.findOneAndUpdate({ slotId: session.slotId }, { status: 'AVAILABLE' });

    const io = req.app.get('io');
    if (io) {
      io.emit('session_closed', { sessionId: session._id, slotId: session.slotId });
      io.emit('slot_updated', { slotId: session.slotId, status: 'AVAILABLE' });
      const avail = await Slot.countDocuments({ status: 'AVAILABLE' });
      io.emit('parking_full', { full: avail === 0 });
      io.emit('stats_updated', {});
    }
    res.json(session);
  } catch (err) { res.status(500).json({ message: err.message }); }
});

function resolveAttendant(token) {
  const USERS = [
    { id: 'u1', name: 'Sarah Nakato'    },
    { id: 'u2', name: 'James Okello'    },
    { id: 'u3', name: 'Grace Achieng'   },
    { id: 'u4', name: 'David Ssemakula' },
  ];
  const match = token.match(/token-(u\d+)-/);
  if (match) {
    const user = USERS.find((u) => u.id === match[1]);
    if (user) return { attendantId: user.id, attendantName: user.name };
  }
  return { attendantId: 'unknown', attendantName: 'Attendant' };
}

module.exports = router;