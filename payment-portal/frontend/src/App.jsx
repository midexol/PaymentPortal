import React, { useState, useEffect } from 'react';
import './App.css';
import StudentInfoForm from './components/StudentInfoForm';
import PaymentTypeSelector from './components/PaymentTypeSelector';
import PaymentSummary from './components/PaymentSummary';
import PaymentHistory from './components/PaymentHistory';
import PaymentVerify from './components/PaymentVerify';

// Admin Components
import AdminSetup from './components/admin/AdminSetup';
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';

export default function App() {
  // Path routing state
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [adminToken, setAdminToken] = useState(sessionStorage.getItem('adminToken') || null);
  const [adminUser, setAdminUser] = useState(() => {
    const storedUser = sessionStorage.getItem('adminUser');
    return storedUser ? JSON.parse(storedUser) : null;
  });

  // Student portal session states
  const [sessionMatric, setSessionMatric] = useState(sessionStorage.getItem('studentMatric') || '');
  const [sessionToken, setSessionToken] = useState(sessionStorage.getItem('studentToken') || '');

  // Student portal navigation/wizard states
  const [activeTab, setActiveTab] = useState('pay'); // 'pay' or 'history'
  const [paneStep, setPaneStep] = useState(1); // 1, 2, or 3
  
  const [studentDetails, setStudentDetails] = useState(() => {
    const stored = sessionStorage.getItem('studentDetails');
    if (stored) return JSON.parse(stored);
    return {
      studentName: '',
      matricNumber: sessionStorage.getItem('studentMatric') || '',
      email: '',
      phone: '',
      department: 'Software and Web Development',
      level: ''
    };
  });

  const [selectedTypes, setSelectedTypes] = useState(['dept_due']);
  const [session, setSession] = useState('2024/2025');

  // Access Gate states
  const [gateMatric, setGateMatric] = useState('');
  const [gateCode, setGateCode] = useState('');
  const [gateStep, setGateStep] = useState(1); // 1: Enter Matric, 2: Enter OTP
  const [gateError, setGateError] = useState('');
  const [gateLoading, setGateLoading] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState('');

  // Sync state with back/forward history events
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (path) => {
    window.history.pushState(null, '', path);
    setCurrentPath(path);
  };

  // Redirect guard for unauthenticated admin access
  useEffect(() => {
    if (
      currentPath.startsWith('/admin') &&
      currentPath !== '/admin/login' &&
      currentPath !== '/admin/setup' &&
      !adminToken
    ) {
      navigate('/admin/login');
    }
  }, [currentPath, adminToken]);

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
  };

  // ─── ACCESS GATE SUBMISSIONS ─────────────────────────────────────────────────
  const handleAccessSubmit = async (e) => {
    e.preventDefault();
    if (!gateMatric.trim()) return;

    // Validate matric format strictly
    const matricRegex = /^FPA\/SW\/[0-9]{2}\/[0-9]+-[0-9]{4}$/i;
    if (!matricRegex.test(gateMatric.trim())) {
      setGateError('Invalid Matric format. Must match format FPA/SW/YY/X-NNNN (e.g. FPA/SW/19/3-0001).');
      return;
    }

    setGateLoading(true);
    setGateError('');
    try {
      const response = await fetch('/api/payments/session/access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: gateMatric.trim() })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        if (data.verified) {
          // New student, bypassed verification directly
          const newDetails = {
            studentName: '',
            matricNumber: gateMatric.trim().toUpperCase(),
            email: '',
            phone: '',
            department: 'Software and Web Development',
            level: ''
          };
          sessionStorage.setItem('studentMatric', gateMatric.trim().toUpperCase());
          sessionStorage.setItem('studentDetails', JSON.stringify(newDetails));
          setSessionMatric(gateMatric.trim().toUpperCase());
          setStudentDetails(newDetails);
        } else {
          // OTP code sent
          setMaskedEmail(data.emailMasked);
          setGateStep(2);
        }
      } else {
        setGateError(data.message || 'Access request failed.');
      }
    } catch (err) {
      console.error(err);
      setGateError('Could not connect to the backend server. Please try again.');
    } finally {
      setGateLoading(false);
    }
  };

  const handleVerifySubmit = async (e) => {
    e.preventDefault();
    if (!gateCode.trim()) return;

    setGateLoading(true);
    setGateError('');
    try {
      const response = await fetch('/api/payments/session/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricNumber: gateMatric.trim(), code: gateCode.trim() })
      });
      const data = await response.json();

      if (response.ok && data.success) {
        // Unlocked session
        const fullDetails = {
          studentName: data.studentDetails.studentName,
          matricNumber: gateMatric.trim().toUpperCase(),
          email: data.studentDetails.email,
          phone: data.studentDetails.phone || '',
          department: data.studentDetails.department || 'Software and Web Development',
          level: data.studentDetails.level || 'HND I'
        };
        sessionStorage.setItem('studentMatric', gateMatric.trim().toUpperCase());
        sessionStorage.setItem('studentToken', data.token);
        sessionStorage.setItem('studentDetails', JSON.stringify(fullDetails));
        setSessionMatric(gateMatric.trim().toUpperCase());
        setSessionToken(data.token);
        setStudentDetails(fullDetails);
      } else {
        setGateError(data.message || 'Verification failed. Incorrect code.');
      }
    } catch (err) {
      console.error(err);
      setGateError('Could not connect to the backend server. Please try again.');
    } finally {
      setGateLoading(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('studentMatric');
    sessionStorage.removeItem('studentToken');
    sessionStorage.removeItem('studentDetails');
    setSessionMatric('');
    setSessionToken('');
    setGateMatric('');
    setGateCode('');
    setGateStep(1);
    setStudentDetails({
      studentName: '',
      matricNumber: '',
      email: '',
      phone: '',
      department: 'Software and Web Development',
      level: ''
    });
    setPaneStep(1);
    setActiveTab('pay');
  };

  // ─── ADMIN FLOW ROUTING ──────────────────────────────────────────────────────
  if (currentPath.startsWith('/admin')) {
    if (currentPath === '/admin/setup') {
      return <AdminSetup onNavigate={navigate} />;
    }
    
    if (currentPath === '/admin/login') {
      return (
        <AdminLogin
          onLoginSuccess={(token, admin) => {
            setAdminToken(token);
            setAdminUser(admin);
            navigate('/admin');
          }}
          onNavigate={navigate}
        />
      );
    }

    // Default authenticated path /admin
    if (adminToken) {
      return (
        <AdminDashboard
          token={adminToken}
          admin={adminUser}
          onLogout={() => {
            setAdminToken(null);
            setAdminUser(null);
            navigate('/admin/login');
          }}
          onNavigate={navigate}
        />
      );
    }

    // Guard will redirect to /admin/login via the useEffect, render a loading fallback
    return (
      <div className="admin-loading-container">
        <span className="spinner large"></span>
        <p>Verifying admin session...</p>
      </div>
    );
  }

  // ─── PAYMENT VERIFICATION FLOW ──────────────────────────────────────────────
  if (currentPath.startsWith('/payment/verify')) {
    return (
      <div className="portal-container">
        <div className="portal">
          <PaymentVerify onNavigate={navigate} />
        </div>
      </div>
    );
  }

  // ─── STUDENT PORTAL FLOW ────────────────────────────────────────────────────
  return (
    <div className="portal-container">
      <div className="portal">
        <h2 className="sr-only">Payment Portal</h2>

        {/* Portal Header */}
        <div className="header">
          <div className="logo">
            <i className="ti ti-building-bank" aria-hidden="true"></i>
          </div>
          <div className="header-text">
            <h1>Payment Portal</h1>
            <p>Institutional Billing System</p>
          </div>
          {sessionMatric ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: 'auto' }}>
              <span className="badge" style={{ margin: 0 }}>
                <i className="ti ti-circle-check" aria-hidden="true"></i> Secured
              </span>
              <button
                onClick={handleLogout}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--brand)',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '2px 4px',
                  borderRadius: '4px',
                  textDecoration: 'underline'
                }}
              >
                Exit Session ({sessionMatric})
              </button>
            </div>
          ) : (
            <span className="badge">
              <i className="ti ti-lock" aria-hidden="true"></i> Protected Mode
            </span>
          )}
        </div>

        {/* Access Gate Screen if not logged in */}
        {!sessionMatric ? (
          <div className="view active">
            <div className="section">
              <div className="section-title">
                {gateStep === 1 ? 'Access Student Portal' : 'Security Check'}
              </div>
              
              {gateError && (
                <div style={{ color: 'var(--color-text-warning)', marginBottom: '1.25rem', fontSize: '13px', fontWeight: 500 }}>
                  <i className="ti ti-alert-circle" style={{ marginRight: '6px' }}></i> {gateError}
                </div>
              )}

              {gateStep === 1 ? (
                <form onSubmit={handleAccessSubmit}>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="gate-matric">Student Matriculation Number</label>
                    <input
                      type="text"
                      id="gate-matric"
                      placeholder="e.g. FPA/SW/19/3-0001"
                      value={gateMatric}
                      onChange={(e) => setGateMatric(e.target.value)}
                      required
                      style={{ width: '100%', boxSizing: 'border-box' }}
                    />
                    <small style={{ display: 'block', marginTop: '6px', color: 'var(--color-text-secondary)', fontSize: '11px', lineHeight: 1.4 }}>
                      Please enter your matriculation number. If you have existing records, a one-time verification link will be sent to your registered email for privacy.
                    </small>
                  </div>
                  <button type="submit" className="pay-btn" disabled={gateLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {gateLoading ? <span className="spinner"></span> : <i className="ti ti-shield-lock"></i>}
                    <span>{gateLoading ? 'Validating...' : 'Access Portal'}</span>
                  </button>
                </form>
              ) : (
                <form onSubmit={handleVerifySubmit}>
                  <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                    <label htmlFor="gate-code">6-Digit Access Code</label>
                    <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', margin: '0 0 16px 0', lineHeight: 1.45 }}>
                      Existing records found. A 6-digit access code has been sent to your registered email: <strong style={{ color: 'var(--color-text-primary)' }}>{maskedEmail}</strong>.
                    </p>
                    <input
                      type="text"
                      id="gate-code"
                      placeholder="XXXXXX"
                      value={gateCode}
                      onChange={(e) => setGateCode(e.target.value)}
                      maxLength={6}
                      required
                      style={{ width: '100%', boxSizing: 'border-box', letterSpacing: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '18px' }}
                    />
                  </div>
                  <button type="submit" className="pay-btn" disabled={gateLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {gateLoading ? <span className="spinner"></span> : <i className="ti ti-circle-check"></i>}
                    <span>{gateLoading ? 'Verifying...' : 'Unlock Portal'}</span>
                  </button>
                  <button
                    type="button"
                    className="pay-btn secondary"
                    onClick={() => {
                      setGateStep(1);
                      setGateCode('');
                      setGateError('');
                    }}
                    style={{ marginTop: '10px' }}
                  >
                    Go Back
                  </button>
                </form>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Tab Switcher */}
            <div className="tab-bar">
              <button
                className={`tab ${activeTab === 'pay' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('pay')}
              >
                Make payment
              </button>
              <button
                className={`tab ${activeTab === 'history' ? 'active' : ''}`}
                onClick={() => handleTabSwitch('history')}
              >
                Payment history
              </button>
            </div>

            {/* Main Views */}
            {activeTab === 'pay' && (
              <div className="view active" id="view-pay">
                {/* Multi-step progress visualizer */}
                <div className="steps">
                  <div className={`step ${paneStep === 1 ? 'active' : 'done'}`} id="step1">
                    <div className="step-num">{paneStep > 1 ? '✓' : '1'}</div>
                    <span className="step-label">Student info</span>
                  </div>
                  
                  <div className="step-connector"></div>
                  
                  <div className={`step ${paneStep === 2 ? 'active' : paneStep > 2 ? 'done' : ''}`} id="step2">
                    <div className="step-num">{paneStep > 2 ? '✓' : '2'}</div>
                    <span className="step-label">Payment type</span>
                  </div>
                  
                  <div className="step-connector"></div>
                  
                  <div className={`step ${paneStep === 3 ? 'active' : ''}`} id="step3">
                    <div className="step-num">3</div>
                    <span className="step-label">Confirm & pay</span>
                  </div>
                </div>

                {/* Stepper Wizard Panels */}
                {paneStep === 1 && (
                  <StudentInfoForm
                    studentDetails={studentDetails}
                    onChange={setStudentDetails}
                    onNext={() => setPaneStep(2)}
                  />
                )}

                {paneStep === 2 && (
                  <PaymentTypeSelector
                    selectedTypes={selectedTypes}
                    session={session}
                    onChangeTypes={setSelectedTypes}
                    onChangeSession={setSession}
                    onNext={() => setPaneStep(3)}
                    onBack={() => setPaneStep(1)}
                  />
                )}

                {paneStep === 3 && (
                  <PaymentSummary
                    studentDetails={studentDetails}
                    selectedTypes={selectedTypes}
                    session={session}
                    sessionToken={sessionToken}
                    onEdit={() => setPaneStep(2)}
                  />
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <PaymentHistory sessionMatric={sessionMatric} sessionToken={sessionToken} />
            )}
          </>
        )}
      </div>

      {/* Subtle Student Portal Footer */}
      <footer className="portal-footer">
        <div className="footer-content">
          <span>&copy; {new Date().getFullYear()} Software &amp; Web Development Payment Portal. All transactions processed securely.</span>
        </div>
      </footer>
    </div>
  );
}
