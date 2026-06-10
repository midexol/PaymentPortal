import React from 'react';

const PAYMENT_TYPES = [
  { type: 'fees', label: 'School fees', subtext: 'Tuition & levies', amount: 150000, icon: 'ti ti-school' },
  { type: 'hostel', label: 'Hostel', subtext: 'Accommodation', amount: 45000, icon: 'ti ti-home' },
  { type: 'exam', label: 'Exam fees', subtext: 'Examination registration', amount: 5000, icon: 'ti ti-file-text' },
  { type: 'library', label: 'Library dues', subtext: 'Library card & dues', amount: 3000, icon: 'ti ti-book' },
  { type: 'sport', label: 'Sport levy', subtext: 'Athletic fee', amount: 2500, icon: 'ti ti-run' },
  { type: 'other', label: 'Others', subtext: 'Miscellaneous', amount: 10000, icon: 'ti ti-receipt' }
];

// Replicates backend charge calculation for consistency
function computeFrontendCharge(amount) {
  const FLAT_FEE_THRESHOLD = 2500; // ₦2,500
  const FLAT_FEE = 100;            // ₦100
  const CAP = 2000;                // ₦2,000
  const RATE = 0.015;

  let charge = Math.round(amount * RATE);
  if (amount > FLAT_FEE_THRESHOLD) charge += FLAT_FEE;
  if (charge > CAP) charge = CAP;
  return charge;
}

export default function PaymentTypeSelector({ selectedType, session, onChangeType, onChangeSession, onNext, onBack }) {
  const currentItem = PAYMENT_TYPES.find(p => p.type === selectedType) || PAYMENT_TYPES[0];
  const subtotal = currentItem.amount;
  const charge = computeFrontendCharge(subtotal);
  const total = subtotal + charge;

  return (
    <div id="pane2">
      <div className="section">
        <div className="section-title">What are you paying for?</div>
        
        {/* Responsive grid displaying all options */}
        <div className="payment-types" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
          {PAYMENT_TYPES.map((pt) => (
            <div
              key={pt.type}
              className={`pay-type ${selectedType === pt.type ? 'selected' : ''}`}
              onClick={() => onChangeType(pt.type)}
            >
              <i className={pt.icon} aria-hidden="true"></i>
              <span>{pt.label}</span>
              <small>{pt.subtext}</small>
            </div>
          ))}
        </div>

        <div className="amount-display">
          <div className="amount-row">
            <span>Payment type</span>
            <span style={{ fontWeight: 500, color: 'var(--color-text-primary)' }}>{currentItem.label}</span>
          </div>
          <div className="amount-row">
            <span>Amount (₦)</span>
            <span>{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="amount-row">
            <span>Paystack charge</span>
            <span>{charge.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="amount-row total">
            <span>Total</span>
            <span>₦{total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>

        <div className="form-row single" style={{ marginTop: '16px' }}>
          <div className="form-group">
            <label htmlFor="session-select">Academic Session</label>
            <select
              id="session-select"
              value={session}
              onChange={(e) => onChangeSession(e.target.value)}
            >
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
              <option value="2026/2027">2026/2027</option>
            </select>
          </div>
        </div>
      </div>

      <div className="pane-actions-row">
        <button type="button" className="pay-btn secondary" onClick={onBack}>
          <i className="ti ti-arrow-left" aria-hidden="true"></i> Back
        </button>
        <button type="button" className="pay-btn primary-large" onClick={onNext}>
          <span>Continue</span>
          <i className="ti ti-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}
export { computeFrontendCharge, PAYMENT_TYPES };
