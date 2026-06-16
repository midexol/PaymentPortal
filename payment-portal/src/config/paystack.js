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
  dept_due:     { label: 'Departmental due',       amountKobo: 200000 },  // ₦2,000
  manual:       { label: 'Manuals',                 amountKobo: 500000 },  // ₦5,000
  seminar:      { label: 'Seminar',                amountKobo: 300000 },  // ₦3,000
  project:      { label: 'Project Defence',        amountKobo: 400000 },  // ₦4,000
  binding:      { label: 'Binding',                amountKobo: 150000 },  // ₦1,500
  clearance:    { label: 'Departmental Clearance', amountKobo: 100000 },  // ₦1,000
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
