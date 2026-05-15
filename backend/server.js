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

app.use(cors());
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
