const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    matricNumber: { type: String, required: true, uppercase: true },
    email: { type: String, required: true },
    code: { type: String, required: true },
    createdAt: { type: Date, default: Date.now, expires: 600 } // TTL index: auto-expires after 10 minutes
  }
);

module.exports = mongoose.model('Otp', otpSchema);
