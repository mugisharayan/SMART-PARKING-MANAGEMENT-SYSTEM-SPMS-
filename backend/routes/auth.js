const router = require('express').Router();

/* Users — matches the demo credentials in Login.jsx exactly */
const USERS = [
  { id: 'u1', username: 'admin',      password: 'Admin@1234',  role: 'OPERATOR',  name: 'Sarah Nakato'    },
  { id: 'u2', username: 'attendant1', password: 'Attend@123',  role: 'ATTENDANT', name: 'James Okello'    },
  { id: 'u3', username: 'attendant2', password: 'Attend@123',  role: 'ATTENDANT', name: 'Grace Achieng'   },
  { id: 'u4', username: 'operator2',  password: 'Oper@1234',   role: 'OPERATOR',  name: 'David Ssemakula' },
];

/* POST /api/auth/login */
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: 'Username and password are required.' });

  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );

  if (!user)
    return res.status(401).json({ message: 'Invalid username or password.' });

  const token = `token-${user.id}-${Date.now()}`;
  const { password: _pw, ...safeUser } = user;

  return res.json({ token, user: safeUser });
});

/* POST /api/auth/logout */
router.post('/logout', (req, res) => {
  return res.json({ message: 'Logged out.' });
});

/* POST /api/auth/forgot-password */
router.post('/forgot-password', (req, res) => {
  /* Stub — in production send a real reset email */
  return res.json({ message: 'If that username exists, a reset link has been sent.' });
});

module.exports = router;
