const nodemailer = require('nodemailer');

// Create reusable transporter
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Format Naira amounts with commas
 */
function formatNaira(kobo) {
  return '₦' + (kobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 });
}

/**
 * Format date to readable string
 */
function formatDate(date) {
  return new Date(date).toLocaleDateString('en-NG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Build the HTML receipt email template
 */
function buildReceiptHTML(payment) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Payment Receipt</title>
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 0; color: #333; }
    .wrapper { max-width: 600px; margin: 32px auto; background: #fff; border-radius: 8px; overflow: hidden; border: 1px solid #e5e5e5; }
    .header { background: #1a56db; color: #fff; padding: 28px 32px; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 600; }
    .header p { margin: 4px 0 0; font-size: 13px; opacity: 0.85; }
    .badge { display: inline-block; background: #22c55e; color: #fff; font-size: 12px; padding: 4px 12px; border-radius: 20px; margin-top: 12px; font-weight: 600; }
    .body { padding: 28px 32px; }
    .section-title { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #888; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    td { padding: 9px 0; font-size: 14px; border-bottom: 1px solid #f0f0f0; }
    td:first-child { color: #666; width: 45%; }
    td:last-child { font-weight: 500; text-align: right; color: #111; }
    .total-row td { border-bottom: none; border-top: 2px solid #e5e5e5; padding-top: 14px; font-size: 16px; }
    .total-row td:last-child { color: #1a56db; font-size: 18px; }
    .ref-box { background: #f8f9fb; border: 1px solid #e5e5e5; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; font-size: 13px; color: #555; }
    .ref-box span { font-family: monospace; font-size: 14px; color: #111; font-weight: 600; display: block; margin-top: 4px; }
    .footer { background: #f8f9fb; border-top: 1px solid #e5e5e5; padding: 18px 32px; text-align: center; font-size: 12px; color: #999; }
    .footer a { color: #1a56db; text-decoration: none; }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="header">
      <h1>Payment Receipt</h1>
      <p>Federal University of Technology, Akure</p>
      <span class="badge">✓ Payment Successful</span>
    </div>
    <div class="body">
      <p style="font-size:15px;margin:0 0 24px">Hi <strong>${payment.studentName}</strong>, your payment has been received. Keep this receipt for your records.</p>

      <p class="section-title">Student details</p>
      <table>
        <tr><td>Full name</td><td>${payment.studentName}</td></tr>
        <tr><td>Matric number</td><td>${payment.matricNumber}</td></tr>
        <tr><td>Department</td><td>${payment.department || '—'}</td></tr>
        <tr><td>Level</td><td>${payment.level || '—'}</td></tr>
        <tr><td>Email</td><td>${payment.email}</td></tr>
      </table>

      <p class="section-title">Payment details</p>
      <table>
        <tr><td>Payment for</td><td>${payment.paymentLabel}</td></tr>
        <tr><td>Academic session</td><td>${payment.session}</td></tr>
        <tr><td>Date paid</td><td>${formatDate(payment.paidAt)}</td></tr>
        <tr><td>Payment channel</td><td style="text-transform:capitalize">${payment.channel || '—'}</td></tr>
        <tr><td>Subtotal</td><td>${formatNaira(payment.amountKobo)}</td></tr>
        <tr><td>Transaction fee</td><td>${formatNaira(payment.chargeKobo)}</td></tr>
        <tr class="total-row"><td>Total paid</td><td>${formatNaira(payment.totalKobo)}</td></tr>
      </table>

      <div class="ref-box">
        Transaction reference
        <span>${payment.reference}</span>
      </div>

      <p style="font-size:13px;color:#666;margin:0">If you have any issues, contact the Bursary at <a href="mailto:bursary@futa.edu.ng" style="color:#1a56db">bursary@futa.edu.ng</a> and quote your reference number.</p>
    </div>
    <div class="footer">
      This is an automated receipt from the FUTA Payment Portal.<br/>
      Powered by <a href="https://paystack.com">Paystack</a> &mdash; Secured &amp; Encrypted
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Send payment receipt email to student
 * @param {Object} payment - Payment mongoose document
 */
async function sendReceiptEmail(payment) {
  const html = buildReceiptHTML(payment);

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || '"FUTA Payment Portal" <noreply@futa.edu.ng>',
    to: payment.email,
    subject: `Payment Receipt — ${payment.paymentLabel} (${payment.session}) | Ref: ${payment.reference}`,
    html,
    text: `
Payment Receipt — FUTA Payment Portal

Hi ${payment.studentName},
Your payment of ${formatNaira(payment.totalKobo)} for ${payment.paymentLabel} (${payment.session}) was successful.

Reference: ${payment.reference}
Date: ${formatDate(payment.paidAt)}
Matric: ${payment.matricNumber}

Keep this reference for your records.
Contact bursary@futa.edu.ng for any issues.
    `.trim(),
  });
}

/**
 * Send a bulk digest to admin (e.g. daily summary)
 * @param {string} adminEmail
 * @param {Object} summary - { date, totalCount, totalAmountKobo, payments[] }
 */
async function sendAdminDigest(adminEmail, summary) {
  const rows = summary.payments
    .map(
      (p) =>
        `<tr>
          <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0">${p.matricNumber}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0">${p.studentName}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0">${p.paymentLabel}</td>
          <td style="padding:7px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${formatNaira(p.totalKobo)}</td>
        </tr>`
    )
    .join('');

  const html = `
<!DOCTYPE html><html><head><meta charset="UTF-8"/></head>
<body style="font-family:Arial,sans-serif;background:#f5f5f5;padding:32px">
  <div style="max-width:640px;margin:auto;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e5e5">
    <div style="background:#1a56db;color:#fff;padding:24px 28px">
      <h2 style="margin:0;font-size:18px">Daily Payment Digest</h2>
      <p style="margin:4px 0 0;font-size:13px;opacity:.85">${summary.date}</p>
    </div>
    <div style="padding:24px 28px">
      <div style="display:flex;gap:24px;margin-bottom:24px">
        <div style="flex:1;background:#f8f9fb;border-radius:6px;padding:14px;text-align:center">
          <div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:4px">Transactions</div>
          <div style="font-size:24px;font-weight:600;color:#111">${summary.totalCount}</div>
        </div>
        <div style="flex:1;background:#f8f9fb;border-radius:6px;padding:14px;text-align:center">
          <div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:4px">Total collected</div>
          <div style="font-size:24px;font-weight:600;color:#1a56db">${formatNaira(summary.totalAmountKobo)}</div>
        </div>
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#f0f4ff">
            <th style="padding:8px;text-align:left;font-weight:600">Matric</th>
            <th style="padding:8px;text-align:left;font-weight:600">Name</th>
            <th style="padding:8px;text-align:left;font-weight:600">Type</th>
            <th style="padding:8px;text-align:right;font-weight:600">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div style="background:#f8f9fb;border-top:1px solid #e5e5e5;padding:14px 28px;text-align:center;font-size:12px;color:#999">
      FUTA Payment Portal — Admin Digest
    </div>
  </div>
</body></html>`;

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: adminEmail,
    subject: `FUTA Portal Daily Digest — ${summary.date} (${summary.totalCount} payments)`,
    html,
  });
}

module.exports = { sendReceiptEmail, sendAdminDigest };
