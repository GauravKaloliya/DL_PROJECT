import React, { useState, useEffect } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function UserDetailsPage({ 
  demographics, 
  setDemographics, 
  onSubmit, 
  systemReady 
}) {
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "User Details - C.O.G.N.I.T.";
  }, []);

  const validateForm = () => {
    const newErrors = {};
    
    if (!demographics.username || demographics.username.trim().length < 2) {
      newErrors.username = "Username is required (min 2 characters)";
    }
    
    if (!demographics.gender) {
      newErrors.gender = "Gender is required";
    }
    
    if (!demographics.age || isNaN(demographics.age) || demographics.age < 1 || demographics.age > 120) {
      newErrors.age = "Please enter a valid age (1-120)";
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
    
    // Email validation (optional but validated if provided)
    if (demographics.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(demographics.email)) {
      newErrors.email = "Please enter a valid email address";
    }
    
    // Phone validation (optional but validated if provided)
    if (demographics.phone && !/^[\d\s\-\+\(\)]{7,20}$/.test(demographics.phone)) {
      newErrors.phone = "Please enter a valid phone number";
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
      <h2>Participant Information</h2>
      <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
        Please provide your details to participate in the C.O.G.N.I.T. research study.
      </p>
      
      <div className="form-grid">
        <div className={`form-field ${errors.username ? 'error' : ''}`}>
          <label>Username *</label>
          <input
            type="text"
            placeholder="Enter your username"
            value={demographics.username || ''}
            onChange={(e) => updateField('username', e.target.value)}
          />
          {errors.username && <span className="error-text">{errors.username}</span>}
        </div>

        <div className={`form-field ${errors.email ? 'error' : ''}`}>
          <label>Email (Optional)</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={demographics.email || ''}
            onChange={(e) => updateField('email', e.target.value)}
          />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </div>

        <div className={`form-field ${errors.phone ? 'error' : ''}`}>
          <label>Phone Number (Optional)</label>
          <input
            type="tel"
            placeholder="Enter your phone number"
            value={demographics.phone || ''}
            onChange={(e) => updateField('phone', e.target.value)}
          />
          {errors.phone && <span className="error-text">{errors.phone}</span>}
        </div>

        <div className={`form-field ${errors.gender ? 'error' : ''}`}>
          <label>Gender *</label>
          <select
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
            min="1"
            max="120"
            placeholder="Enter your age"
            value={demographics.age || ''}
            onChange={(e) => updateField('age', e.target.value)}
          />
          {errors.age && <span className="error-text">{errors.age}</span>}
        </div>

        <div className={`form-field ${errors.place ? 'error' : ''}`}>
          <label>Place/Location *</label>
          <input
            type="text"
            placeholder="e.g., India"
            value={demographics.place || ''}
            onChange={(e) => updateField('place', e.target.value)}
          />
          {errors.place && <span className="error-text">{errors.place}</span>}
        </div>

        <div className={`form-field ${errors.native_language ? 'error' : ''}`}>
          <label>Native Language *</label>
          <select
            value={demographics.native_language || ''}
            onChange={(e) => updateField('native_language', e.target.value)}
          >
            <option value="">Select native language</option>
            <option value="English">English</option>
            <option value="Spanish">Spanish</option>
            <option value="French">French</option>
            <option value="German">German</option>
            <option value="Chinese">Chinese</option>
            <option value="Japanese">Japanese</option>
            <option value="Hindi">Hindi</option>
            <option value="Korean">Korean</option>
            <option value="Portuguese">Portuguese</option>
            <option value="Italian">Italian</option>
            <option value="Russian">Russian</option>
            <option value="Other">Other</option>
          </select>
          {errors.native_language && <span className="error-text">{errors.native_language}</span>}
        </div>

        <div className={`form-field ${errors.prior_experience ? 'error' : ''}`}>
          <label>Prior Experience *</label>
          <select
            value={demographics.prior_experience || ''}
            onChange={(e) => updateField('prior_experience', e.target.value)}
          >
            <option value="">Select prior experience</option>
            <option value="Photography">Photography</option>
            <option value="Art/Design">Art/Design</option>
            <option value="Computer Vision">Computer Vision</option>
            <option value="Image Processing">Image Processing</option>
            <option value="Graphic Design">Graphic Design</option>
            <option value="Video Editing">Video Editing</option>
            <option value="3D Modeling">3D Modeling</option>
            <option value="UI/UX Design">UI/UX Design</option>
            <option value="Animation">Animation</option>
            <option value="Other">Other</option>
            <option value="None">None</option>
          </select>
          {errors.prior_experience && <span className="error-text">{errors.prior_experience}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px' }}>
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
