import React, { useState, useEffect } from "react";

export default function ConsentPage({ 
  onConsentGiven, 
  onBack,
  systemReady 
}) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Consent Form - C.O.G.N.I.T.";
  }, []);

  const handleSubmit = async () => {
    if (!systemReady) {
      setError("System is not ready. Please wait for the connection to be established.");
      return;
    }

    if (!consentChecked) {
      setError("You must consent to participate in this research");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onConsentGiven();
    } catch (err) {
      setError(err.message || "Failed to record consent. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h2>Survey Consent Form</h2>
      <p style={{ color: 'var(--muted)', fontSize: '15px', marginBottom: '20px' }}>
        <strong>C.O.G.N.I.T.: Cognitive Observation & Generalized Narrative Inquiry Tool</strong>
      </p>
      
      <div className="welcome-info">
        <h3>Purpose of the Research</h3>
        <p>
          This research aims to understand how individuals perceive, interpret, and describe visual content. 
          Your participation will contribute to advancing knowledge in cognitive science, computer vision, 
          and natural language processing.
        </p>
        
        <h3>What You Will Do</h3>
        <ul>
          <li>View a series of images presented on your screen</li>
          <li>Provide detailed written descriptions of each image (minimum 30 words)</li>
          <li>Rate each image on a scale of 1-10 based on visual complexity</li>
          <li>Complete a brief survey session before the main research</li>
        </ul>
        
        <h3>Time and Duration</h3>
        <p>
          The survey takes approximately 15-20 minutes to complete. You may take breaks between images as needed. 
          You have the option to exit the survey at any point without penalty.
        </p>
        
        <h3>Data Privacy and Confidentiality</h3>
        <ul>
          <li>All responses are collected anonymously and stored securely</li>
          <li>No personally identifiable information will be published or shared</li>
          <li>Data will be used solely for academic research purposes</li>
          <li>Aggregated results may be published in research papers or presented at conferences</li>
        </ul>
        
        <h3>Your Rights</h3>
        <p>
          Participation in this survey is entirely voluntary. You have the right to:
        </p>
        <ul>
          <li>Decline to participate without any consequences</li>
          <li>Withdraw from the survey at any time without penalty</li>
        </ul>
        
        <h3>Contact Information</h3>
        <p>
          If you have any questions about this survey, please contact the research team at 
          <strong> research@cognit.org</strong>.
        </p>
        
        <h3>Consent Statement</h3>
        <p>
          By checking the consent box below and clicking "Start Survey", you confirm that:
        </p>
        <ul>
          <li>You are at least 18 years of age</li>
          <li>You have read and understood this consent form</li>
          <li>You agree to participate in this research survey voluntarily</li>
          <li>You understand that your responses will be collected</li>
        </ul>
      </div>
      
      {error && (
        <div className="banner warning" style={{ marginTop: '20px' }}>
          {error}
        </div>
      )}
      
      <div className={`consent-checkbox ${error && !consentChecked ? 'error' : ''}`}>
        <input
          type="checkbox"
          checked={consentChecked}
          onChange={(e) => {
            setConsentChecked(e.target.checked);
            if (error) setError(null);
          }}
          id="consent-check"
        />
        <label htmlFor="consent-check">
          <strong>I consent to participate in this research survey</strong>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '400' }}>
            I confirm that I am 18 years or older, I have read and understood the consent form, 
            and I agree to participate voluntarily. I understand my responses will be collected 
            and used for research purposes only.
          </p>
        </label>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
        <button
          className="ghost"
          onClick={onBack}
          disabled={submitting}
        >
          Back
        </button>
        <button
          className="primary"
          onClick={handleSubmit}
          disabled={!systemReady || submitting}
        >
          {submitting ? "Processing..." : "Start Survey"}
        </button>
      </div>
    </div>
  );
}
