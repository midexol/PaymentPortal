import React, { useState, useEffect } from 'react';

export default function AdminOverview({ fetch }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/dashboard');
      const data = await response.json();
      if (data.success) {
        setStats(data.data);
      } else {
        setError(data.message || 'Failed to retrieve metrics.');
      }
    } catch (err) {
      setError('An error occurred while loading dashboard aggregates.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

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
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="admin-loading-container">
        <span className="spinner large"></span>
        <p>Loading dashboard aggregates...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-error-container">
        <i className="ti ti-alert-triangle error-icon"></i>
        <h3>Failed to load metrics</h3>
        <p>{error}</p>
        <button onClick={loadStats} className="btn btn-secondary">
          <i className="ti ti-reload"></i> Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="admin-overview-layout">
      {/* 4 Stats Cards */}
      <div className="stats-grid">
        <div className="stats-card">
          <div className="stats-card-header">
            <span className="card-title">All-Time Revenue</span>
            <div className="card-icon alltime">
              <i className="ti ti-cash"></i>
            </div>
          </div>
          <div className="stats-card-value">
            {formatCurrency(stats?.allTime?.totalNaira || 0)}
          </div>
          <div className="stats-card-sub">
            <strong>{stats?.allTime?.count || 0}</strong> successful transactions
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="card-title">This Month</span>
            <div className="card-icon month">
              <i className="ti ti-calendar-stats"></i>
            </div>
          </div>
          <div className="stats-card-value">
            {formatCurrency(stats?.thisMonth?.totalNaira || 0)}
          </div>
          <div className="stats-card-sub">
            <strong>{stats?.thisMonth?.count || 0}</strong> payments this month
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="card-title">Today's Revenue</span>
            <div className="card-icon today">
              <i className="ti ti-chart-bar"></i>
            </div>
          </div>
          <div className="stats-card-value">
            {formatCurrency(stats?.today?.totalNaira || 0)}
          </div>
          <div className="stats-card-sub">
            <strong>{stats?.today?.count || 0}</strong> payments completed today
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="card-title">Pending Orders</span>
            <div className="card-icon pending">
              <i className="ti ti-clock"></i>
            </div>
          </div>
          <div className="stats-card-value">
            {stats?.pendingCount || 0}
          </div>
          <div className="stats-card-sub">
            Awaiting checkout completion
          </div>
        </div>
      </div>

      <div className="overview-two-column">
        {/* Collection Breakdown by Payment Type */}
        <div className="grid-panel">
          <div className="panel-header">
            <h3>Collection Breakdown</h3>
            <i className="ti ti-pie-chart panel-icon"></i>
          </div>
          <div className="panel-body">
            {stats?.byType && stats.byType.length > 0 ? (
              <div className="breakdown-list">
                {stats.byType.map((item) => (
                  <div key={item._id} className="breakdown-item">
                    <div className="breakdown-info">
                      <span className="breakdown-label">{item.label || item._id}</span>
                      <span className="breakdown-count">{item.count} payments</span>
                    </div>
                    <div className="breakdown-value-bar">
                      <span className="breakdown-amount">
                        {formatCurrency(item.totalKobo / 100)}
                      </span>
                      <div className="progress-bar-container">
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            width: `${stats?.allTime?.totalNaira > 0 
                              ? ((item.totalKobo / 100) / stats.allTime.totalNaira) * 100 
                              : 0}%` 
                          }}
                        ></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel-state">
                <i className="ti ti-folder-open"></i>
                <p>No categorizations recorded.</p>
              </div>
            )}
          </div>
        </div>

        {/* 10 Most Recent Payments */}
        <div className="grid-panel">
          <div className="panel-header">
            <h3>Recent Success Log</h3>
            <i className="ti ti-activity-heartbeat panel-icon"></i>
          </div>
          <div className="panel-body">
            {stats?.recentPayments && stats.recentPayments.length > 0 ? (
              <div className="recent-payments-list">
                {stats.recentPayments.map((p) => (
                  <div key={p._id} className="recent-payment-row">
                    <div className="payment-main">
                      <div className="avatar">
                        {p.studentName.charAt(0).toUpperCase()}
                      </div>
                      <div className="details">
                        <span className="name">{p.studentName}</span>
                        <span className="reference">Ref: {p.reference}</span>
                      </div>
                    </div>
                    <div className="payment-meta">
                      <span className="amount">
                        {formatCurrency(p.totalKobo / 100)}
                      </span>
                      <span className="date">{formatDate(p.paidAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-panel-state">
                <i className="ti ti-folder-open"></i>
                <p>No recent transactions found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
