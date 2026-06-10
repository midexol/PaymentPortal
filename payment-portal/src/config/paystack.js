const axios = require('axios');

const PAYSTACK_BASE = 'https://api.paystack.co';

const paystackClient = axios.create({
  baseURL: PAYSTACK_BASE,
  headers: {
    Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
    'Content-Type': 'application/json',
  },
});

// Fixed amounts per payment type (in kobo)
const PAYMENT_AMOUNTS = {
  fees:    { label: 'School fees',   amountKobo: 15000000 }, // ₦150,000
  hostel:  { label: 'Hostel fee',    amountKobo:  4500000 }, // ₦45,000
  exam:    { label: 'Exam fees',     amountKobo:   500000 }, // ₦5,000
  library: { label: 'Library dues',  amountKobo:   300000 }, // ₦3,000
  sport:   { label: 'Sport levy',    amountKobo:   250000 }, // ₦2,500
  other:   { label: 'Others',        amountKobo:  1000000 }, // ₦10,000
};

/**
 * Compute Paystack charge: 1.5% + ₦100 if amount > ₦2,500, capped at ₦2,000.
 * Ref: https://paystack.com/docs/payments/fees
 */
function computeCharge(amountKobo) {
  const FLAT_FEE_THRESHOLD = 250000; // ₦2,500 in kobo
  const FLAT_FEE = 10000;            // ₦100 in kobo
  const CAP = 200000;                // ₦2,000 in kobo
  const RATE = 0.015;

  let charge = Math.round(amountKobo * RATE);
  if (amountKobo > FLAT_FEE_THRESHOLD) charge += FLAT_FEE;
  if (charge > CAP) charge = CAP;
  return charge;
}

/**
 * Generate a unique reference: PP-<TYPE>-<TIMESTAMP>-<RANDOM>
 */
function generateReference(paymentType) {
  const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
  return `PP-${paymentType.toUpperCase()}-${Date.now()}-${rand}`;
}

module.exports = { paystackClient, PAYMENT_AMOUNTS, computeCharge, generateReference };
