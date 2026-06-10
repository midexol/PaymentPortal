import React, { useState } from 'react';
import { PAYMENT_TYPES, computeFrontendCharge } from './PaymentTypeSelector';

export default function PaymentSummary({ studentDetails, selectedType, session, onEdit }) {
  const [loading, setLoading] = useState(false);

  const currentItem = PAYMENT_TYPES.find(p => p.type === selectedType) || PAYMENT_TYPES[0];
  const subtotal = currentItem.amount;
  const charge = computeFrontendCharge(subtotal);
  const total = subtotal + charge;

  const handlePay = async () => {
    if (!studentDetails.email) {
      alert('Please provide your email address first.');
      onEdit();
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          studentName: studentDetails.studentName,
          matricNumber: studentDetails.matricNumber,
          email: studentDetails.email,
          phone: studentDetails.phone || '',
          department: studentDetails.department || '',
          level: studentDetails.level || '',
          paymentType: selectedType,
          session: session
        })
      });

      const resData = await response.json();

      if (resData.success && resData.data && resData.data.authorizationUrl) {
        // Redirect to Paystack checkouts
        window.location.href = resData.data.authorizationUrl;
      } else {
        alert('Payment initialization failed: ' + (resData.message || 'Check backend configuration.'));
      }
    } catch (err) {
      console.error('Network Error:', err);
      alert('Could not connect to the backend server. Please verify the Express backend is running.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="pane3">
      <div className="section">
        <div className="section-title">Payment summary</div>
        
        <div style={{ fontSize: '14px', marginBottom: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '12px 16px', color: 'var(--color-text-secondary)', fontSize: '13px' }}>
            <span>Name</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{studentDetails.studentName}</span>
            
            <span>Matric no.</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{studentDetails.matricNumber}</span>
            
            <span>Email</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{studentDetails.email}</span>
            
            {studentDetails.phone && (
              <>
                <span>Phone</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{studentDetails.phone}</span>
              </>
            )}
            
            {studentDetails.department && (
              <>
                <span>Department</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{studentDetails.department}</span>
              </>
            )}

            {studentDetails.level && (
              <>
                <span>Level</span>
                <span style={{ color: 'var(--color-text-primary)' }}>{studentDetails.level}</span>
              </>
            )}

            <span>Payment for</span>
            <span style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>{currentItem.label}</span>

            <span>Academic session</span>
            <span style={{ color: 'var(--color-text-primary)' }}>{session}</span>
          </div>
        </div>

        <div className="amount-display" style={{ marginTop: '12px' }}>
          <div className="amount-row">
            <span>Subtotal</span>
            <span>₦{subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="amount-row">
            <span>Paystack charge</span>
            <span>₦{charge.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="amount-row total">
            <span>Total due</span>
            <span>₦{total.toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
          </div>
        </div>
      </div>

      <button
        type="button"
        className="pay-btn"
        onClick={handlePay}
        disabled={loading}
        style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
      >
        <i className={loading ? "ti ti-loader rotate" : "ti ti-credit-card"} aria-hidden="true"></i>
        {loading ? 'Initializing transaction...' : 'Pay with Paystack'}
      </button>

      <div className="secure-note">
        <i className="ti ti-lock" aria-hidden="true"></i>
        Your payment is encrypted and secure
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '12px' }}>
        <button
          type="button"
          style={{ background: 'none', border: 'none', fontSize: '13px', fontWeight: 500, color: 'var(--brand)', cursor: 'pointer' }}
          onClick={onEdit}
          disabled={loading}
        >
          ← Edit payment details
        </button>
      </div>
    </div>
  );
}
