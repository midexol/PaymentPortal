const Payment = require('../models/Payment');
const {
  paystackClient,
  PAYMENT_AMOUNTS,
  computeCharge,
  generateReference,
} = require('../config/paystack');
const { sendReceiptEmail } = require('../config/mailer');
const crypto = require('crypto');

// ─── POST /api/pay/initialize ─────────────────────────────────────────────────
exports.initializePayment = async (req, res) => {
  try {
    const { studentName, matricNumber, email, phone, department, level, paymentType, session } =
      req.body;

    // Validate required fields
    if (!studentName || !matricNumber || !email || !paymentType || !session) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    const config = PAYMENT_AMOUNTS[paymentType];
    if (!config) {
      return res.status(400).json({ success: false, message: 'Invalid payment type.' });
    }

    const amountKobo = config.amountKobo;
    const chargeKobo = computeCharge(amountKobo);
    const totalKobo = amountKobo + chargeKobo;
    const reference = generateReference(paymentType);

    // Call Paystack initialize endpoint
    const { data } = await paystackClient.post('/transaction/initialize', {
      email,
      amount: totalKobo,
      reference,
      currency: 'NGN',
      callback_url: `${process.env.FRONTEND_URL}/payment/verify?reference=${reference}`,
      metadata: {
        studentName,
        matricNumber,
        department,
        level,
        paymentType,
        paymentLabel: config.label,
        session,
        custom_fields: [
          { display_name: 'Matric Number', variable_name: 'matric_number', value: matricNumber },
          { display_name: 'Department', variable_name: 'department', value: department || 'N/A' },
          { display_name: 'Payment For', variable_name: 'payment_for', value: config.label },
          { display_name: 'Session', variable_name: 'session', value: session },
        ],
      },
    });

    if (!data.status) {
      return res.status(502).json({ success: false, message: 'Paystack initialization failed.' });
    }

    // Persist pending record
    const payment = await Payment.create({
      studentName,
      matricNumber,
      email,
      phone,
      department,
      level,
      paymentType,
      paymentLabel: config.label,
      session,
      amountKobo,
      chargeKobo,
      totalKobo,
      reference,
      authorizationUrl: data.data.authorization_url,
      accessCode: data.data.access_code,
      status: 'pending',
    });

    return res.status(201).json({
      success: true,
      message: 'Payment initialized.',
      data: {
        authorizationUrl: data.data.authorization_url,
        accessCode: data.data.access_code,
        reference,
        paymentId: payment._id,
        amountNaira: amountKobo / 100,
        chargeNaira: chargeKobo / 100,
        totalNaira: totalKobo / 100,
      },
    });
  } catch (err) {
    console.error('[initializePayment]', err.message);
    return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  }
};

// ─── GET /api/pay/verify/:reference ──────────────────────────────────────────
exports.verifyPayment = async (req, res) => {
  try {
    const { reference } = req.params;
    if (!reference) return res.status(400).json({ success: false, message: 'Reference required.' });

    const payment = await Payment.findOne({ reference });
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });

    // If already verified, return cached result
    if (payment.status === 'success') {
      return res.json({ success: true, message: 'Payment already verified.', data: payment });
    }

    // Verify with Paystack
    const { data } = await paystackClient.get(`/transaction/verify/${reference}`);

    if (!data.status) {
      return res.status(502).json({ success: false, message: 'Paystack verification failed.' });
    }

    const tx = data.data;
    const isSuccess = tx.status === 'success';

    const wasAlreadySuccess = payment.status === 'success';
    payment.status = isSuccess ? 'success' : tx.status;
    payment.channel = tx.channel;
    payment.paidAt = isSuccess ? new Date(tx.paid_at) : null;
    payment.paystackData = tx;
    await payment.save();

    // Send receipt email only on first successful verification
    if (isSuccess && !wasAlreadySuccess) {
      sendReceiptEmail(payment).catch((err) =>
        console.error('[verifyPayment] Receipt email failed:', err.message)
      );
    }

    return res.json({
      success: isSuccess,
      message: isSuccess ? 'Payment verified successfully.' : `Payment status: ${tx.status}`,
      data: payment,
    });
  } catch (err) {
    console.error('[verifyPayment]', err.message);
    return res.status(500).json({ success: false, message: 'Server error during verification.' });
  }
};

// ─── POST /api/paystack/webhook ───────────────────────────────────────────────
exports.handleWebhook = async (req, res) => {
  try {
    // 1. Validate Paystack signature
    const secret = process.env.PAYSTACK_SECRET_KEY;
    const hash = crypto
      .createHmac('sha512', secret)
      .update(JSON.stringify(req.body))
      .digest('hex');

    if (hash !== req.headers['x-paystack-signature']) {
      return res.status(401).json({ message: 'Invalid signature.' });
    }

    // 2. Acknowledge immediately (Paystack expects 200 fast)
    res.sendStatus(200);

    // 3. Process event async
    const { event, data } = req.body;

    if (event === 'charge.success') {
      const payment = await Payment.findOne({ reference: data.reference });
      if (payment && payment.status !== 'success') {
        payment.status = 'success';
        payment.channel = data.channel;
        payment.paidAt = new Date(data.paid_at);
        payment.paystackData = data;
        await payment.save();
        console.log(`[webhook] Payment success: ${data.reference}`);
        // Fire receipt email (non-blocking)
        sendReceiptEmail(payment).catch((err) =>
          console.error('[webhook] Receipt email failed:', err.message)
        );
      }
    }

    if (event === 'charge.failed' || event === 'transfer.failed') {
      const payment = await Payment.findOne({ reference: data.reference });
      if (payment && payment.status === 'pending') {
        payment.status = 'failed';
        payment.paystackData = data;
        await payment.save();
        console.log(`[webhook] Payment failed: ${data.reference}`);
      }
    }
  } catch (err) {
    console.error('[handleWebhook]', err.message);
  }
};

// ─── GET /api/pay/history/:matricNumber ───────────────────────────────────────
exports.getPaymentHistory = async (req, res) => {
  try {
    const { matricNumber } = req.params;
    if (!matricNumber)
      return res.status(400).json({ success: false, message: 'Matric number required.' });

    const payments = await Payment.find(
      { matricNumber: matricNumber.toUpperCase() },
      { paystackData: 0 } // exclude raw payload from list view
    ).sort({ createdAt: -1 });

    const totalPaid = payments
      .filter((p) => p.status === 'success')
      .reduce((sum, p) => sum + p.totalKobo, 0);

    return res.json({
      success: true,
      data: {
        payments,
        summary: {
          totalPaidNaira: totalPaid / 100,
          count: payments.length,
          successCount: payments.filter((p) => p.status === 'success').length,
        },
      },
    });
  } catch (err) {
    console.error('[getPaymentHistory]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/pay/receipt/:reference ─────────────────────────────────────────
exports.getReceipt = async (req, res) => {
  try {
    const payment = await Payment.findOne(
      { reference: req.params.reference, status: 'success' },
      { paystackData: 0 }
    );
    if (!payment) return res.status(404).json({ success: false, message: 'Receipt not found.' });
    return res.json({ success: true, data: payment });
  } catch (err) {
    console.error('[getReceipt]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};
