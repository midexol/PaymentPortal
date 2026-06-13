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

  // Student portal states
  const [activeTab, setActiveTab] = useState('pay'); // 'pay' or 'history'
  const [paneStep, setPaneStep] = useState(1); // 1, 2, or 3
  
  const [studentDetails, setStudentDetails] = useState({
    studentName: '',
    matricNumber: '',
    email: '',
    phone: '',
    department: '',
    level: ''
  });

  const [selectedType, setSelectedType] = useState('fees');
  const [session, setSession] = useState('2024/2025');

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
          <span className="badge">
            <i className="ti ti-circle-check" aria-hidden="true"></i> Securing via Paystack
          </span>
        </div>

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
                selectedType={selectedType}
                session={session}
                onChangeType={setSelectedType}
                onChangeSession={setSession}
                onNext={() => setPaneStep(3)}
                onBack={() => setPaneStep(1)}
              />
            )}

            {paneStep === 3 && (
              <PaymentSummary
                studentDetails={studentDetails}
                selectedType={selectedType}
                session={session}
                onEdit={() => setPaneStep(2)}
              />
            )}
          </div>
        )}

        {activeTab === 'history' && <PaymentHistory />}
      </div>

      {/* Subtle Student Portal Footer */}
      <footer className="portal-footer">
        <div className="footer-content">
          <span>&copy; {new Date().getFullYear()} Institutional Billing System. All transactions processed securely.</span>
        </div>
      </footer>
    </div>
  );
}
