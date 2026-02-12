import React, { useState, useEffect } from "react";

export default function ConsentPage({ 
  onConsentGiven, 
  systemReady 
}) {
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Consent Form - C.O.G.N.I.T.";
  }, []);

  const getErrorMessage = (err) => {
    const message = err?.message || "";
    if (message.toLowerCase().includes("expected pattern")) {
      return "Unable to reach the server. Please check your connection and try again.";
    }
    return message || "Failed to record consent. Please try again.";
  };

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
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h2>Research Consent Form</h2>
      <p style={{ color: 'var(--muted)', fontSize: '15px', marginBottom: '20px' }}>
        <strong>C.O.G.N.I.T.: Cognitive Network for Image & Text Modeling</strong>
      </p>

      <div className="welcome-info">
        <h3>About the Study</h3>
        <p>
          C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) explores how people describe visual scenes and how language captures what we see.
          Your responses help us advance research in cognition, language understanding, and visual computing.
        </p>

        <h3>What Participation Involves</h3>
        <ul>
          <li>Review a series of images presented one at a time</li>
          <li>Write a descriptive response for each image (at least 60 words)</li>
          <li>Rate each image on a 1-10 scale based on perceived complexity</li>
          <li>Complete a short survey set before starting the main image set</li>
        </ul>

        <h3>Time Commitment</h3>
        <p>
          The session takes about 15-20 minutes. You may pause between images and you can stop at any time.
        </p>

        <h3>Privacy &amp; Data Use</h3>
        <ul>
          <li>Responses are stored without directly identifying information</li>
          <li>Data is used only for academic research and analysis</li>
          <li>Results may be summarized in publications or presentations</li>
          <li>Your data is stored securely and handled with care</li>
        </ul>

        <h3>Voluntary Participation</h3>
        <p>
          Taking part is completely optional. You can decline or exit at any time without penalty.
        </p>

        <h3>Questions or Concerns</h3>
        <p>
          For questions about the study, contact the research team at
          <strong> research@cognit.org</strong>.
        </p>

        <h3>Consent Acknowledgement</h3>
        <p>
          By checking the consent box below and clicking "Continue", you confirm that:
        </p>
        <ul>
          <li>You are at least 18 years old</li>
          <li>You have read and understood the information above</li>
          <li>You agree to participate voluntarily</li>
          <li>You understand your responses will be recorded for research use</li>
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
          className="primary"
          onClick={handleSubmit}
          disabled={!systemReady || submitting || !consentChecked}
        >
          {submitting ? "Processing..." : "Continue"}
        </button>
      </div>
    </div>
  );
}
