import React, { useState } from 'react';

export default function AdminSettings({ fetch, admin }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState(''); // 'success' or 'error'

  const handleSendDigest = async () => {
    setLoading(true);
    setMessage('');
    setStatus('');
    try {
      const response = await fetch('/api/admin/digest', {
        method: 'POST'
      });
      const data = await response.json();
      if (data.success) {
        setStatus('success');
        setMessage(data.message || 'Daily digest email successfully sent!');
      } else {
        setStatus('error');
        setMessage(data.message || 'Failed to send daily digest.');
      }
    } catch (err) {
      setStatus('error');
      setMessage('An error occurred while attempting to send the digest.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-settings-layout">
      <div className="settings-card">
        <div className="settings-card-header">
          <div className="icon-wrapper">
            <i className="ti ti-mail-forward"></i>
          </div>
          <div className="title-desc">
            <h3>Daily Financial Digest</h3>
            <p>Generate and dispatch a summary report of today's success transactions.</p>
          </div>
        </div>

        <div className="settings-card-body">
          <div className="info-box">
            <i className="ti ti-info-circle"></i>
            <p>
              The system automatically sends daily audits, but you can use this button to force
              an immediate email digest to your registered address:{' '}
              <strong>{admin?.email || 'admin@institution.edu'}</strong>.
            </p>
          </div>

          {message && (
            <div className={`auth-alert ${status === 'success' ? 'success' : 'error'}`}>
              <i className={status === 'success' ? 'ti ti-circle-check' : 'ti ti-alert-circle'}></i>
              <span>{message}</span>
            </div>
          )}

          <button
            onClick={handleSendDigest}
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner"></span> Dispatching Digest...
              </>
            ) : (
              <>
                <i className="ti ti-send"></i> Dispatch Digest Email
              </>
            )}
          </button>
        </div>
      </div>

      <div className="settings-card security-info">
        <div className="settings-card-header">
          <div className="icon-wrapper sec">
            <i className="ti ti-shield-check"></i>
          </div>
          <div className="title-desc">
            <h3>Security Architecture</h3>
            <p>Administrative safety controls in effect.</p>
          </div>
        </div>
        <div className="settings-card-body">
          <ul className="security-list">
            <li>
              <div className="sec-title">
                <span className="bullet"></span> JWT Authentication
              </div>
              <div className="sec-desc">
                Access tokens are signed using a secure algorithm and expire after 8 hours. Tokens are stored in session memory to mitigate Cross-Site Scripting (XSS) extraction risks.
              </div>
            </li>
            <li>
              <div className="sec-title">
                <span className="bullet"></span> Bootstrap Registration Lock
              </div>
              <div className="sec-desc">
                Public registration routes are automatically blocked once the first admin account is seeded. Additional admin accounts can only be authorized by an existing active Super Admin.
              </div>
            </li>
            <li>
              <div className="sec-title">
                <span className="bullet"></span> Rate Limiting
              </div>
              <div className="sec-desc">
                Brute-force security limiting is configured on all login entry points, rejecting repeated automated requests.
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
