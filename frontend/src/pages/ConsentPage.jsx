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
        <h3>📋 Purpose of This Study</h3>
        <p>
          Welcome to the C.O.G.N.I.T. research study! This research is being conducted by Gaurav Kaloliya as part of an academic study focused on understanding how humans perceive, interpret, and describe visual content. Your participation will contribute valuable data that can help improve artificial intelligence systems, particularly in the areas of image understanding and natural language processing.
        </p>

        <h3>👤 Researcher Information</h3>
        <p>
          <strong>Principal Investigator:</strong> Gaurav Kaloliya<br/>
          <strong>Institution:</strong> Independent Research Study<br/>
          <strong>Contact Email:</strong> research@cognit.org
        </p>

        <h3>📝 Study Procedures</h3>
        <p>If you choose to participate, you will be asked to complete the following activities:</p>
        <ul>
          <li><strong>Demographics Survey:</strong> Provide basic information about yourself (age, gender, language background, location)</li>
          <li><strong>Consent Process:</strong> Read and agree to this consent form</li>
          <li><strong>Practice Rounds:</strong> Complete 1-2 practice trials to familiarize yourself with the interface</li>
          <li><strong>Image Description Tasks:</strong> View a series of images and provide detailed written descriptions (minimum 60 words per description)</li>
          <li><strong>Rating Exercise:</strong> Rate each image on a complexity scale from 1 (very simple) to 10 (very complex)</li>
          <li><strong>Feedback Collection:</strong> Share brief comments about your experience after each image</li>
          <li><strong>Attention Checks:</strong> Complete occasional simple tasks with special instructions to ensure active engagement</li>
          <li><strong>Optional:</strong> Complete up to 15 main trials (you may stop at any time)</li>
        </ul>

        <h3>⏱️ Duration & Participation</h3>
        <p>
          The entire study session typically takes <strong>15-20 minutes</strong> to complete, depending on how many trials you choose to complete. You may take breaks between images as needed. Participation is entirely <strong>voluntary</strong>, and you may withdraw at any point without penalty or loss of benefits.
        </p>
        <p>
          If you choose to withdraw before completing the study, any data collected up to that point may be retained for research purposes unless you specifically request its deletion by contacting the researcher at research@cognit.org.
        </p>

        <h3>💰 Compensation & Rewards</h3>
        <p>
          Upon completion of the study, you will be entered into a <strong>random selection</strong> for a reward. The details of the reward program are as follows:
        </p>
        <ul>
          <li><strong>Reward Amount:</strong> ₹10 for selected winners</li>
          <li><strong>Selection Method:</strong> Random selection from eligible participants</li>
          <li><strong>Priority Status:</strong> Participants who provide detailed, thoughtful descriptions (500+ words total) and complete 3+ survey rounds receive priority status and higher chances of selection</li>
          <li><strong>Payment Method:</strong> UPI transfer within 24-48 hours of selection</li>
          <li><strong>Entry Fee:</strong> ₹1 participation fee (to ensure genuine participation and fund the reward pool)</li>
        </ul>

        <h3>🔒 Data Privacy & Protection</h3>
        <p>Your privacy is of utmost importance to us. Here's how we protect your data:</p>
        <ul>
          <li><strong>Anonymity:</strong> Your research responses are stored without directly identifying information. A unique participant ID is used to link your data.</li>
          <li><strong>IP Address Privacy:</strong> IP addresses are cryptographically hashed with a secure salt for privacy protection. We cannot identify you from your IP address.</li>
          <li><strong>Data Usage:</strong> Your data will be used exclusively for academic research, AI model training, and improving cognitive understanding systems.</li>
          <li><strong>Publication:</strong> Aggregated results and anonymized data may be published in research papers, presentations, or shared with the scientific community. No personally identifiable information will be published.</li>
          <li><strong>Security:</strong> All data is protected using industry-standard encryption and security practices.</li>
          <li><strong>Separation:</strong> Your personal contact information (if provided for rewards) is stored separately from your research responses.</li>
          <li><strong>Retention:</strong> Data will be retained for a minimum of 5 years for research purposes, after which it may be archived or deleted in accordance with research ethics guidelines.</li>
        </ul>

        <h3>⚠️ Risks & Benefits</h3>
        <p>
          <strong>Potential Risks:</strong>
        </p>
        <ul>
          <li>Minimal risk: You may experience mild fatigue from writing detailed descriptions</li>
          <li>Minor discomfort: Extended screen time may cause eye strain (take breaks as needed)</li>
          <li>There are no known physical, psychological, or social risks associated with this study</li>
        </ul>
        <p>
          <strong>Potential Benefits:</strong>
        </p>
        <ul>
          <li>Contribution to scientific knowledge about human cognition and language processing</li>
          <li>Helping improve AI systems for image understanding</li>
          <li>Opportunity to learn about the research process</li>
          <li>Potential monetary reward through the random selection</li>
        </ul>
        <p>
          <em>Please note that you may not receive any direct personal benefit from participating in this study.</em>
        </p>

        <h3>🚪 Voluntary Participation & Right to Withdraw</h3>
        <p>
          Your participation is <strong>completely voluntary</strong>. You are free to:
        </p>
        <ul>
          <li>Decline to participate without any consequences</li>
          <li>Withdraw at any time without penalty, prejudice, or loss of benefits</li>
          <li>Skip any questions you do not wish to answer</li>
          <li>Request deletion of your data at any time (contact: research@cognit.org)</li>
        </ul>
        <p>
          <strong>Note:</strong> If you withdraw before completing the study, you will forfeit entry into the reward selection. Data collected before withdrawal may be retained unless you specifically request deletion.
        </p>

        <h3>📧 Contact Information</h3>
        <p>
          If you have any questions about this study, your rights as a participant, or wish to request deletion of your data, please contact:
        </p>
        <p>
          <strong>Research Team:</strong> research@cognit.org<br/>
          <strong>Principal Investigator:</strong> Gaurav Kaloliya<br/>
          <strong>Email:</strong> research@cognit.org
        </p>

        <h3>✅ Eligibility Requirements</h3>
        <p>By proceeding with this study, you confirm that:</p>
        <ul>
          <li>You are at least <strong>13 years of age</strong> (participants under 18 should have parental/guardian consent)</li>
          <li>You have read and understood this consent form</li>
          <li>You have the capacity to consent to participate</li>
          <li>You are participating of your own free will</li>
          <li>You understand that your anonymized responses will be used for research purposes</li>
          <li>You understand that you may withdraw at any time without penalty</li>
        </ul>

        <h3>🎓 Institutional Review</h3>
        <p>
          This research study has been reviewed and is conducted in accordance with ethical guidelines for human subjects research. The study follows principles of:
        </p>
        <ul>
          <li><strong>Respect for Persons:</strong> Treating individuals as autonomous agents and protecting those with diminished autonomy</li>
          <li><strong>Beneficence:</strong> Maximizing possible benefits and minimizing possible harms</li>
          <li><strong>Justice:</strong> Fair distribution of the benefits and burdens of research</li>
        </ul>

        <h3>📄 Consent Statement</h3>
        <p>
          <strong>By checking the box below and clicking "Continue," you acknowledge that:</strong>
        </p>
        <ul>
          <li>You have read this informed consent form in its entirety</li>
          <li>You understand the purpose, procedures, risks, and benefits of the study</li>
          <li>You voluntarily agree to participate in the C.O.G.N.I.T. research study</li>
          <li>You understand your participation is voluntary and you may withdraw at any time without penalty</li>
          <li>Your responses will be collected anonymously and used for research purposes, including potential publication of aggregated findings</li>
          <li>You understand the data retention and privacy policies described above</li>
          <li>You are at least 13 years old (or have appropriate consent if under 18)</li>
        </ul>

        <div style={{
          backgroundColor: 'var(--panel)',
          padding: '20px',
          borderRadius: '12px',
          marginTop: '20px',
          border: '2px solid var(--primary)'
        }}>
          <h4 style={{ margin: '0 0 12px', color: 'var(--primary)' }}>📌 Summary</h4>
          <p style={{ margin: '0', fontSize: '14px' }}>
            This study asks you to describe images in detail. Your anonymous responses will help research in AI and cognitive science. Participation takes 15-20 minutes and is voluntary. You may withdraw at any time. You have a chance to win a ₹10 reward through random selection. Your data will be kept confidential and used only for research.
          </p>
        </div>
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
            I confirm that I am 13 years or older (or have parental/guardian consent if under 18), I have read and understood this informed consent form, and I voluntarily agree to participate in the C.O.G.N.I.T. research study. I understand my responses will be collected anonymously and used for research purposes, including potential publication of aggregated findings. I understand I may withdraw at any time without penalty.
          </p>
        </label>
      </div>

      <div className="page-actions">
        <button
          className="primary"
          onClick={handleSubmit}
          disabled={!systemReady || submitting || !consentChecked}
        >
          {submitting ? "Processing..." : "Continue to Registration"}
        </button>
      </div>
    </div>
  );
}
