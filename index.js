require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const socketio = require('socket.io');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const messageRoutes = require('./routes/messages');
const Message = require('./models/Message');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = socketio(server, {
  cors: { origin: '*' }
});

app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

// Middleware to verify JWT
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'No token' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

app.use('/auth', authRoutes);
app.use('/users', verifyToken, userRoutes);
app.use('/conversations', verifyToken, messageRoutes);

// Socket.IO
const onlineUsers = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.user.id}`);
  onlineUsers.set(socket.user.id, socket.id);
  io.emit('user:status', { userId: socket.user.id, online: true });

  socket.on('disconnect', () => {
    onlineUsers.delete(socket.user.id);
    io.emit('user:status', { userId: socket.user.id, online: false });
  });

  socket.on('message:send', async ({ to, text }) => {
    const from = socket.user.id;
    const message = new Message({ from, to, text, status: 'sent' });
    await message.save();
    const recipientSocket = onlineUsers.get(to);
    if (recipientSocket) {
      io.to(recipientSocket).emit('message:new', message);
    }
    socket.emit('message:new', message); // Echo back to sender
  });

  socket.on('typing:start', ({ to }) => {
    const recipientSocket = onlineUsers.get(to);
    if (recipientSocket) io.to(recipientSocket).emit('typing:start', { from: socket.user.id });
  });

  socket.on('typing:stop', ({ to }) => {
    const recipientSocket = onlineUsers.get(to);
    if (recipientSocket) io.to(recipientSocket).emit('typing:stop', { from: socket.user.id });
  });

  socket.on('message:read', async ({ messageId }) => {
    const message = await Message.findById(messageId);
    if (message && message.to === socket.user.id && message.status !== 'read') {
      message.status = 'read';
      await message.save();
      const senderSocket = onlineUsers.get(message.from);
      if (senderSocket) io.to(senderSocket).emit('message:read', { messageId });
    }
  });
});

server.listen(process.env.PORT || 5000, () => console.log('Server running'));
