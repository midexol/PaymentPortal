import React, { useState, useEffect } from 'react';

export default function AdminLogin({ onLoginSuccess, onNavigate }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [requiresSetup, setRequiresSetup] = useState(false);

  // Check if system requires setup on load
  useEffect(() => {
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/admin/setup-status');
        const data = await response.json();
        if (data.success && data.requiresSetup) {
          setRequiresSetup(true);
        }
      } catch (err) {
        console.error('Failed to check setup status:', err);
      }
    };
    checkSetup();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Invalid email or password.');
      }

      // Store token securely in sessionStorage (cleared when browser/tab closes)
      sessionStorage.setItem('adminToken', data.token);
      sessionStorage.setItem('adminUser', JSON.stringify(data.admin));

      onLoginSuccess(data.token, data.admin);
    } catch (err) {
      setError(err.message || 'Failed to authenticate.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-icon">
            <i className="ti ti-shield"></i>
          </div>
          <h2>Staff Portal</h2>
          <p>Sign in to access the administrator dashboard.</p>
        </div>

        {requiresSetup && (
          <div className="auth-alert info">
            <i className="ti ti-info-circle"></i>
            <div>
              <strong>First time configuration?</strong><br />
              <button 
                type="button" 
                className="btn-link"
                onClick={() => onNavigate('/admin/setup')}
              >
                Run initial setup wizard now &rarr;
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="auth-alert error">
            <i className="ti ti-alert-circle"></i>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <i className="ti ti-mail input-icon"></i>
              <input
                type="email"
                id="email"
                placeholder="admin@institution.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-wrapper">
              <i className="ti ti-lock input-icon"></i>
              <input
                type="password"
                id="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span> Logging in...
              </>
            ) : (
              'Access Dashboard'
            )}
          </button>
        </form>

        <div className="auth-footer">
          <button 
            type="button" 
            className="btn-back-portal"
            onClick={() => onNavigate('/')}
          >
            <i className="ti ti-arrow-left"></i> Return to student portal
          </button>
        </div>
      </div>
    </div>
  );
}
