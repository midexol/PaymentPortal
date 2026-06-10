require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');

const paymentRoutes = require('./src/routes/payment');
const webhookRoutes = require('./src/routes/webhook');
const adminRoutes = require('./src/routes/admin');

const app = express();

// ─── Security headers ─────────────────────────────────────────────────────────
// app.use(helmet());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
// Webhook route MUST receive raw body for HMAC signature verification.
// Register it BEFORE express.json() so the middleware doesn't interfere.
app.use(
  '/api/paystack/webhook',
  express.raw({ type: 'application/json' }),
  webhookRoutes
);

// All other routes use parsed JSON
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Support React client-side routing fallback in production
app.get('*any', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 404 fallback
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found.' }));

// Global error handler
app.use((err, req, res, _next) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
});

// ─── Database + Server ────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => {
    console.log('✅ MongoDB connected');
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err.message);
  });

app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));

module.exports = app;
