const Payment = require('../models/Payment');
const {
  paystackClient,
  PAYMENT_AMOUNTS,
  computeCharge,
  generateReference,
} = require('../config/paystack');
const { sendReceiptEmail, sendOTPNotification } = require('../config/mailer');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const PDFDocument = require('pdfkit');
const Otp = require('../models/Otp');

// Matric format validation helper: FPA/SW/YY/X-NNNN
const validateMatric = (num) => {
  if (!num) return false;
  return /^FPA\/SW\/[0-9]{2}\/[0-9]+-[0-9]{4}$/i.test(num);
};

// Mask email address for privacy
function maskEmail(email) {
  if (!email) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${'*'.repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

// ─── POST /api/pay/initialize ─────────────────────────────────────────────────
exports.initializePayment = async (req, res) => {
  try {
    const { studentName, matricNumber, email, phone, department, level, paymentType, paymentTypes, session } =
      req.body;

    // Validate required fields
    if (!studentName || !matricNumber || !email || !session) {
      return res.status(400).json({ success: false, message: 'Missing required fields.' });
    }

    // Validate matric format
    if (!validateMatric(matricNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Matric Number. Must match format FPA/SW/YY/X-NNNN (e.g. FPA/SW/19/3-0001).',
      });
    }

    // Check if matric has existing payments in database
    const existing = await Payment.findOne({ matricNumber: matricNumber.toUpperCase(), status: 'success' });
    if (existing) {
      // Must provide a valid token matching this matric number
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required. This matric number has existing payments.',
        });
      }
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'secret');
        if (decoded.matricNumber.toUpperCase() !== matricNumber.toUpperCase()) {
          return res.status(403).json({
            success: false,
            message: 'Session mismatch. The session does not match this matric number.',
          });
        }
      } catch (err) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired student session. Please re-authenticate.',
        });
      }
    }

    // Determine the list of payment types
    let types = [];
    if (Array.isArray(paymentTypes) && paymentTypes.length > 0) {
      types = paymentTypes;
    } else if (paymentType) {
      types = [paymentType];
    } else {
      return res.status(400).json({ success: false, message: 'No payment type selected.' });
    }

    // Sum amount and construct label
    let amountKobo = 0;
    const labels = [];
    for (const t of types) {
      const config = PAYMENT_AMOUNTS[t];
      if (!config) {
        return res.status(400).json({ success: false, message: `Invalid payment type: ${t}` });
      }
      amountKobo += config.amountKobo;
      labels.push(config.label);
    }

    const paymentLabel = labels.join(', ');
    const chargeKobo = computeCharge(amountKobo);
    const totalKobo = amountKobo + chargeKobo;
    const reference = generateReference(types[0] || 'other');
    const dbPaymentType = 'other'; // Stored as 'other' to satisfy Mongoose model enum constraints

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
        paymentType: dbPaymentType,
        paymentLabel,
        session,
        custom_fields: [
          { display_name: 'Matric Number', variable_name: 'matric_number', value: matricNumber },
          { display_name: 'Department', variable_name: 'department', value: department || 'N/A' },
          { display_name: 'Payment For', variable_name: 'payment_for', value: paymentLabel },
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
      paymentType: dbPaymentType,
      paymentLabel,
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

    // Validate matric format
    if (!validateMatric(matricNumber)) {
      return res.status(400).json({ success: false, message: 'Invalid Matric Number format.' });
    }

    // Verify token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authorization token required.' });
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET || 'secret');
      if (decoded.matricNumber.toUpperCase() !== matricNumber.toUpperCase()) {
        return res.status(403).json({ success: false, message: 'Access denied: Matric number mismatch.' });
      }
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Session expired or invalid.' });
    }

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

// ─── POST /api/payments/session/access ─────────────────────────────────────────
exports.accessPortal = async (req, res) => {
  try {
    const { matricNumber } = req.body;
    if (!matricNumber) {
      return res.status(400).json({ success: false, message: 'Matric number is required.' });
    }

    // Validate format
    if (!validateMatric(matricNumber)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid Matric Number. Must match format FPA/SW/YY/X-NNNN (e.g. FPA/SW/19/3-0001).',
      });
    }

    // Check if matric number has successful payments
    const lastPayment = await Payment.findOne({
      matricNumber: matricNumber.toUpperCase(),
      status: 'success'
    }).sort({ createdAt: -1 });

    if (!lastPayment) {
      // New student - let them proceed directly
      return res.json({
        success: true,
        verified: true,
        hasHistory: false,
        message: 'Welcome! You can proceed to make your first payment.'
      });
    }

    // Existing student - send OTP to their registered email
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits

    // Save/overwrite OTP in database
    await Otp.findOneAndUpdate(
      { matricNumber: matricNumber.toUpperCase() },
      { email: lastPayment.email, code: otpCode, createdAt: new Date() },
      { upsert: true, new: true }
    );

    // Send email
    await sendOTPNotification(lastPayment.email, matricNumber.toUpperCase(), otpCode);

    return res.json({
      success: true,
      verified: false,
      hasHistory: true,
      emailMasked: maskEmail(lastPayment.email),
      message: 'Verification code sent to your registered email.'
    });
  } catch (err) {
    console.error('[accessPortal]', err.message);
    return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  }
};

