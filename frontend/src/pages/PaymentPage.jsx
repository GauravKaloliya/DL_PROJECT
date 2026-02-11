import React, { useState, useEffect } from "react";

export default function PaymentPage({ 
  onPaymentComplete, 
  onBack,
  systemReady 
}) {
  const [paymentChecked, setPaymentChecked] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    document.title = "Payment - C.O.G.N.I.T.";
  }, []);

  const handleSubmit = async () => {
    if (!systemReady) {
      setError("System is not ready. Please wait for the connection to be established.");
      return;
    }

    if (!paymentChecked) {
      setError("You must agree to the payment terms to continue");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await onPaymentComplete();
    } catch (err) {
      setError(err.message || "Payment processing failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel">
      <h2>Payment Required</h2>
      <p style={{ color: 'var(--muted)', fontSize: '15px', marginBottom: '20px' }}>
        <strong>C.O.G.N.I.T. Research Study Participation Fee</strong>
      </p>
      
      <div className="welcome-info">
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '30px',
          borderRadius: '16px',
          marginBottom: '24px',
          textAlign: 'center',
          boxShadow: '0 4px 20px rgba(102, 126, 234, 0.3)',
          border: 'none'
        }}>
          <div style={{  
            backgroundColor: 'white',  
            borderRadius: '50%',  
            width: '80px',  
            height: '80px',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
          }}>
            <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--primary)' }}>₹</span>
          </div>
          <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '0', color: 'white' }}>
            1.00
          </p>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
            One-time participation fee
          </p>
        </div>

        <div style={{ 
          backgroundColor: 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          borderLeft: '4px solid var(--primary)'
        }}>
          <h3 style={{ marginTop: '0', color: 'var(--primary)' }}>Why is there a fee?</h3>
          <p style={{ marginBottom: '12px' }}>
            A nominal fee of ₹1 (one rupee) is required to participate in this research study.
            This small fee serves several important purposes:
          </p>
          <ul style={{ paddingLeft: '20px' }}>
            <li><strong>Ensures Serious Participation:</strong> The minimal fee helps ensure that participants are genuinely interested in contributing to the research.</li>
            <li><strong>Reduces Spam/Bot Activity:</strong> The payment requirement helps prevent automated bots from flooding the study with invalid responses.</li>
            <li><strong>Quality Assurance:</strong> Participants who have made a small commitment are more likely to provide thoughtful and detailed responses.</li>
            <li><strong>Resource Allocation:</strong> The fee helps offset the costs of maintaining the research platform and storing your valuable data.</li>
          </ul>
        </div>

        <div style={{ 
          backgroundColor: 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          borderLeft: '4px solid var(--success)'
        }}>
          <h3 style={{ marginTop: '0', color: 'var(--success)' }}>Payment Terms</h3>
          <ul style={{ paddingLeft: '20px' }}>
            <li>This is a one-time, non-refundable fee of ₹1</li>
            <li>Your payment will be processed securely</li>
            <li>Payment information is not linked to your research responses</li>
            <li>All research data remains anonymous and confidential</li>
            <li>The fee is strictly for participation verification purposes</li>
          </ul>
        </div>

        <div style={{ 
          backgroundColor: 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          borderLeft: '4px solid var(--warning)'
        }}>
          <h3 style={{ marginTop: '0', color: 'var(--warning)' }}>What happens after payment?</h3>
          <p>
            Once you complete the payment, you will immediately proceed to the survey portion of the research study.
            Your payment confirmation will be recorded, but your responses and payment details will be kept completely separate
            to maintain your privacy and anonymity in the research data.
          </p>
        </div>

        <div className="banner info" style={{ marginTop: '20px' }}>
          <strong>Note:</strong> This is a simulated payment interface for research purposes.
          In a production environment, you would be redirected to a secure payment gateway.
        </div>
      </div>
      
      {error && (
        <div className="banner warning" style={{ marginTop: '20px' }}>
          {error}
        </div>
      )}
      
      <div className={`consent-checkbox ${error && !paymentChecked ? 'error' : ''}`} style={{ 
        backgroundColor: 'var(--panel)', 
        padding: '20px', 
        borderRadius: '12px',
        border: error && !paymentChecked ? '2px solid var(--error)' : '2px solid var(--border)',
        marginTop: '20px'
      }}>
        <input
          type="checkbox"
          checked={paymentChecked}
          onChange={(e) => {
            setPaymentChecked(e.target.checked);
            if (error) setError(null);
          }}
          id="payment-check"
          style={{ transform: 'scale(1.2)', marginRight: '12px' }}
        />
        <label htmlFor="payment-check" style={{ fontSize: '16px' }}>
          <strong>I agree to pay ₹1.00 to participate in this research study</strong>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--muted)', fontWeight: '400' }}>
            I understand that this is a one-time, non-refundable fee and agree to the payment terms.
            I acknowledge that my payment details will be kept separate from my research responses.
          </p>
        </label>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', marginTop: '24px' }}>
        <button
          className="ghost"
          onClick={onBack}
          disabled={submitting}
          style={{ padding: '12px 24px' }}
        >
          Back
        </button>
        <button
          className="primary"
          onClick={handleSubmit}
          disabled={!systemReady || submitting}
          style={{ padding: '12px 24px', fontSize: '16px' }}
        >
          {submitting ? "Processing..." : "Pay ₹1 & Continue"}
        </button>
      </div>
    </div>
  );
}