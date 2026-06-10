import React from 'react';

export default function StudentInfoForm({ studentDetails, onChange, onNext }) {
  const departments = [
    'Computer Science',
    'Electrical Engineering',
    'Civil Engineering',
    'Mechanical Engineering',
    'Physics',
    'Mathematics'
  ];

  const levels = [
    '100 level',
    '200 level',
    '300 level',
    '400 level',
    '500 level'
  ];

  const handleInputChange = (field, value) => {
    onChange({ ...studentDetails, [field]: value });
  };

  const handleContinue = (e) => {
    e.preventDefault();
    const { studentName, matricNumber, email } = studentDetails;
    if (!studentName || !matricNumber || !email) {
      alert('Please fill in all required fields (Full name, Matric number, Email).');
      return;
    }
    onNext();
  };

  return (
    <form onSubmit={handleContinue} id="pane1">
      <div className="section">
        <div className="section-title">Student details</div>
        
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="fullname">Full name</label>
            <input
              type="text"
              id="fullname"
              placeholder="e.g. Adewale John"
              value={studentDetails.studentName || ''}
              onChange={(e) => handleInputChange('studentName', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="matric">Matric number</label>
            <input
              type="text"
              id="matric"
              placeholder="e.g. FUT/CSC/20/0034"
              value={studentDetails.matricNumber || ''}
              onChange={(e) => handleInputChange('matricNumber', e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="email">Email address</label>
            <input
              type="email"
              id="email"
              placeholder="student@example.edu.ng"
              value={studentDetails.email || ''}
              onChange={(e) => handleInputChange('email', e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="phone">Phone number</label>
            <input
              type="tel"
              id="phone"
              placeholder="080XXXXXXXX"
              value={studentDetails.phone || ''}
              onChange={(e) => handleInputChange('phone', e.target.value)}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="dept">Department</label>
            <select
              id="dept"
              value={studentDetails.department || ''}
              onChange={(e) => handleInputChange('department', e.target.value)}
            >
              <option value="">Select department</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="level">Level</label>
            <select
              id="level"
              value={studentDetails.level || ''}
              onChange={(e) => handleInputChange('level', e.target.value)}
            >
              <option value="">Select level</option>
              {levels.map((lvl) => (
                <option key={lvl} value={lvl}>{lvl}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button type="submit" className="pay-btn">
        <span>Continue</span>
        <i className="ti ti-arrow-right" aria-hidden="true"></i>
      </button>
    </form>
  );
}
