import React, { useState } from 'react';

export default function AdminSetup({ onNavigate }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    secretKey: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const { name, email, password, confirmPassword, secretKey } = formData;

    if (!name || !email || !password || !confirmPassword || !secretKey) {
      setError('All fields are required.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/admin/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password, secretKey })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Setup registration failed.');
      }

      setSuccess('Superadmin registered successfully! Redirecting to login...');
      setTimeout(() => {
        onNavigate('/admin/login');
      }, 2500);
    } catch (err) {
      setError(err.message || 'An error occurred during setup.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="logo-icon">
            <i className="ti ti-shield-lock"></i>
          </div>
          <h2>System Setup</h2>
          <p>Register the initial Superadmin account to initialize the system.</p>
        </div>

        {error && (
          <div className="auth-alert error">
            <i className="ti ti-alert-circle"></i>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="auth-alert success">
            <i className="ti ti-circle-check"></i>
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <div className="input-wrapper">
              <i className="ti ti-user input-icon"></i>
              <input
                type="text"
                id="name"
                name="name"
                placeholder="e.g. Admin User"
                value={formData.name}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-wrapper">
              <i className="ti ti-mail input-icon"></i>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="admin@institution.edu"
                value={formData.email}
                onChange={handleChange}
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
                name="password"
                placeholder="Minimum 8 characters"
                value={formData.password}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-wrapper">
              <i className="ti ti-lock input-icon"></i>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="secretKey">System Security Key</label>
            <div className="input-wrapper">
              <i className="ti ti-key input-icon"></i>
              <input
                type="password"
                id="secretKey"
                name="secretKey"
                placeholder="Enter ADMIN_JWT_SECRET from .env"
                value={formData.secretKey}
                onChange={handleChange}
                disabled={loading}
                required
              />
            </div>
            <small className="help-text">
              Verifies you have file-system access to the host server configuration.
            </small>
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? (
              <>
                <span className="spinner"></span> Initializing...
              </>
            ) : (
              'Initialize Admin Portal'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
