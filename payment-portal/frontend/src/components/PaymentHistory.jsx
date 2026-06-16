import React, { useState, useEffect } from 'react';

export default function PaymentHistory({ sessionMatric, sessionToken }) {
  const [loading, setLoading] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [error, setError] = useState('');
  const [verifyingMap, setVerifyingMap] = useState({});

  useEffect(() => {
    if (sessionMatric) {
      fetchHistory();
    }
  }, [sessionMatric]);

  const fetchHistory = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/payments/history/${encodeURIComponent(sessionMatric)}`);
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
        fetchHistory();
      } else {
        alert(`Verification update: ${resData.message}`);
        fetchHistory();
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

  if (loading && !historyData) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem 0' }}>
        <span className="spinner large"></span>
        <p style={{ marginTop: '12px', color: 'var(--color-text-secondary)' }}>Loading payment history...</p>
      </div>
    );
  }

  return (
    <div className="view active" id="view-history">
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
              <div style={{ padding: '24px 0', color: 'var(--color-text-secondary)', textAlign: 'center', fontSize: '14px' }}>
                No records found for your matric number.
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
                      
                      {payment.status === 'success' && (
                        <a
                          href={`/api/payments/receipt/${payment.reference}/pdf`}
                          download={`receipt_${payment.reference}.pdf`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            fontSize: '11px',
                            border: '1px solid var(--brand)',
                            borderRadius: '4px',
                            background: 'var(--color-background-info)',
                            cursor: 'pointer',
                            color: 'var(--brand)',
                            fontWeight: 600,
                            textDecoration: 'none'
                          }}
                        >
                          <i className="ti ti-download" style={{ fontSize: '12px' }}></i> PDF
                        </a>
                      )}

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
    </div>
  );
}
