const router  = require('express').Router();
const Session = require('../models/Session');

// POST /api/notifications/send
router.post('/send', async (req, res) => {
  try {
    const { sessionId, channel } = req.body;
    if (!sessionId || !channel)
      return res.status(400).json({ message: 'sessionId and channel are required' });

    const session = await Session.findById(sessionId);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const message = `Your parking slot at Lugogo Mall is: ${session.slotId}\nDestination: ${session.destinationName}\nHave a great visit!`;

    /* ── Production: wire Twilio (WhatsApp) or Africa's Talking (SMS) here ── */
    /* For now: log and return success so the frontend works end-to-end */
    console.log(`[NOTIFY] ${channel} → ${session.driverPhone}: ${message}`);

    res.json({
      success: true,
      channel,
      phone:   session.driverPhone,
      message,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
