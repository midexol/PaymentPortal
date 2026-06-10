const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    // Student info
    studentName: { type: String, required: true, trim: true },
    matricNumber: { type: String, required: true, trim: true, uppercase: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    department: { type: String, trim: true },
    level: { type: String, trim: true },

    // Payment details
    paymentType: {
      type: String,
      required: true,
      enum: ['fees', 'hostel', 'exam', 'library', 'sport', 'other'],
    },
    paymentLabel: { type: String, required: true },
    session: { type: String, required: true },

    // Amounts (stored in kobo — smallest Naira unit)
    amountKobo: { type: Number, required: true },
    chargeKobo: { type: Number, required: true },
    totalKobo: { type: Number, required: true },

    // Paystack
    reference: { type: String, required: true, unique: true },
    authorizationUrl: { type: String },
    accessCode: { type: String },
    channel: { type: String }, // card, bank, ussd, etc.
    paidAt: { type: Date },

    // Status
    status: {
      type: String,
      enum: ['pending', 'success', 'failed', 'abandoned'],
      default: 'pending',
    },

    // Raw Paystack webhook/verify payload for audit
    paystackData: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

// Virtual: amount in Naira
paymentSchema.virtual('amountNaira').get(function () {
  return this.amountKobo / 100;
});
paymentSchema.virtual('totalNaira').get(function () {
  return this.totalKobo / 100;
});

paymentSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Payment', paymentSchema);
