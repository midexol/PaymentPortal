import React, { useState, useEffect } from 'react';

export default function AdminLedger({ fetch, token }) {
  const [payments, setPayments] = useState([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtering states
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    paymentType: '',
    session: '',
    startDate: '',
    endDate: ''
  });

  // Modal inspection states
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState('');

  const loadLedger = async (pageNumber = 1) => {
    setLoading(true);
    setError('');
    try {
      const queryParams = new URLSearchParams({
        page: pageNumber,
        limit: 20,
        ...filters
      });
      const response = await fetch(`/api/admin/payments?${queryParams.toString()}`);
      const data = await response.json();
      if (data.success) {
        setPayments(data.data.payments);
        setPagination(data.data.pagination);
      } else {
        setError(data.message || 'Failed to retrieve transactions.');
      }
    } catch (err) {
      setError('An error occurred while loading transactions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Debounce search/filter changes slightly
    const timer = setTimeout(() => {
      loadLedger(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [filters]);

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value });
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      status: '',
      paymentType: '',
      session: '',
      startDate: '',
      endDate: ''
    });
  };

  const handleViewDetails = async (paymentId) => {
    setModalLoading(true);
    setModalError('');
    setSelectedPayment({ _id: paymentId, studentName: 'Loading...' }); // Temporary skeleton placeholder
    try {
      const response = await fetch(`/api/admin/payments/${paymentId}`);
      const data = await response.json();
      if (data.success) {
        setSelectedPayment(data.data);
      } else {
        setModalError(data.message || 'Failed to fetch payment details.');
      }
    } catch (err) {
      setModalError('Failed to fetch detailed payment data.');
    } finally {
      setModalLoading(false);
    }
  };

  const handleExportPDF = async () => {
    try {
      const queryParams = new URLSearchParams({
        status: filters.status,
        paymentType: filters.paymentType,
        session: filters.session,
        startDate: filters.startDate,
        endDate: filters.endDate,
        search: filters.search
      });
      
      const activeToken = token || sessionStorage.getItem('adminToken');
      const response = await window.fetch(`/api/admin/payments/export-pdf?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to export PDF file.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payment-records-${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'An error occurred during PDF export.');
    }
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
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="admin-ledger-layout">
      {/* Filtering Panel */}
      <div className="ledger-filters-card">
        <div className="search-bar">
          <i className="ti ti-search search-icon"></i>
          <input
            type="text"
            name="search"
            placeholder="Search student name, email, matriculation number, or transaction reference..."
            value={filters.search}
            onChange={handleFilterChange}
          />
        </div>
        <div className="filters-grid">
          <div className="filter-item">
            <label>Status</label>
            <select name="status" value={filters.status} onChange={handleFilterChange}>
              <option value="">All Statuses</option>
              <option value="success">Success</option>
              <option value="pending">Pending</option>
              <option value="failed">Failed</option>
              <option value="abandoned">Abandoned</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Payment Category</label>
            <select name="paymentType" value={filters.paymentType} onChange={handleFilterChange}>
              <option value="">All Types</option>
              <option value="fees">Tuition & Fees</option>
              <option value="hostel">Hostel Accommodation</option>
              <option value="exam">Examination Fees</option>
              <option value="library">Library Fines</option>
              <option value="sport">Sports & Recreation</option>
              <option value="other">Others</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Academic Session</label>
            <select name="session" value={filters.session} onChange={handleFilterChange}>
              <option value="">All Sessions</option>
              <option value="2023/2024">2023/2024</option>
              <option value="2024/2025">2024/2025</option>
              <option value="2025/2026">2025/2026</option>
            </select>
          </div>

          <div className="filter-item">
            <label>Start Date</label>
            <input
              type="date"
              name="startDate"
              value={filters.startDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-item">
            <label>End Date</label>
            <input
              type="date"
              name="endDate"
              value={filters.endDate}
              onChange={handleFilterChange}
            />
          </div>

          <div className="filter-actions">
            <button className="btn btn-secondary" onClick={clearFilters}>
              Clear Filters
            </button>
            <button className="btn btn-primary" onClick={handleExportPDF}>
              <i className="ti ti-download"></i> Export PDF Report
            </button>
          </div>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="ledger-table-card">
        {loading ? (
          <div className="table-loading">
            <span className="spinner"></span>
            <p>Loading transactions...</p>
          </div>
        ) : error ? (
          <div className="table-error">
            <i className="ti ti-alert-circle"></i>
            <p>{error}</p>
          </div>
        ) : payments.length === 0 ? (
          <div className="table-empty">
            <i className="ti ti-folder-open"></i>
            <p>No transaction records found matching your filters.</p>
          </div>
        ) : (
          <>
            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Reference</th>
                    <th>Student Name</th>
                    <th>Matric No</th>
                    <th>Category</th>
                    <th>Session</th>
                    <th>Total Paid</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((p) => (
                    <tr key={p._id}>
                      <td className="font-mono">{p.reference}</td>
                      <td>
                        <span className="student-name">{p.studentName}</span>
                        <span className="student-email">{p.email}</span>
                      </td>
                      <td className="font-mono">{p.matricNumber}</td>
                      <td>{p.paymentLabel}</td>
                      <td>{p.session}</td>
                      <td className="amount">{formatCurrency(p.totalKobo / 100)}</td>
                      <td>
                        <span className={`status-badge ${p.status}`}>
                          {p.status}
                        </span>
                      </td>
                      <td>{formatDate(p.createdAt)}</td>
                      <td>
                        <button
                          className="btn-action-view"
                          onClick={() => handleViewDetails(p._id)}
                          title="Audit transaction"
                        >
                          <i className="ti ti-eye"></i>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination controls */}
            <div className="ledger-pagination">
              <div className="pagination-info">
                Showing <strong>{(pagination.page - 1) * pagination.limit + 1}</strong> to{' '}
                <strong>
                  {Math.min(pagination.page * pagination.limit, pagination.total)}
                </strong>{' '}
                of <strong>{pagination.total}</strong> entries
              </div>
              <div className="pagination-buttons">
                <button
                  disabled={pagination.page <= 1}
                  onClick={() => loadLedger(pagination.page - 1)}
                  className="btn btn-secondary btn-sm"
                >
                  <i className="ti ti-chevron-left"></i> Previous
                </button>
                <span className="page-indicator">
                  Page <strong>{pagination.page}</strong> of <strong>{pagination.pages}</strong>
                </span>
                <button
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => loadLedger(pagination.page + 1)}
                  className="btn btn-secondary btn-sm"
                >
                  Next <i className="ti ti-chevron-right"></i>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transaction Inspection Modal Overlay */}
      {selectedPayment && (
        <div className="modal-backdrop" onClick={() => setSelectedPayment(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Audit Payment: {selectedPayment.reference}</h3>
              <button className="modal-close" onClick={() => setSelectedPayment(null)}>
                &times;
              </button>
            </div>
            
            <div className="modal-body">
              {modalLoading ? (
                <div className="modal-loading">
                  <span className="spinner"></span>
                  <p>Retrieving transaction details...</p>
                </div>
              ) : modalError ? (
                <div className="modal-error">
                  <i className="ti ti-alert-triangle"></i>
                  <p>{modalError}</p>
                </div>
              ) : (
                <div className="audit-details">
                  <div className="audit-section">
                    <h4>Student Information</h4>
                    <div className="audit-grid">
                      <div><span className="label">Name:</span> <strong>{selectedPayment.studentName}</strong></div>
                      <div><span className="label">Matric No:</span> <strong className="font-mono">{selectedPayment.matricNumber}</strong></div>
                      <div><span className="label">Email:</span> <span>{selectedPayment.email}</span></div>
                      <div><span className="label">Phone:</span> <span>{selectedPayment.phone || 'N/A'}</span></div>
                      <div><span className="label">Department:</span> <span>{selectedPayment.department || 'N/A'}</span></div>
                      <div><span className="label">Level:</span> <span>{selectedPayment.level ? `${selectedPayment.level}L` : 'N/A'}</span></div>
                    </div>
                  </div>

                  <div className="audit-section">
                    <h4>Billing Parameters</h4>
                    <div className="audit-grid">
                      <div><span className="label">Category:</span> <span>{selectedPayment.paymentLabel}</span></div>
                      <div><span className="label">Session:</span> <span>{selectedPayment.session}</span></div>
                      <div><span className="label">Amount:</span> <span>{formatCurrency(selectedPayment.amountKobo / 100)}</span></div>
                      <div><span className="label">Service Charge:</span> <span>{formatCurrency(selectedPayment.chargeKobo / 100)}</span></div>
                      <div><span className="label">Total Paid:</span> <strong className="text-primary">{formatCurrency(selectedPayment.totalKobo / 100)}</strong></div>
                    </div>
                  </div>

                  <div className="audit-section">
                    <h4>Gateway & Status</h4>
                    <div className="audit-grid">
                      <div>
                        <span className="label">Payment Status:</span>{' '}
                        <span className={`status-badge ${selectedPayment.status}`}>
                          {selectedPayment.status}
                        </span>
                      </div>
                      <div><span className="label">Channel:</span> <span className="text-capitalize">{selectedPayment.channel || 'N/A'}</span></div>
                      <div><span className="label">Paid At:</span> <span>{formatDate(selectedPayment.paidAt)}</span></div>
                      <div><span className="label">Created At:</span> <span>{formatDate(selectedPayment.createdAt)}</span></div>
                    </div>
                  </div>

                  {selectedPayment.paystackData && (
                    <div className="audit-section full-width">
                      <h4>Raw Paystack Webhook Payload</h4>
                      <details className="raw-json-details">
                        <summary>Click to expand raw validation logs</summary>
                        <pre className="raw-json-pre">
                          {JSON.stringify(selectedPayment.paystackData, null, 2)}
                        </pre>
                      </details>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedPayment(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
