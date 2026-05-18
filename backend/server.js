const express    = require('express');
const http       = require('http');
const { Server } = require('socket.io');
const mongoose   = require('mongoose');
const cors       = require('cors');
require('dotenv').config();

const app    = express();
const server = http.createServer(app);

/* ── Socket.IO ── */
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST', 'PATCH', 'DELETE'] },
});

io.on('connection', async (socket) => {
  socket.join('parking');
  try {
    const Slot = require('./models/Slot');
    const slots = await Slot.find();
    const full  = slots.filter((s) => s.status === 'AVAILABLE').length === 0;
    socket.emit('parking_full', { full });
  } catch {}
});

app.set('io', io);

const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // allow requests with no origin (mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    callback(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));

/* ── MongoDB ── */
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB Connected'))
  .catch((err) => console.log(err));

app.get('/', (req, res) => res.send('Lugogo PMS Backend Running'));

/* ── Routes ── */
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/slots',         require('./routes/slots'));
app.use('/api/sessions',      require('./routes/sessions'));
app.use('/api/destinations',  require('./routes/destinations'));
app.use('/api/landmarks',     require('./routes/landmarks'));
app.use('/api/barrier-logs',  require('./routes/barrierLogs'));
app.use('/api/notifications',  require('./routes/notifications'));
app.use('/api/dashboard',     require('./routes/dashboard'));
app.use('/api/ocr',           require('./routes/ocr'));
app.use('/api/admin',         require('./routes/admin'));

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