// ─── POST /api/payments/session/verify ─────────────────────────────────────────
exports.verifyPortalSession = async (req, res) => {
  try {
    const { matricNumber, code } = req.body;
    if (!matricNumber || !code) {
      return res.status(400).json({ success: false, message: 'Matric number and verification code are required.' });
    }

    const otpRecord = await Otp.findOne({
      matricNumber: matricNumber.toUpperCase(),
      code: code.trim()
    });

    if (!otpRecord) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    // Delete verification record
    await Otp.deleteOne({ _id: otpRecord._id });

    // Fetch student's most recent details to prefill form
    const lastPayment = await Payment.findOne({
      matricNumber: matricNumber.toUpperCase(),
      status: 'success'
    }).sort({ createdAt: -1 });

    const studentDetails = {
      studentName: lastPayment.studentName,
      email: lastPayment.email,
      phone: lastPayment.phone || '',
      department: lastPayment.department || 'Software and Web Development',
      level: lastPayment.level || 'HND I'
    };

    // Sign student token
    const token = jwt.sign(
      { matricNumber: matricNumber.toUpperCase(), studentDetails },
      process.env.ADMIN_JWT_SECRET || 'secret',
      { expiresIn: '12h' }
    );

    return res.json({
      success: true,
      token,
      studentDetails,
      message: 'Portal access unlocked.'
    });
  } catch (err) {
    console.error('[verifyPortalSession]', err.message);
    return res.status(500).json({ success: false, message: `Server error: ${err.message}` });
  }
};

