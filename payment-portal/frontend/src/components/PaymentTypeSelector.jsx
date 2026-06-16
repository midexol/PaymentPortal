import React from 'react';

const PAYMENT_TYPES = [
  { type: 'dept_due', label: 'Departmental due', amount: 2000, icon: 'ti ti-cash' },
  { type: 'manual', label: 'Manuals', amount: 5000, icon: 'ti ti-book' },
  { type: 'seminar', label: 'Seminar', amount: 3000, icon: 'ti ti-presentation' },
  { type: 'project', label: 'Project Defence', amount: 4000, icon: 'ti ti-briefcase' },
  { type: 'binding', label: 'Binding', amount: 1500, icon: 'ti ti-notes' },
  { type: 'clearance', label: 'Departmental Clearance', amount: 1000, icon: 'ti ti-file-check' }
];

// Replicates backend charge calculation for consistency
function computeFrontendCharge(amount) {
  if (amount === 0) return 0;
  const FLAT_FEE_THRESHOLD = 2500; // ₦2,500
  const FLAT_FEE = 100;            // ₦100
  const CAP = 2000;                // ₦2,000
  const RATE = 0.015;

  let charge = Math.round(amount * RATE);
  if (amount > FLAT_FEE_THRESHOLD) charge += FLAT_FEE;
  if (charge > CAP) charge = CAP;
  return charge;
}

export default function PaymentTypeSelector({ selectedTypes, session, onChangeTypes, onChangeSession, onNext, onBack }) {
  const handleToggle = (type) => {
    if (selectedTypes.includes(type)) {
      onChangeTypes(selectedTypes.filter(t => t !== type));
    } else {
      onChangeTypes([...selectedTypes, type]);
    }
  };

  const selectedItems = PAYMENT_TYPES.filter(p => selectedTypes.includes(p.type));
  const subtotal = selectedItems.reduce((sum, item) => sum + item.amount, 0);
  const charge = computeFrontendCharge(subtotal);
  const total = subtotal + charge;

  const isContinueDisabled = selectedTypes.length === 0;

  return (
    <div id="pane2">
      <div className="section">
        <div className="section-title">Select items to pay for</div>
        
        {/* Checkbox List layout */}
        <div className="payment-checkbox-list">
          {PAYMENT_TYPES.map((pt) => {
            const isChecked = selectedTypes.includes(pt.type);
            return (
              <label
                key={pt.type}
                className={`payment-checkbox-item ${isChecked ? 'checked' : ''}`}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => handleToggle(pt.type)}
                  style={{ marginRight: '4px' }}
                />
                <div className="payment-checkbox-icon" style={{ marginLeft: '8px' }}>
                  <i className={pt.icon} aria-hidden="true"></i>
                </div>
                <div className="payment-checkbox-details" style={{ marginLeft: '12px' }}>
                  <span className="payment-checkbox-label">{pt.label}</span>
                  <span className="payment-checkbox-price">₦{pt.amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                </div>
              </label>
            );
          })}
        </div>

        <div className="amount-display">
          <div className="amount-row">
            <span>Selected items</span>
            <span style={{ fontWeight: 500, color: 'var(--color-text-primary)', textAlign: 'right', maxWidth: '60%' }}>
              {selectedItems.length > 0 ? selectedItems.map(p => p.label).join(', ') : 'None'}
            </span>
          </div>
          <div className="amount-row">
            <span>Subtotal (₦)</span>
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
        <button
          type="button"
          className="pay-btn primary-large"
          onClick={onNext}
          disabled={isContinueDisabled}
          style={{
            opacity: isContinueDisabled ? 0.6 : 1,
            cursor: isContinueDisabled ? 'not-allowed' : 'pointer'
          }}
        >
          <span>Continue</span>
          <i className="ti ti-arrow-right" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  );
}
export { computeFrontendCharge, PAYMENT_TYPES };
