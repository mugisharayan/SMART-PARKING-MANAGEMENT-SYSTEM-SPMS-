const express    = require("express");
const http       = require("http");
const { Server } = require("socket.io");
const mongoose   = require("mongoose");
const cors       = require("cors");
require("dotenv").config();

const app    = express();
const server = http.createServer(app);

/* ── Socket.IO ── */
const io = new Server(server, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

io.on('connection', (socket) => {
  /* Emit current slot availability on connect */
  const Slot = require('./models/Slot');
  Slot.find().then((slots) => {
    const full = slots.filter((s) => s.status === 'AVAILABLE').length === 0;
    socket.emit('parking_full', { full });
  }).catch(() => {});

  socket.on('disconnect', () => {});
});

/* Make io accessible to routes */
app.set('io', io);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch((err) => console.log(err));

app.get("/", (req, res) => {
  res.send("Backend Running");
});

/* ── Routes ── */
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/slots', require('./routes/slots'));
app.use('/api/ocr',   require('./routes/ocr'));

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
