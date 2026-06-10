import React, { useState } from 'react';
import './App.css';
import StudentInfoForm from './components/StudentInfoForm';
import PaymentTypeSelector from './components/PaymentTypeSelector';
import PaymentSummary from './components/PaymentSummary';
import PaymentHistory from './components/PaymentHistory';

export default function App() {
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

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
  };

  return (
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
  );
}
