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
          C.O.G.N.I.T. (Cognitive Network for Image &amp; Text Modeling) explores how people describe visual content and how AI can learn from those descriptions. Your responses directly improve image-text understanding and generation models.
        </p>

        <h3>Study Flow</h3>
        <ol>
          <li>Provide consent and basic contact details.</li>
          <li>Complete a quick ₹1 participation payment screen.</li>
          <li>Start with short survey/practice images to get comfortable.</li>
          <li>Move into main trials with occasional attention-check images.</li>
          <li>Finish the study and view reward eligibility information.</li>
        </ol>

        <h3>What You Will Do</h3>
        <ul>
          <li>Review images presented one at a time.</li>
          <li>Write detailed descriptions for each image (minimum 60 words).</li>
          <li>Rate each image on a 1–10 complexity scale.</li>
          <li>Share brief feedback after each response.</li>
          <li>Follow special instructions on attention-check images.</li>
        </ul>

        <h3>Time &amp; Compensation</h3>
        <p>
          The session takes approximately 15–20 minutes. You may pause between images and withdraw at any time. Participants who complete the study are eligible for a ₹10 UPI reward, selected through the built-in reward system.
        </p>

        <h3>Privacy &amp; Data Use</h3>
        <ul>
          <li>Responses are stored without direct identifiers.</li>
          <li>Your IP address is cryptographically hashed for security.</li>
          <li>Data is used exclusively for academic research and AI model training.</li>
          <li>Results may be summarized in research publications or shared with other researchers.</li>
          <li>Your data is stored securely using industry-standard encryption practices.</li>
        </ul>

        <h3>Voluntary Participation</h3>
        <p>
          Taking part is completely optional. You can decline or exit at any time without penalty.
        </p>

        <h3>Questions or Concerns</h3>
        <p>
          For questions about the study, data use, or to request data deletion, contact the research team at
          <strong> research@cognit.org</strong>.
        </p>

        <h3>Consent Acknowledgement</h3>
        <p>
          By checking the consent box below and clicking "Continue", you confirm that:
        </p>
        <ul>
          <li>You are at least 18 years old.</li>
          <li>You have read and understood the information above.</li>
          <li>You agree to participate voluntarily.</li>
          <li>You understand your responses will be recorded for research use.</li>
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
