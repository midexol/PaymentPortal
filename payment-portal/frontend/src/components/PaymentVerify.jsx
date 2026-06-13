import React, { useState, useEffect } from 'react';

export default function PaymentVerify({ onNavigate }) {
  const [reference, setReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null); // 'success', 'pending', 'failed'
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Parse reference from url query parameters
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference');
    if (ref) {
      setReference(ref);
      verifyTransaction(ref);
    } else {
      setErrorMsg('No transaction reference found in URL.');
      setLoading(false);
    }
  }, []);

  const verifyTransaction = async (ref) => {
    try {
      const response = await fetch(`/api/payments/verify/${ref}`);
      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setPaymentDetails(data.data);
      } else {
        setStatus('failed');
        setErrorMsg(data.message || 'Transaction verification failed.');
      }
    } catch (err) {
      console.error('Verify error:', err);
      setStatus('failed');
      setErrorMsg('A network error occurred while verifying the payment.');
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(val);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="verify-loading-container">
        <span className="spinner large"></span>
        <h3>Confirming Payment...</h3>
        <p>Please do not close or refresh this tab while we verify your transaction status with Paystack.</p>
      </div>
    );
  }

  return (
    <div className="verify-card active">
      {status === 'success' ? (
        <div className="verify-success-view">
          <div className="success-badge-container">
            <div className="success-badge-pulse"></div>
            <div className="success-badge-icon">
              <i className="ti ti-circle-check"></i>
            </div>
          </div>

          <h2>Payment Successful!</h2>
          <p className="success-subtitle">Your transaction has been processed and confirmed.</p>

          <div className="receipt-section">
            <div className="receipt-header">
              <h3>Receipt Summary</h3>
              <span className="receipt-ref">Ref: {paymentDetails?.reference}</span>
            </div>

            <div className="receipt-grid">
              <div className="receipt-row">
                <span>Student Name</span>
                <strong>{paymentDetails?.studentName}</strong>
              </div>
              <div className="receipt-row">
                <span>Matric Number</span>
                <strong>{paymentDetails?.matricNumber}</strong>
              </div>
              <div className="receipt-row">
                <span>Payment Category</span>
                <span>{paymentDetails?.paymentLabel}</span>
              </div>
              <div className="receipt-row">
                <span>Academic Session</span>
                <span>{paymentDetails?.session}</span>
              </div>
              <div className="receipt-row">
                <span>Date & Time</span>
                <span>{formatDate(paymentDetails?.paidAt)}</span>
              </div>
              <div className="receipt-row">
                <span>Subtotal</span>
                <span>{formatCurrency(paymentDetails?.amountKobo / 100)}</span>
              </div>
              <div className="receipt-row">
                <span>Service Charge</span>
                <span>{formatCurrency(paymentDetails?.chargeKobo / 100)}</span>
              </div>
              <div className="receipt-row total">
                <span>Amount Paid</span>
                <strong>{formatCurrency(paymentDetails?.totalKobo / 100)}</strong>
              </div>
            </div>
          </div>

          <div className="verify-actions">
            <button className="pay-btn primary-large" onClick={handlePrint}>
              <i className="ti ti-printer"></i> Print Receipt
            </button>
            <button className="pay-btn secondary" onClick={() => onNavigate('/')}>
              Return to Portal
            </button>
          </div>
        </div>
      ) : (
        <div className="verify-failed-view">
          <div className="failed-badge-icon">
            <i className="ti ti-circle-x"></i>
          </div>

          <h2>Verification Failed</h2>
          <p className="failed-subtitle">{errorMsg || 'We were unable to confirm your payment.'}</p>

          <div className="failed-help">
            <p>
              If your account has been debited but verification failed, please email support at{' '}
              <strong>bursary@example.edu</strong> with your transaction reference number:{' '}
              <strong className="font-mono">{reference || 'N/A'}</strong>.
            </p>
          </div>

          <div className="verify-actions single">
            <button className="pay-btn" onClick={() => onNavigate('/')}>
              Return to Portal
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
