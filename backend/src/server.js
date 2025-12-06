require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const connectDB = require('./config/db');
const registerSocket = require('./socket');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const messageRoutes = require('./routes/messageRoutes');
const groupRoutes = require('./routes/groupRoutes');
const reportRoutes = require('./routes/reportRoutes');

// >>> tambahkan ini <<<
const allowedOrigins = (process.env.CLIENT_ORIGINS || 'http://192.168.1.3:5173')
  .split(',')
  .map((o) => o.trim());

const app = express();
const server = http.createServer(app);

const io = require('socket.io')(server, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

registerSocket(io);

// middleware global
app.use(
  cors({
    origin(origin, callback) {
      // untuk request tanpa origin (misal Postman) → izinkan saja
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('Not allowed by CORS'));
    },
    credentials: true
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(morgan('dev'));

// route
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes); // <== tambahkan ini
app.use('/api/reports', reportRoutes);

app.get('/', (req, res) => {
  res.send('H!BRUH API is running');
});

// start
const PORT = process.env.PORT || 5000;

server.listen(PORT, async () => {
  await connectDB();
  console.log(`Server running on port ${PORT}`);
});
