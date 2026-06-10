import React, { useState } from 'react';

export default function PaymentHistory() {
  const [matric, setMatric] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifyingMap, setVerifyingMap] = useState({});
  const [historyData, setHistoryData] = useState(null);
  const [error, setError] = useState('');

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!matric.trim()) return;

    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/payments/history/${encodeURIComponent(matric.trim())}`);
      const resData = await response.json();

      if (resData.success) {
        setHistoryData(resData.data);
      } else {
        setError(resData.message || 'Failed to fetch payment history.');
        setHistoryData(null);
      }
    } catch (err) {
      console.error(err);
      setError('Could not connect to the backend server.');
      setHistoryData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (reference) => {
    setVerifyingMap(prev => ({ ...prev, [reference]: true }));
    try {
      const response = await fetch(`/api/payments/verify/${reference}`);
      const resData = await response.json();
      
      if (resData.success) {
        alert('Payment verified successfully!');
        // Refresh the list
        handleSearch();
      } else {
        alert(`Verification update: ${resData.message}`);
        handleSearch();
      }
    } catch (err) {
      console.error(err);
      alert('Verification network request failed.');
    } finally {
      setVerifyingMap(prev => ({ ...prev, [reference]: false }));
    }
  };

  const getIconClass = (type) => {
    switch (type) {
      case 'fees':
        return 'hist-icon fees';
      case 'hostel':
        return 'hist-icon hostel';
      case 'exam':
        return 'hist-icon exam';
      case 'library':
        return 'hist-icon library';
      case 'sport':
        return 'hist-icon sport';
      default:
        return 'hist-icon other';
    }
  };

  const getIcon = (type) => {
    switch (type) {
      case 'fees':
        return 'ti ti-school';
      case 'hostel':
        return 'ti ti-home';
      case 'exam':
        return 'ti ti-file-text';
      case 'library':
        return 'ti ti-book';
      case 'sport':
        return 'ti ti-run';
      default:
        return 'ti ti-receipt';
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  return (
    <div className="view active" id="view-history">
      <form onSubmit={handleSearch} style={{ marginBottom: '2rem' }}>
        <div className="form-group">
          <label htmlFor="history-matric">Find your payment records</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              id="history-matric"
              placeholder="Enter Matric Number (e.g. FUT/CSC/20/0034)"
              value={matric}
              onChange={(e) => setMatric(e.target.value)}
              style={{ flex: 1 }}
              required
            />
            <button
              type="submit"
              className="pay-btn"
              disabled={loading}
              style={{ width: 'auto', marginTop: 0, padding: '10px 24px' }}
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </div>
        </div>
      </form>

      {error && (
        <div style={{ color: 'var(--color-text-warning)', marginBottom: '1rem', fontSize: '14px', fontWeight: 500 }}>
          {error}
        </div>
      )}

      {historyData && (
        <>
          <div className="summary-grid">
            <div className="stat">
              <div className="stat-label">Total paid</div>
              <div className="stat-val blue">
                ₦{historyData.summary.totalPaidNaira.toLocaleString('en-NG', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="stat">
              <div className="stat-label">Payments made</div>
              <div className="stat-val">{historyData.summary.count}</div>
            </div>
            <div className="stat">
              <div className="stat-label">Successful</div>
              <div className="stat-val" style={{ color: 'var(--color-text-success)' }}>
                {historyData.summary.successCount}
              </div>
            </div>
          </div>

          <div className="section">
            <div className="section-title">Transactions list</div>
            
            {historyData.payments.length === 0 ? (
              <div style={{ padding: '24px 0', textColor: 'var(--color-text-secondary)', textAlign: 'center', fontSize: '14px' }}>
                No records found for this matric number.
              </div>
            ) : (
              historyData.payments.map((payment) => (
                <div key={payment.id || payment._id || payment.reference} className="history-row">
                  <div className={getIconClass(payment.paymentType)}>
                    <i className={getIcon(payment.paymentType)} aria-hidden="true"></i>
                  </div>
                  <div className="hist-meta">
                    <strong>{payment.paymentLabel} — {payment.session}</strong>
                    <span>{formatDate(payment.paidAt || payment.createdAt)} · REF: {payment.reference}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="hist-amount">
                      ₦{(payment.totalKobo / 100).toLocaleString('en-NG', { minimumFractionDigits: 2 })}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'flex-end' }}>
                      <span className={`hist-status ${payment.status}`}>
                        {payment.status === 'success' ? 'Paid' : payment.status}
                      </span>
                      {payment.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleVerify(payment.reference)}
                          disabled={verifyingMap[payment.reference]}
                          style={{
                            padding: '3px 8px',
                            fontSize: '11px',
                            border: '1px solid var(--color-border-secondary)',
                            borderRadius: '4px',
                            background: '#fff',
                            cursor: 'pointer',
                            color: 'var(--brand)',
                            fontWeight: 600
                          }}
                        >
                          {verifyingMap[payment.reference] ? 'Verifying...' : 'Verify'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {!historyData && !loading && (
        <div style={{ textAlign: 'center', padding: '3rem 0', color: 'var(--color-text-secondary)', border: '1px dashed var(--color-border-secondary)', borderRadius: 'var(--border-radius-lg)', background: '#fff' }}>
          <i className="ti ti-receipt" style={{ fontSize: '32px', display: 'block', marginBottom: '12px', color: 'var(--color-border-secondary)' }}></i>
          Enter your student matric number above to display transaction history.
        </div>
      )}
    </div>
  );
}