// ─── GET /api/payments/receipt/:reference/pdf ───────────────────────────────────
exports.getReceiptPDF = async (req, res) => {
  try {
    const { reference } = req.params;
    const payment = await Payment.findOne({ reference, status: 'success' });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Receipt not found or transaction is not successful.' });
    }

    // Parse items from paymentLabel
    const labels = payment.paymentLabel.split(', ');
    const items = [];
    let calculatedSubtotal = 0;
    for (const label of labels) {
      const matched = Object.values(PAYMENT_AMOUNTS).find(item => item.label === label);
      if (matched) {
        items.push({ label, amount: matched.amountKobo / 100 });
        calculatedSubtotal += matched.amountKobo / 100;
      } else {
        items.push({ label, amount: 0 });
      }
    }

    // If no labels matched, fallback to total amount minus service charge
    const subtotal = calculatedSubtotal > 0 ? calculatedSubtotal : (payment.amountKobo / 100);

    // Generate PDF document using pdfkit
    const doc = new PDFDocument({ margin: 40, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="receipt_${payment.reference}.pdf"`);
    doc.pipe(res);

    // Decorative top brand bar (navy color)
    doc.rect(0, 0, 595.28, 15).fill('#081633');

    // Header
    doc.moveDown(2.5);
    doc.fillColor('#081633').fontSize(15).font('Helvetica-Bold').text('SOFTWARE & WEB DEVELOPMENT DEPARTMENT', { align: 'center' });
    doc.fontSize(10).fillColor('#475569').font('Helvetica').text('Federal Polytechnic Ado-Ekiti', { align: 'center' });
    doc.fontSize(12).fillColor('#1d4ed8').font('Helvetica-Bold').text('OFFICIAL PAYMENT RECEIPT', { align: 'center', paragraphGap: 10 });

    // Horizontal divider
    doc.moveTo(40, doc.y).lineTo(555, doc.y).strokeColor('#e2e8f0').lineWidth(1).stroke();
    doc.moveDown(1.5);

    // Reference & Status Highlight Box
    const infoY = doc.y;
    doc.rect(40, infoY, 515, 45).fillAndStroke('#f8fafc', '#cbd5e1');
    doc.fillColor('#0f172a').fontSize(9).font('Helvetica-Bold').text('Transaction Reference:', 55, infoY + 10);
    doc.font('Helvetica').fillColor('#0f172a').text(payment.reference, 55, infoY + 25);

    doc.font('Helvetica-Bold').fillColor('#0f172a').text('Payment Status:', 380, infoY + 10);
    doc.font('Helvetica-Bold').fillColor('#15803d').text('SUCCESSFUL / PAID', 380, infoY + 25);

    doc.y = infoY + 45;
    doc.moveDown(2);

    // Student Information Grid
    doc.fillColor('#081633').fontSize(11).font('Helvetica-Bold').text('STUDENT INFORMATION');
    doc.moveDown(0.4);
    const detailsY = doc.y;
    doc.rect(40, detailsY, 515, 100).fillAndStroke('#ffffff', '#e2e8f0');

    doc.fontSize(9).fillColor('#475569').font('Helvetica');
    let rowY = detailsY + 12;
    doc.text('Full Name:', 55, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.studentName, 145, rowY);

    doc.font('Helvetica').fillColor('#475569');
    rowY += 20;
    doc.text('Matric Number:', 55, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.matricNumber, 145, rowY);

    doc.font('Helvetica').fillColor('#475569');
    rowY += 20;
    doc.text('Department:', 55, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.department || 'N/A', 145, rowY);

    doc.font('Helvetica').fillColor('#475569');
    rowY += 20;
    doc.text('Level:', 55, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.level || 'N/A', 145, rowY);

    // Right Column of Student Info Grid
    rowY = detailsY + 12;
    doc.font('Helvetica').fillColor('#475569').text('Email:', 330, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.email, 410, rowY);

    doc.font('Helvetica').fillColor('#475569');
    rowY += 20;
    doc.text('Phone Number:', 330, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.phone || 'N/A', 410, rowY);

    doc.font('Helvetica').fillColor('#475569');
    rowY += 20;
    doc.text('Academic Session:', 330, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(payment.session, 410, rowY);

    doc.font('Helvetica').fillColor('#475569');
    rowY += 20;
    doc.text('Payment Date:', 330, rowY);
    doc.font('Helvetica-Bold').fillColor('#0f172a').text(new Date(payment.paidAt || payment.createdAt).toLocaleString('en-NG'), 410, rowY);

    doc.y = detailsY + 100;
    doc.moveDown(2.5);

    // Payment Item Breakdown Table
    doc.fillColor('#081633').fontSize(11).font('Helvetica-Bold').text('PAYMENT BREAKDOWN');
    doc.moveDown(0.4);

    const tableHeaderY = doc.y;
    doc.rect(40, tableHeaderY, 515, 20).fill('#081633');
    doc.fillColor('#ffffff').fontSize(9).font('Helvetica-Bold');
    doc.text('Payment Item Description', 55, tableHeaderY + 6);
    doc.text('Amount (NGN)', 440, tableHeaderY + 6, { width: 100, align: 'right' });

    let currentY = tableHeaderY + 20;
    doc.fontSize(9).fillColor('#0f172a').font('Helvetica');

    // Draw individual rows
    for (const item of items) {
      doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.text(item.label, 55, currentY + 6);
      doc.text(item.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 }), 440, currentY + 6, { width: 100, align: 'right' });
      currentY += 20;
    }

    doc.moveTo(40, currentY).lineTo(555, currentY).strokeColor('#cbd5e1').lineWidth(1).stroke();

    // Summary Totals
    currentY += 10;
    doc.text('Subtotal:', 350, currentY);
    doc.font('Helvetica-Bold').text(subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 }), 440, currentY, { width: 100, align: 'right' });

    currentY += 16;
    doc.font('Helvetica').text('Service Charge (Paystack):', 300, currentY);
    doc.font('Helvetica-Bold').text((payment.chargeKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 }), 440, currentY, { width: 100, align: 'right' });

    currentY += 20;
    doc.rect(300, currentY - 4, 255, 24).fill('#eff6ff');
    doc.fillColor('#1d4ed8').font('Helvetica-Bold');
    doc.text('Total Amount Paid:', 310, currentY + 3);
    doc.text('NGN ' + (payment.totalKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 }), 440, currentY + 3, { width: 100, align: 'right' });

    currentY += 50;

    // Signature-free watermark / warning footer
    doc.fillColor('#64748b').fontSize(8).font('Helvetica-Oblique').text('This is a computer-generated financial receipt. It serves as an official proof of payment and requires no physical signature.', 40, currentY, { align: 'center', width: 515 });
    doc.moveDown(0.5);
    doc.fontSize(8).fillColor('#94a3b8').font('Helvetica').text('Software & Web Development Payment Portal | Secured by Paystack', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error('[getReceiptPDF]', err.message);
    return res.status(500).json({ success: false, message: 'Server error generating PDF receipt.' });
  }
};
