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
          Welcome to the C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) research study. 
          This study aims to advance our understanding of how humans perceive, interpret, and describe 
          visual content. Your detailed image descriptions will help researchers and AI developers 
          improve image understanding systems, natural language generation models, and cognitive 
          computing research. This study is conducted in accordance with ethical guidelines for 
          human subjects research with a focus on Indian participants.
        </p>

        <h3>Study Procedures</h3>
        <p>If you choose to participate, you will complete the following steps:</p>
        <ul>
          <li><strong>Registration:</strong> Create an account with a valid Indian mobile number and supported email (Gmail, Outlook, Hotmail, or iCloud)</li>
          <li><strong>Demographics:</strong> Provide basic information including age (13-100 years), gender, location in India, and native Indian language</li>
          <li><strong>Entry:</strong> Pay a nominal ₹1 participation fee to unlock your chance to win ₹10 (10x reward)</li>
          <li><strong>Practice Survey:</strong> Complete practice trials to familiarize yourself with the task</li>
          <li><strong>Main Task:</strong> View images one at a time and write detailed descriptions (minimum 60 words each)</li>
          <li><strong>Rating & Feedback:</strong> Rate each image's complexity (1-10) and provide brief feedback</li>
          <li><strong>Attention Checks:</strong> Complete simple attention-check tasks to ensure data quality</li>
        </ul>

        <h3>Duration & Participation</h3>
        <p>
          The entire session typically takes <strong>15-20 minutes</strong> to complete. 
          You may take breaks between images as needed. Participation is entirely voluntary, 
          and you may withdraw at any point without penalty. If you withdraw before completing 
          the study, you will forfeit entry into the reward selection, but your data may be 
          retained for research purposes unless you specifically request deletion.
        </p>

        <h3>Compensation & Rewards Program</h3>
        <ul>
          <li><strong>Entry Fee:</strong> ₹1 non-refundable participation fee</li>
          <li><strong>Reward:</strong> Chance to win <strong>₹10</strong> (10x your entry fee)</li>
          <li><strong>Selection:</strong> Winners are randomly selected with priority given to active participants</li>
          <li><strong>Priority Pool:</strong> Participants who provide detailed descriptions (500+ total words) or complete multiple rounds (3+) get priority status for higher winning chances</li>
          <li><strong>Payment:</strong> Rewards distributed via UPI transfer within 24-48 hours of selection</li>
        </ul>

        <h3>Data Privacy & Protection</h3>
        <ul>
          <li>Your responses are stored securely with anonymized identifiers</li>
          <li>IP addresses are cryptographically hashed for privacy protection</li>
          <li>Personal contact information is stored separately from research data</li>
          <li>Data is used exclusively for academic research and AI model training</li>
          <li>Aggregated results may be published in research papers and shared with the scientific community</li>
          <li>All data is protected using industry-standard encryption and security practices</li>
          <li>We collect: username, email, phone, age, gender, location, native language, and prior experience</li>
        </ul>

        <h3>Eligibility Requirements</h3>
        <p>By proceeding, you confirm that you meet the following criteria:</p>
        <ul>
          <li>You are between <strong>13 and 100 years</strong> of age</li>
          <li>You have a valid <strong>Indian mobile number</strong> (10 digits starting with 6, 7, 8, or 9)</li>
          <li>You have an email address from <strong>Gmail, Outlook, Hotmail, or iCloud</strong></li>
          <li>You are currently located in India</li>
          <li>You speak one of the listed Indian languages as your native language</li>
          <li>You have read and understood this consent form</li>
          <li>You are participating of your own free will</li>
          <li>You understand that your anonymized responses will be used for research purposes</li>
        </ul>

        <h3>Risks & Benefits</h3>
        <p>
          <strong>Risks:</strong> The risks associated with this study are minimal. You may 
          experience mild fatigue from writing detailed descriptions. There are no known physical, 
          psychological, or social risks. The ₹1 entry fee is non-refundable.
        </p>
        <p>
          <strong>Benefits:</strong> While you may not receive direct personal benefit, your 
          participation contributes to scientific knowledge about human cognition and helps improve 
          AI systems. You will have the opportunity to win a monetary reward, and active participants 
          gain priority status for future study opportunities.
        </p>

        <h3>Voluntary Participation & Right to Withdraw</h3>
        <p>
          Your participation is completely voluntary. You are free to decline participation or 
          withdraw at any time without penalty or prejudice. If you withdraw before completing 
          the study, you will forfeit entry into the reward selection but will not be penalized 
          in any way.
        </p>

        <h3>Contact Information</h3>
        <p>
          If you have any questions about this study, your rights as a participant, experience 
          technical issues, or wish to request deletion of your data, please contact:
        </p>
        <p>
          <strong>Research Team:</strong> research@cognit.org
        </p>

        <h3>Consent Statement</h3>
        <p>
          By checking the box below and clicking "Continue," you acknowledge that you have read 
          this consent form, understand its contents, and agree to participate in this research 
          study voluntarily. You confirm that you meet the eligibility requirements, understand 
          the ₹1 entry fee is non-refundable, and agree that your anonymized responses may be 
          used for research purposes including potential publication of aggregated findings. 
          You understand your participation is voluntary and you may withdraw at any time without 
          penalty.
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
            I confirm that I am between 13-100 years old, I have read and understood this informed consent form, 
            and I voluntarily agree to participate in the C.O.G.N.I.T. research study. I confirm I have a valid 
            Indian mobile number and supported email address (Gmail, Outlook, Hotmail, or iCloud). I understand 
            the ₹1 entry fee is non-refundable. I understand my responses will be collected anonymously and used 
            for research purposes, including potential publication of aggregated findings. I understand I may 
            withdraw at any time without penalty.
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
