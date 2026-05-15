const router = require('express').Router();

/**
 * POST /api/auth/login
 * Simple credential check — extend with real DB users as needed.
 * For now supports the demo accounts used by the frontend.
 */
const USERS = [
  { id: 'u1', name: 'Admin Operator',  email: 'admin@lugogo.ug',    password: 'admin123',    role: 'operator'  },
  { id: 'u2', name: 'James Okello',    email: 'james@lugogo.ug',    password: 'attendant123', role: 'attendant' },
  { id: 'u3', name: 'Grace Achieng',   email: 'grace@lugogo.ug',    password: 'attendant123', role: 'attendant' },
];

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ message: 'Email and password are required.' });

  const user = USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user)
    return res.status(401).json({ message: 'Invalid email or password.' });

  /* Simple token — in production replace with JWT */
  const token = `token-${user.id}-${Date.now()}`;
  const { password: _pw, ...safeUser } = user;

  return res.json({ token, user: safeUser });
});

router.post('/logout', (req, res) => {
  /* Stateless — just acknowledge */
  return res.json({ message: 'Logged out.' });
});

module.exports = router;
