const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Payment = require('../models/Payment');
const { sendAdminDigest } = require('../config/mailer');
const PDFDocument = require('pdfkit');

// ─── POST /api/admin/login ────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required.' });

    const admin = await Admin.findOne({ email, isActive: true });
    if (!admin || !(await admin.comparePassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid credentials.' });
    }

    admin.lastLogin = new Date();
    await admin.save();

    const token = jwt.sign(
      { id: admin._id, role: admin.role },
      process.env.ADMIN_JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '8h' }
    );

    return res.json({ success: true, token, admin });
  } catch (err) {
    console.error('[admin.login]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── POST /api/admin/register (superadmin only, use once to seed first admin) ──
exports.register = async (req, res) => {
  try {
    const { name, email, password, role, secretKey } = req.body;

    const adminCount = await Admin.countDocuments();
    if (adminCount > 0) {
      // If admins exist, we require token verification of a superadmin
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: 'Registration is closed. Access denied.' });
      }
      const token = authHeader.split(' ')[1];
      try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        const requester = await Admin.findById(decoded.id);
        if (!requester || requester.role !== 'superadmin' || !requester.isActive) {
          return res.status(403).json({ success: false, message: 'Forbidden. Only active superadmins can create new admins.' });
        }
      } catch (jwtErr) {
        return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
      }
    } else {
      // Bootstrapping the very first admin
      if (secretKey !== process.env.ADMIN_JWT_SECRET) {
        return res.status(403).json({ success: false, message: 'Forbidden.' });
      }
    }

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: 'Admin already exists.' });

    // Force role to superadmin if it's the very first admin to make sure we have a superadmin
    const finalRole = adminCount === 0 ? 'superadmin' : (role || 'finance');

    const admin = await Admin.create({ name, email, password, role: finalRole });
    return res.status(201).json({ success: true, admin });
  } catch (err) {
    console.error('[admin.register]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/admin/setup-status ──────────────────────────────────────────────
exports.getSetupStatus = async (req, res) => {
  try {
    const adminCount = await Admin.countDocuments();
    return res.json({ success: true, requiresSetup: adminCount === 0 });
  } catch (err) {
    console.error('[admin.getSetupStatus]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/admin/dashboard ─────────────────────────────────────────────────
exports.getDashboard = async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allTime, today, thisMonth, byType, recentPayments] = await Promise.all([
      // All-time totals
      Payment.aggregate([
        { $match: { status: 'success' } },
        { $group: { _id: null, total: { $sum: '$totalKobo' }, count: { $sum: 1 } } },
      ]),

      // Today's totals
      Payment.aggregate([
        { $match: { status: 'success', paidAt: { $gte: startOfDay } } },
        { $group: { _id: null, total: { $sum: '$totalKobo' }, count: { $sum: 1 } } },
      ]),

      // This month's totals
      Payment.aggregate([
        { $match: { status: 'success', paidAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$totalKobo' }, count: { $sum: 1 } } },
      ]),

      // Breakdown by payment type
      Payment.aggregate([
        { $match: { status: 'success' } },
        {
          $group: {
            _id: '$paymentType',
            label: { $first: '$paymentLabel' },
            totalKobo: { $sum: '$totalKobo' },
            count: { $sum: 1 },
          },
        },
        { $sort: { totalKobo: -1 } },
      ]),

      // 10 most recent successful payments
      Payment.find({ status: 'success' }, { paystackData: 0 })
        .sort({ paidAt: -1 })
        .limit(10),
    ]);

    // Pending payments count
    const pendingCount = await Payment.countDocuments({ status: 'pending' });

    return res.json({
      success: true,
      data: {
        allTime: {
          totalNaira: (allTime[0]?.total || 0) / 100,
          count: allTime[0]?.count || 0,
        },
        today: {
          totalNaira: (today[0]?.total || 0) / 100,
          count: today[0]?.count || 0,
        },
        thisMonth: {
          totalNaira: (thisMonth[0]?.total || 0) / 100,
          count: thisMonth[0]?.count || 0,
        },
        pendingCount,
        byType,
        recentPayments,
      },
    });
  } catch (err) {
    console.error('[admin.getDashboard]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/admin/payments ──────────────────────────────────────────────────
// Query params: status, paymentType, session, search, startDate, endDate, page, limit
exports.listPayments = async (req, res) => {
  try {
    const {
      status,
      paymentType,
      session,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;
    if (session) filter.session = session;

    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    if (search) {
      const rx = new RegExp(search, 'i');
      filter.$or = [{ studentName: rx }, { matricNumber: rx }, { email: rx }, { reference: rx }];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [payments, total] = await Promise.all([
      Payment.find(filter, { paystackData: 0 })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Payment.countDocuments(filter),
    ]);

    return res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total,
          page: Number(page),
          limit: Number(limit),
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (err) {
    console.error('[admin.listPayments]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── GET /api/admin/payments/export-pdf ──────────────────────────────────────
// Returns PDF — same filters as listPayments but no pagination
exports.exportPDF = async (req, res) => {
  try {
    const { status, paymentType, session, startDate, endDate, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;
    if (session) filter.session = session;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      const rx = new RegExp(search, 'i');
      filter.$or = [{ studentName: rx }, { matricNumber: rx }, { email: rx }, { reference: rx }];
    }

    const payments = await Payment.find(filter, { paystackData: 0 }).sort({ createdAt: -1 });

    const totalCount = payments.length;
    const totalAmount = payments.reduce((sum, p) => sum + (p.totalKobo || 0), 0) / 100;
    const successCount = payments.filter(p => p.status === 'success').length;

    // Create PDF
    const doc = new PDFDocument({ margin: 30, size: 'A4' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payments-report-${Date.now()}.pdf"`);
    doc.pipe(res);

    // Title
    doc.fillColor('#0f172a').fontSize(16).text('Institutional Billing System', { align: 'center' });
    doc.fontSize(11).fillColor('#64748b').text('Financial Transaction Audit Report', { align: 'center' });
    doc.moveDown(1);

    // Metadata line
    doc.fontSize(8).fillColor('#475569').text(`Generated on: ${new Date().toLocaleString('en-NG')}`, { align: 'right' });
    doc.moveDown(0.5);

    // Summary Box
    const startY = doc.y;
    doc.rect(30, startY, 535, 60).fillAndStroke('#f8fafc', '#cbd5e1');
    const boxY = startY + 10;
    doc.fillColor('#0f172a');
    doc.fontSize(9).text(`Total Records: ${totalCount}`, 45, boxY);
    doc.text(`Total Revenue: NGN ${totalAmount.toFixed(2)}`, 160, boxY);
    doc.text(`Successful Transactions: ${successCount}`, 340, boxY);
    doc.text(`Active Filters: Status [${status || 'All'}] | Category [${paymentType || 'All'}] | Session [${session || 'All'}]`, 45, boxY + 22, { width: 500 });

    doc.y = startY + 60;
    doc.moveDown(1.5);

    // Table Header
    const tableHeaderY = doc.y;
    doc.rect(30, tableHeaderY, 535, 20).fill('#0f172a');
    doc.fillColor('#ffffff').fontSize(8);
    doc.text('Reference', 35, tableHeaderY + 6);
    doc.text('Student Name', 125, tableHeaderY + 6);
    doc.text('Matric No', 240, tableHeaderY + 6);
    doc.text('Category', 315, tableHeaderY + 6);
    doc.text('Session', 390, tableHeaderY + 6);
    doc.text('Amount (N)', 445, tableHeaderY + 6);
    doc.text('Status', 510, tableHeaderY + 6);

    let currentY = tableHeaderY + 20;

    // Table Rows
    doc.fillColor('#334155');
    for (const p of payments) {
      if (currentY > 750) {
        doc.addPage();
        currentY = 40;
        
        doc.rect(30, currentY, 535, 20).fill('#0f172a');
        doc.fillColor('#ffffff').fontSize(8);
        doc.text('Reference', 35, currentY + 6);
        doc.text('Student Name', 125, currentY + 6);
        doc.text('Matric No', 240, currentY + 6);
        doc.text('Category', 315, currentY + 6);
        doc.text('Session', 390, currentY + 6);
        doc.text('Amount (N)', 445, currentY + 6);
        doc.text('Status', 510, currentY + 6);
        currentY += 20;
        doc.fillColor('#334155');
      }

      doc.moveTo(30, currentY).lineTo(565, currentY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();

      const textY = currentY + 6;
      doc.text(p.reference, 35, textY);
      
      const name = p.studentName.length > 20 ? p.studentName.substring(0, 18) + '..' : p.studentName;
      doc.text(name, 125, textY);
      doc.text(p.matricNumber, 240, textY);
      doc.text(p.paymentLabel, 315, textY);
      doc.text(p.session, 390, textY);
      doc.text((p.totalKobo / 100).toFixed(2), 445, textY, { width: 55, align: 'right' });
      
      if (p.status === 'success') {
        doc.fillColor('#15803d');
      } else if (p.status === 'pending') {
        doc.fillColor('#b45309');
      } else {
        doc.fillColor('#b91c1c');
      }
      doc.text(p.status.toUpperCase(), 510, textY);
      doc.fillColor('#334155');

      currentY += 20;
    }

    doc.end();
  } catch (err) {
    console.error('[admin.exportPDF]', err.message);
    return res.status(500).json({ success: false, message: 'Server error generating PDF report.' });
  }
};

// ─── GET /api/admin/payments/:id ──────────────────────────────────────────────
exports.getPaymentDetail = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ success: false, message: 'Payment not found.' });
    return res.json({ success: true, data: payment });
  } catch (err) {
    console.error('[admin.getPaymentDetail]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

// ─── POST /api/admin/digest ───────────────────────────────────────────────────
// Trigger a manual daily digest email to the calling admin
exports.sendDigest = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const payments = await Payment.find(
      { status: 'success', paidAt: { $gte: today } },
      { paystackData: 0 }
    ).sort({ paidAt: -1 });

    const totalAmountKobo = payments.reduce((sum, p) => sum + p.totalKobo, 0);
    const dateStr = new Date().toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });

    await sendAdminDigest(req.admin.email, {
      date: dateStr,
      totalCount: payments.length,
      totalAmountKobo,
      payments,
    });

    return res.json({
      success: true,
      message: `Digest sent to ${req.admin.email} — ${payments.length} payments today.`,
    });
  } catch (err) {
    console.error('[admin.sendDigest]', err.message);
    return res.status(500).json({ success: false, message: 'Failed to send digest.' });
  }
};
