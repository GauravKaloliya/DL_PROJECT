import React, { useState, useEffect } from "react";
import { API_BASE } from "../utils/apiBase";

export default function PaymentPage({ 
  onPaymentComplete, 
  onBack,
  systemReady,
  participantId
}) {
  const [paymentChecked, setPaymentChecked] = useState(false);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [rewardStatus, setRewardStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    document.title = "Payment - C.O.G.N.I.T.";
    fetchRewardStatus();
  }, []);

  const fetchRewardStatus = async () => {
    if (!participantId) {
      setLoadingStatus(false);
      return;
    }
    try {
      const response = await fetch(`${API_BASE}/api/reward/${participantId}`);
      if (response.ok) {
        const data = await response.json();
        setRewardStatus(data);
      }
    } catch (err) {
      console.log("Failed to fetch reward status");
    } finally {
      setLoadingStatus(false);
    }
  };

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

  const isWinner = rewardStatus?.is_winner;
  const priorityEligible = rewardStatus?.priority_eligible;
  const totalWords = rewardStatus?.total_words || 0;
  const surveyRounds = rewardStatus?.survey_rounds || 0;

  return (
    <div className="panel">
      <div style={{ marginBottom: '16px' }}>
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
      <h2>🎁 Reward Opportunity</h2>
      <p style={{ color: 'var(--muted)', fontSize: '15px', marginBottom: '20px' }}>
        <strong>Complete the study and stand a chance to win ₹10 cashback!</strong>
      </p>
      
      <div className="welcome-info">
        {/* Main Reward Banner */}
        <div style={{
          background: isWinner 
            ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' 
            : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: '30px',
          borderRadius: '16px',
          marginBottom: '24px',
          textAlign: 'center',
          boxShadow: isWinner 
            ? '0 4px 20px rgba(17, 153, 142, 0.4)' 
            : '0 4px 20px rgba(102, 126, 234, 0.3)',
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
            <span style={{ fontSize: '40px' }}>{isWinner ? '🏆' : '🎁'}</span>
          </div>
          <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '0', color: 'white' }}>
            ₹10
          </p>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
            {isWinner ? "🎉 Congratulations! You've been selected!" : "Assured reward for selected participants"}
          </p>
        </div>

        {/* How It Works */}
        <div style={{ 
          backgroundColor: 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          borderLeft: '4px solid var(--primary)'
        }}>
          <h3 style={{ marginTop: '0', color: 'var(--primary)' }}>How It Works</h3>
          <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
            <li><strong>5% Chance to Win:</strong> Every participant has a 5% chance of being randomly selected for the ₹10 reward</li>
            <li><strong>Priority List Advantage:</strong> Active participants get added to a priority list, increasing their chances of winning</li>
            <li><strong>Instant UPI Transfer:</strong> Winners receive ₹10 directly to their UPI ID</li>
            <li><strong>Assured Reward:</strong> Selected participants are guaranteed to receive the reward</li>
          </ul>
        </div>

        {/* Priority List Info */}
        <div style={{ 
          backgroundColor: priorityEligible ? 'rgba(17, 153, 142, 0.1)' : 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          borderLeft: `4px solid ${priorityEligible ? '#11998e' : 'var(--warning)'}`,
          border: priorityEligible ? '1px solid #11998e' : undefined
        }}>
          <h3 style={{ marginTop: '0', color: priorityEligible ? '#11998e' : 'var(--warning)' }}>
            {priorityEligible ? '✅ You are on the Priority List!' : '⭐ Priority List Benefits'}
          </h3>
          <p style={{ marginBottom: '12px' }}>
            {priorityEligible 
              ? "Great job! You're in the priority pool for reward selection. This increases your chances of winning!"
              : "Get added to the priority list by being an active participant. Priority members have higher chances of winning!"}
          </p>
          {!loadingStatus && !priorityEligible && (
            <div style={{ 
              backgroundColor: 'rgba(255,255,255,0.5)', 
              padding: '12px', 
              borderRadius: '8px',
              fontSize: '14px'
            }}>
              <strong>How to get priority status:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                <li>Write detailed descriptions (500+ words total)</li>
                <li>Complete more survey rounds (3+ rounds)</li>
              </ul>
            </div>
          )}
          {totalWords > 0 && (
            <div style={{ marginTop: '12px', fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Your word count:</span>
                <strong>{totalWords} words</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Survey rounds completed:</span>
                <strong>{surveyRounds}</strong>
              </div>
            </div>
          )}
        </div>

        {/* UPI Payment Info */}
        <div style={{ 
          backgroundColor: 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          borderLeft: '4px solid var(--success)'
        }}>
          <h3 style={{ marginTop: '0', color: 'var(--success)' }}>Reward Payment Details</h3>
          <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
            <li>Reward amount: <strong>₹10</strong> per selected participant</li>
            <li>Payment method: <strong>UPI transfer</strong> to your registered UPI ID</li>
            <li>Processing time: Within <strong>24-48 hours</strong> of study completion</li>
            <li>No minimum threshold - winners get paid immediately</li>
          </ul>
        </div>

        {/* Participation Fee */}
        <div style={{ 
          backgroundColor: 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          borderLeft: '4px solid var(--muted)'
        }}>
          <h3 style={{ marginTop: '0', color: 'var(--muted)' }}>Participation Fee</h3>
          <p style={{ marginBottom: '12px' }}>
            A nominal fee of <strong>₹1</strong> is required to participate. This helps ensure:
          </p>
          <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
            <li>Serious and committed participants</li>
            <li>Protection against spam and bot activity</li>
            <li>Quality responses for our research</li>
          </ul>
          <p style={{ marginTop: '12px', marginBottom: '0', fontSize: '14px', color: 'var(--muted)' }}>
            Think of it as an entry ticket to a lucky draw where you can win ₹10!
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
          <strong>I agree to pay ₹1.00 to participate and understand the reward terms</strong>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--muted)', fontWeight: '400' }}>
            I understand that I have a chance to win ₹10 through random selection, 
            with priority given to active participants. I agree that the ₹1 participation 
            fee is non-refundable and payment details will be kept separate from research responses.
          </p>
        </label>
      </div>
      
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
        <button
          className="primary"
          onClick={handleSubmit}
          disabled={!systemReady || submitting}
          style={{ padding: '12px 24px', fontSize: '16px' }}
        >
          {submitting ? "Processing..." : "Pay ₹1 & Start Study"}
        </button>
      </div>
    </div>
  );
}