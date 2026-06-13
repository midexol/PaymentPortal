import React, { useState, useEffect } from 'react';
import AdminOverview from './AdminOverview';
import AdminLedger from './AdminLedger';
import AdminSettings from './AdminSettings';

export default function AdminDashboard({ token, admin, onLogout, onNavigate }) {
  const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'ledger', 'settings'
  const [adminUser, setAdminUser] = useState(admin);

  useEffect(() => {
    if (!adminUser) {
      const storedUser = sessionStorage.getItem('adminUser');
      if (storedUser) {
        setAdminUser(JSON.parse(storedUser));
      }
    }
  }, [adminUser]);

  const handleLogoutClick = () => {
    sessionStorage.removeItem('adminToken');
    sessionStorage.removeItem('adminUser');
    onLogout();
  };

  // Secured fetch wrapper to intercept 401s and log out
  const authenticatedFetch = async (url, options = {}) => {
    const activeToken = token || sessionStorage.getItem('adminToken');
    if (!activeToken) {
      handleLogoutClick();
      throw new Error('No token available.');
    }

    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${activeToken}`,
      'Content-Type': 'application/json'
    };

    try {
      const response = await fetch(url, { ...options, headers });
      if (response.status === 401) {
        handleLogoutClick();
        throw new Error('Session expired.');
      }
      return response;
    } catch (err) {
      if (err.message === 'Session expired.') {
        alert('Your session has expired. Please log in again.');
      }
      throw err;
    }
  };

  return (
    <div className="admin-layout">
      {/* Sidebar navigation */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-logo">
            <i className="ti ti-shield-lock"></i>
          </div>
          <div>
            <h3>Billing Admin</h3>
            <p>Institutional System</p>
          </div>
        </div>

        <div className="admin-user-profile">
          <div className="avatar">
            {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : 'A'}
          </div>
          <div className="user-details">
            <span className="user-name">{adminUser?.name || 'Administrator'}</span>
            <span className="user-role">
              {adminUser?.role === 'superadmin' ? 'Super Admin' : 'Finance Officer'}
            </span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            <i className="ti ti-dashboard"></i>
            <span>Overview</span>
          </button>
          
          <button
            className={`nav-item ${activeTab === 'ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('ledger')}
          >
            <i className="ti ti-receipt"></i>
            <span>Transaction Ledger</span>
          </button>
          
          <button
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <i className="ti ti-settings"></i>
            <span>System Settings</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item logout-btn" onClick={handleLogoutClick}>
            <i className="ti ti-logout"></i>
            <span>Logout</span>
          </button>
          <button className="nav-item back-portal-btn" onClick={() => onNavigate('/')}>
            <i className="ti ti-arrow-left"></i>
            <span>Student Portal</span>
          </button>
        </div>
      </aside>

      {/* Main dashboard content panel */}
      <main className="admin-main">
        <header className="admin-header">
          <div className="header-title">
            <h2>
              {activeTab === 'overview' && 'System Overview'}
              {activeTab === 'ledger' && 'Transaction Ledger'}
              {activeTab === 'settings' && 'System Settings'}
            </h2>
            <p>
              {activeTab === 'overview' && 'Real-time billing activity and aggregates'}
              {activeTab === 'ledger' && 'Search and audit student payments'}
              {activeTab === 'settings' && 'Triggers and manual control center'}
            </p>
          </div>
          <div className="header-status">
            <span className="status-indicator online"></span>
            <span>Live DB Sync</span>
          </div>
        </header>

        <div className="admin-content">
          {activeTab === 'overview' && (
            <AdminOverview fetch={authenticatedFetch} />
          )}
          {activeTab === 'ledger' && (
            <AdminLedger fetch={authenticatedFetch} token={token} />
          )}
          {activeTab === 'settings' && (
            <AdminSettings fetch={authenticatedFetch} admin={adminUser} />
          )}
        </div>
      </main>
    </div>
  );
}
