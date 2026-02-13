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
      <h2>Consent Form for Research Participation</h2>
      <p className="page-subtitle">
        We sincerely appreciate you considering being part of this work.
      </p>
      
      <div className="welcome-info">
        <h3>Purpose of the study</h3>
        <p>
          The C.O.G.N.I.T. project investigates how humans interpret and verbally describe visual scenes. 
          Your descriptions provide valuable data for understanding perceptual processes, linguistic expression 
          of visual experience, and cognitive mechanisms of scene understanding. Results support peer-reviewed 
          cognitive science research and contribute to the responsible advancement of multimodal AI systems.
        </p>

        <h3>What participation entails</h3>
        <p>If you choose to take part, you will:</p>
        <ul>
          <li>Create an account using a valid Indian mobile number and supported email</li>
          <li>Provide minimal demographic information (age group, gender, state/UT, primary language)</li>
          <li>Complete a brief practice trial</li>
          <li>View a sequence of everyday and abstract images</li>
          <li>Write rich, natural descriptions for each image (≥60 words)</li>
          <li>Indicate perceived image complexity on a 1–10 scale</li>
          <li>Respond to a small number of attention-verification items</li>
        </ul>
        <p>
          <strong>Duration:</strong> Approximately 15–20 minutes. You are welcome to pause or leave and return 
          later if the platform permits.
        </p>

        <h3>Your rights and control</h3>
        <p>Participation is entirely voluntary and may be discontinued at any moment without any consequence.</p>
        <p>You may:</p>
        <ul>
          <li>Decline to answer any item</li>
          <li>Withdraw at any point</li>
          <li>Request complete removal of your data afterward</li>
        </ul>
        <p>To withdraw or request deletion, email: <strong>research@cognit.org</strong></p>
        <p>Early withdrawal before task completion means you will not enter the reward draw.</p>

        <h3>Compensation structure</h3>
        <ul>
          <li><strong>Nominal platform access fee:</strong> ₹1 (non-refundable)</li>
          <li><strong>Reward draw:</strong> Randomly selected participants receive ₹10 via UPI (typically within 24–48 hours)</li>
        </ul>
        <p>
          Individuals who submit especially thoughtful, lengthy, or repeated high-quality contributions may be 
          given priority in reward allocation. Receipt of any reward is not guaranteed.
        </p>

        <h3>Data protection & use</h3>
        <p>We collect:</p>
        <ul>
          <li>Account identifiers (username, hashed contact details)</li>
          <li>Basic demographics (age group, gender, Indian state/UT, primary language)</li>
          <li>Your image descriptions and complexity ratings</li>
        </ul>
        <p>Safeguards include:</p>
        <ul>
          <li>Immediate separation of contact information from scientific data</li>
          <li>Use of irreversible cryptographic hashing for IP addresses</li>
          <li>Storage under randomized research identifiers only</li>
          <li>Encryption at rest and in transit</li>
          <li>Access restricted to named principal investigators and authorized personnel under strict confidentiality agreements</li>
          <li>Publication only of fully aggregated, anonymized statistics and qualitative excerpts that cannot be traced to individuals</li>
        </ul>
        <p>
          Your data will be used exclusively for scientific research and ethical AI development purposes. 
          No commercial marketing or profiling will occur.
        </p>

        <h3>Minimal foreseeable burdens</h3>
        <p>The main burdens are:</p>
        <ul>
          <li>15–20 minutes of focused attention</li>
          <li>Possible mild cognitive fatigue from descriptive writing</li>
        </ul>
        <p>No physical, emotional, social, legal, or financial risks beyond those of ordinary internet use are anticipated.</p>

        <h3>Contact & support</h3>
        <p>For any question, concern, clarification, complaint, or data deletion request:</p>
        <p><strong>Email:</strong> research@cognit.org</p>
        <p>We aim to respond within 48 hours.</p>

        <h3>Statement of consent</h3>
        <p>By selecting "I Consent & Proceed" you confirm that you have:</p>
        <ul>
          <li>Carefully read and understood this entire information sheet</li>
          <li>Are currently located in India</li>
          <li>Are aged 13 years or older</li>
          <li>Possess a valid 10-digit Indian mobile number</li>
          <li>Have access to a supported email provider</li>
          <li>Are comfortable reading and writing in English</li>
          <li>Accept that the ₹1 access fee is non-refundable</li>
          <li>Freely and voluntarily choose to participate</li>
          <li>Understand that your anonymized contributions may appear in scientific publications and conference presentations in aggregated or de-identified form</li>
          <li>Know you can stop at any time and may later request deletion of your records</li>
        </ul>
        <p>
          Your thoughtful participation directly helps deepen scientific understanding of human vision-language 
          interaction and supports more interpretable, equitable AI systems.
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
          <strong>I consent to participate in this research</strong>
          <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '400' }}>
            I confirm that I have read and understood the consent information above and voluntarily agree to participate.
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
