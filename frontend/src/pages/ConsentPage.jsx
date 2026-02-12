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
      <h2>Informed Consent for Research Participation</h2>
      <p className="page-subtitle">
        <strong>C.O.G.N.I.T. Study: Cognitive Network for Image & Text Modeling</strong>
      </p>
      
      <div className="welcome-info">
        <h3>Purpose of This Study</h3>
        <p>
          Welcome to the C.O.G.N.I.T. research study. This study aims to advance our understanding 
          of how humans perceive, interpret, and describe visual content. Your responses will help 
          researchers and AI developers improve image understanding systems and natural language 
          generation models. This research is conducted in accordance with ethical guidelines for 
          human subjects research.
        </p>

        <h3>Study Procedures</h3>
        <p>If you choose to participate, you will be asked to:</p>
        <ul>
          <li>Provide basic demographic information (age, gender, language background)</li>
          <li>View a series of images presented one at a time on your screen</li>
          <li>Write detailed, descriptive responses for each image (minimum 60 words per description)</li>
          <li>Rate each image on a complexity scale from 1 to 10</li>
          <li>Share brief feedback about your experience after each image</li>
          <li>Complete a practice survey set before proceeding to main trials</li>
          <li>Participate in occasional attention-check tasks with simple instructions</li>
        </ul>

        <h3>Duration & Participation</h3>
        <p>
          The entire session typically takes <strong>15-20 minutes</strong> to complete. 
          You may take breaks between images as needed. Participation is entirely voluntary, 
          and you may withdraw at any point without penalty or loss of benefits. If you choose 
          to withdraw, any data collected up to that point may be retained for research purposes 
          unless you specifically request its deletion.
        </p>

        <h3>Compensation & Rewards</h3>
        <p>
          Upon completion, you will be entered into a random selection for a <strong>₹10 reward</strong>. 
          Active participants who provide detailed, thoughtful descriptions may be added to a 
          priority pool for increased chances of selection in future studies. Rewards are distributed 
          via UPI transfer within 24-48 hours of selection.
        </p>

        <h3>Data Privacy & Protection</h3>
        <ul>
          <li>Your responses are stored securely without directly identifying information</li>
          <li>IP addresses are cryptographically hashed with a salt for privacy protection</li>
          <li>Data is used exclusively for academic research, AI model training, and improving cognitive understanding</li>
          <li>Aggregated results may be published in research papers, presentations, or shared with the scientific community</li>
          <li>All data is protected using industry-standard encryption and security practices</li>
          <li>Your personal contact information (if provided for rewards) is stored separately from your research data</li>
        </ul>

        <h3>Risks & Benefits</h3>
        <p>
          <strong>Risks:</strong> The risks associated with this study are minimal. You may 
          experience mild fatigue from writing descriptions. There are no known physical, psychological, 
          or social risks.
        </p>
        <p>
          <strong>Benefits:</strong> While you may not receive direct personal benefit, your 
          participation contributes to scientific knowledge about human cognition and helps improve 
          AI systems. You will also have the opportunity to win a monetary reward.
        </p>

        <h3>Voluntary Participation & Right to Withdraw</h3>
        <p>
          Your participation is completely voluntary. You are free to decline participation or 
          withdraw at any time without penalty, prejudice, or loss of benefits. If you withdraw 
          before completing the study, you will forfeit entry into the reward selection.
        </p>

        <h3>Contact Information</h3>
        <p>
          If you have any questions about this study, your rights as a participant, or wish to 
          request deletion of your data, please contact:
        </p>
        <p>
          <strong>Research Team:</strong> research@cognit.org
        </p>

        <h3>Eligibility Requirements</h3>
        <p>By proceeding, you confirm that:</p>
        <ul>
          <li>You are at least 18 years of age</li>
          <li>You have read and understood this consent form</li>
          <li>You have the capacity to consent to participate</li>
          <li>You are participating of your own free will</li>
          <li>You understand that your anonymized responses will be used for research purposes</li>
        </ul>

        <h3>Consent Statement</h3>
        <p>
          By checking the box below and clicking "Continue," you acknowledge that you have read 
          this consent form, understand its contents, and agree to participate in this research 
          study voluntarily. You understand that your participation is voluntary and that you 
          are free to withdraw at any time without penalty.
        </p>
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
          <strong>I consent to participate in this research study</strong>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '400' }}>
            I confirm that I am 18 years or older, I have read and understood this informed consent form, 
            and I voluntarily agree to participate in the C.O.G.N.I.T. research study. I understand my 
            responses will be collected anonymously and used for research purposes, including potential 
            publication of aggregated findings. I understand I may withdraw at any time without penalty.
          </p>
        </label>
      </div>
      
      <div className="page-actions">
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
