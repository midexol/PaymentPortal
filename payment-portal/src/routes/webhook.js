const express = require('express');
const router = express.Router();
const { handleWebhook } = require('../controllers/paymentController');

// Paystack sends raw JSON — must NOT use express.json() middleware on this route.
// Raw body parsing is configured in app.js specifically for this path.
router.post('/webhook', handleWebhook);

module.exports = router;
