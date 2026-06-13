const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const adminAuth = require('../middleware/adminAuth');
const {
  login,
  register,
  getSetupStatus,
  getDashboard,
  listPayments,
  exportPDF,
  getPaymentDetail,
  sendDigest,
} = require('../controllers/adminController');

// Rate limiter for login
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts. Try again in 15 minutes.' },
});

// Public
router.post('/login', loginLimiter, login);
router.post('/register', register); // Guarded by count / token in controller
router.get('/setup-status', getSetupStatus);

// Protected (all routes below require valid JWT)
router.use(adminAuth);

router.get('/dashboard', getDashboard);
router.get('/payments', listPayments);
router.get('/payments/export-pdf', exportPDF);         // Must be before /:id
router.get('/payments/:id', getPaymentDetail);
router.post('/digest', sendDigest);

module.exports = router;
