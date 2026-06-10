const jwt = require('jsonwebtoken');
const Admin = require('../models/Admin');
const Payment = require('../models/Payment');
const { sendAdminDigest } = require('../config/mailer');

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

    // Simple bootstrap guard — remove after first admin is created
    if (secretKey !== process.env.ADMIN_JWT_SECRET) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    const exists = await Admin.findOne({ email });
    if (exists) return res.status(409).json({ success: false, message: 'Admin already exists.' });

    const admin = await Admin.create({ name, email, password, role: role || 'finance' });
    return res.status(201).json({ success: true, admin });
  } catch (err) {
    console.error('[admin.register]', err.message);
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

// ─── GET /api/admin/payments/export ──────────────────────────────────────────
// Returns CSV — same filters as listPayments but no pagination
exports.exportCSV = async (req, res) => {
  try {
    const { status, paymentType, session, startDate, endDate } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (paymentType) filter.paymentType = paymentType;
    if (session) filter.session = session;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }

    const payments = await Payment.find(filter, { paystackData: 0 }).sort({ createdAt: -1 });

    const header = [
      'Reference',
      'Student Name',
      'Matric Number',
      'Email',
      'Phone',
      'Department',
      'Level',
      'Payment Type',
      'Session',
      'Amount (₦)',
      'Charge (₦)',
      'Total (₦)',
      'Status',
      'Channel',
      'Paid At',
      'Created At',
    ].join(',');

    const rows = payments.map((p) =>
      [
        p.reference,
        `"${p.studentName}"`,
        p.matricNumber,
        p.email,
        p.phone || '',
        `"${p.department || ''}"`,
        p.level || '',
        p.paymentLabel,
        p.session,
        (p.amountKobo / 100).toFixed(2),
        (p.chargeKobo / 100).toFixed(2),
        (p.totalKobo / 100).toFixed(2),
        p.status,
        p.channel || '',
        p.paidAt ? new Date(p.paidAt).toISOString() : '',
        new Date(p.createdAt).toISOString(),
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="payments-${Date.now()}.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error('[admin.exportCSV]', err.message);
    return res.status(500).json({ success: false, message: 'Server error.' });
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
