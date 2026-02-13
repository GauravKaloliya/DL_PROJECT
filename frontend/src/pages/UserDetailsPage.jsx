import React, { useState, useEffect } from "react";

export default function UserDetailsPage({ 
  demographics, 
  setDemographics, 
  onSubmit, 
  systemReady,
  onBack
}) {
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "User Details - C.O.G.N.I.T.";
  }, []);

  const validateForm = () => {
    const newErrors = {};
    
    // Username validation - only alphanumeric and underscore allowed, no spaces
    if (!demographics.username || demographics.username.trim().length < 2) {
      newErrors.username = "Username is required (min 2 characters)";
    } else if (!/^[a-zA-Z0-9_]+$/.test(demographics.username)) {
      newErrors.username = "Username can only contain letters, numbers, and underscore (no spaces)";
    }
    
    // Email validation - only Gmail, Microsoft, and Apple emails allowed
    if (!demographics.email || !/^[^\s@]+@(gmail\.com|outlook\.com|hotmail\.com|live\.com|icloud\.com)$/i.test(demographics.email)) {
      newErrors.email = "Email must be from Gmail, Outlook, Hotmail, Live, or iCloud";
    }
    
    // Phone validation - Indian phone numbers only (+91 or 91 followed by 10 digits)
    if (!demographics.phone || !/^(\+91|91)?[6-9]\d{9}$/.test(demographics.phone.replace(/\s/g, ''))) {
      newErrors.phone = "Phone number must be a valid Indian number (10 digits starting with 6-9, with or without +91)";
    }
    
    if (!demographics.gender) {
      newErrors.gender = "Gender is required";
    }
    
    // Age validation - only allow 13 to 100
    if (!demographics.age || isNaN(demographics.age) || demographics.age < 13 || demographics.age > 100) {
      newErrors.age = "Please enter a valid age (13-100)";
    }
    
    if (!demographics.place || demographics.place.trim().length < 2) {
      newErrors.place = "Place/Location is required";
    }
    
    if (!demographics.native_language) {
      newErrors.native_language = "Native language is required";
    }
    
    if (!demographics.prior_experience) {
      newErrors.prior_experience = "Prior experience is required";
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!systemReady) {
      return;
    }
    
    if (!validateForm()) {
      return;
    }
    
    setSubmitting(true);
    
    try {
      await onSubmit();
    } finally {
      setSubmitting(false);
    }
  };

  const updateField = (field, value) => {
    setDemographics(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  return (
    <div className="panel">
      <div className="page-top-actions">
        {onBack && (
          <button
            className="ghost"
            onClick={onBack}
            style={{ padding: '10px 20px' }}
          >
            ← Back
          </button>
        )}
      </div>
      <h2>Participant Information</h2>
      <p className="page-subtitle">
        Please provide your details to participate in the C.O.G.N.I.T. research study.
      </p>
      
      <div className="form-grid">
        <div className={`form-field ${errors.username ? 'error' : ''}`}>
          <label>Username *</label>
          <input
            type="text"
            className={errors.username ? 'error-input' : ''}
            placeholder="e.g., john_doe123"
            value={demographics.username || ''}
            onChange={(e) => updateField('username', e.target.value)}
          />
          {errors.username && <span className="error-text">{errors.username}</span>}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Only letters, numbers, and underscore (no spaces or special characters)
          </p>
        </div>

        <div className={`form-field ${errors.email ? 'error' : ''}`}>
          <label>Email *</label>
          <input
            type="email"
            className={errors.email ? 'error-input' : ''}
            placeholder="e.g., yourname@gmail.com"
            value={demographics.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Only Gmail, Outlook, Hotmail, Live, or iCloud emails accepted
          </p>
        </div>

        <div className={`form-field ${errors.phone ? 'error' : ''}`}>
          <label>Phone Number *</label>
          <input
            type="tel"
            className={errors.phone ? 'error-input' : ''}
            placeholder="e.g., +91 98765 43210"
            value={demographics.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Indian mobile number only (10 digits starting with 6-9, with or without +91)
          </p>
        </div>

        <div className={`form-field ${errors.gender ? 'error' : ''}`}>
          <label>Gender *</label>
          <select
            className={errors.gender ? 'error-input' : ''}
            value={demographics.gender || ''}
            onChange={(e) => updateField('gender', e.target.value)}
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="non-binary">Non-binary</option>
            <option value="prefer-not-say">Prefer not to say</option>
            <option value="other">Other</option>
          </select>
          {errors.gender && <span className="error-text">{errors.gender}</span>}
        </div>

        <div className={`form-field ${errors.age ? 'error' : ''}`}>
          <label>Age *</label>
          <input
            type="number"
            className={errors.age ? 'error-input' : ''}
            min="13"
            max="100"
            placeholder="Enter your age (13-100)"
            value={demographics.age || ''}
            onChange={(e) => updateField('age', e.target.value)}
          />
          {errors.age && <span className="error-text">{errors.age}</span>}
        </div>

        <div className={`form-field ${errors.place ? 'error' : ''}`}>
          <label>Place/Location *</label>
          <input
            type="text"
            className={errors.place ? 'error-input' : ''}
            placeholder="e.g., India"
            value={demographics.place || ''}
            onChange={(e) => updateField('place', e.target.value)}
          />
          {errors.place && <span className="error-text">{errors.place}</span>}
        </div>

        <div className={`form-field ${errors.native_language ? 'error' : ''}`}>
          <label>Native Language *</label>
          <select
            className={errors.native_language ? 'error-input' : ''}
            value={demographics.native_language || ''}
            onChange={(e) => updateField('native_language', e.target.value)}
          >
            <option value="">Select native language</option>
            <option value="Hindi">Hindi</option>
            <option value="Bengali">Bengali</option>
            <option value="Telugu">Telugu</option>
            <option value="Marathi">Marathi</option>
            <option value="Tamil">Tamil</option>
            <option value="Gujarati">Gujarati</option>
            <option value="Kannada">Kannada</option>
            <option value="Malayalam">Malayalam</option>
            <option value="Punjabi">Punjabi</option>
            <option value="Odia">Odia</option>
          </select>
          {errors.native_language && <span className="error-text">{errors.native_language}</span>}
          <p style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
            Select the language you speak natively
          </p>
        </div>

        <div className={`form-field ${errors.prior_experience ? 'error' : ''}`}>
          <label>Prior Experience *</label>
          <select
            className={errors.prior_experience ? 'error-input' : ''}
            value={demographics.prior_experience || ''}
            onChange={(e) => updateField('prior_experience', e.target.value)}
          >
            <option value="">Select prior experience</option>
            <optgroup label="Technical Skills">
              <option value="Computer Vision">Computer Vision</option>
              <option value="Machine Learning">Machine Learning</option>
              <option value="Artificial Intelligence">Artificial Intelligence</option>
              <option value="Data Science">Data Science</option>
              <option value="Image Processing">Image Processing</option>
              <option value="Deep Learning">Deep Learning</option>
              <option value="Software Development">Software Development</option>
              <option value="Web Development">Web Development</option>
              <option value="Mobile App Development">Mobile App Development</option>
              <option value="Cloud Computing">Cloud Computing</option>
            </optgroup>
            <optgroup label="General Skills">
              <option value="Photography">Photography</option>
              <option value="Art/Design">Art/Design</option>
              <option value="Graphic Design">Graphic Design</option>
              <option value="Video Editing">Video Editing</option>
              <option value="3D Modeling">3D Modeling</option>
              <option value="UI/UX Design">UI/UX Design</option>
              <option value="Animation">Animation</option>
              <option value="Digital Art">Digital Art</option>
              <option value="Content Creation">Content Creation</option>
              <option value="Creative Writing">Creative Writing</option>
              <option value="None">None</option>
            </optgroup>
          </select>
          {errors.prior_experience && <span className="error-text">{errors.prior_experience}</span>}
        </div>
      </div>

      <div className="page-actions">
        <button
          className="primary"
          onClick={handleSubmit}
          disabled={!systemReady || submitting}
        >
          {submitting ? "Saving..." : "Continue to Payment"}
        </button>
      </div>
    </div>
  );
}