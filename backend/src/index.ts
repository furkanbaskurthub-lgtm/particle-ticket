import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';

import authRoutes from './routes/auth';
import ticketRoutes from './routes/ticket';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/qrokuyucu';

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tickets', ticketRoutes);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

// MongoDB bağlantısı
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB bağlantısı kuruldu:', MONGODB_URI);
    app.listen(PORT, () => {
      console.log(`🚀 Backend çalışıyor: http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ MongoDB bağlantı hatası:', err);
    process.exit(1);
  });
