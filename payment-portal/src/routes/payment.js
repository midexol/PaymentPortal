const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const {
  initializePayment,
  verifyPayment,
  getPaymentHistory,
  getReceipt,
} = require('../controllers/paymentController');

// Rate limiter: max 10 payment initializations per IP per 15 min
const initLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many requests. Please wait and try again.' },
});

// POST /api/pay/initialize
router.post('/initialize', initLimiter, initializePayment);

// GET /api/pay/verify/:reference
router.get('/verify/:reference', verifyPayment);

// GET /api/pay/history/:matricNumber
router.get('/history/:matricNumber', getPaymentHistory);

// GET /api/pay/receipt/:reference
router.get('/receipt/:reference', getReceipt);

module.exports = router;
