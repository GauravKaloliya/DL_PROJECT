import React, { useState, useEffect } from "react";
import { getApiUrl } from "../utils/apiBase";

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
      const response = await fetch(getApiUrl(`/api/reward/${participantId}`));
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

    if (!participantId) {
      setError("Participant details are missing. Please restart the study.");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch(getApiUrl("/api/payment/create-order"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participant_id: participantId })
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to initialize payment");
      }

      const data = await response.json();

      if (!window.Razorpay) {
        throw new Error("Payment gateway failed to load. Please refresh and try again.");
      }

      const options = {
        key: data.key,
        amount: data.amount,
        currency: data.currency || "INR",
        order_id: data.order_id,
        name: "C.O.G.N.I.T.",
        description: "Research participation fee",
        method: {
          upi: true,
          card: true,
          netbanking: true,
          wallet: true
        },
        config: {
          display: {
            preferences: {
              show_default_blocks: true
            }
          }
        },
        handler: async function (paymentResponse) {
          try {
            const verifyResponse = await fetch(getApiUrl("/api/payment/verify"), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(paymentResponse)
            });

            if (!verifyResponse.ok) {
              const verifyData = await verifyResponse.json().catch(() => ({}));
              throw new Error(verifyData.error || "Payment verification failed");
            }

            await onPaymentComplete();
          } catch (err) {
            setError(err.message || "Payment processing failed. Please try again.");
          } finally {
            setSubmitting(false);
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false);
          }
        }
      };

      const razorpay = new window.Razorpay(options);
      razorpay.on("payment.failed", () => {
        setError("Payment failed. Please try again.");
        setSubmitting(false);
      });
      razorpay.open();
    } catch (err) {
      setError(err.message || "Payment processing failed. Please try again.");
      setSubmitting(false);
    }
  };

  const isWinner = rewardStatus?.is_winner;
  const priorityEligible = rewardStatus?.priority_eligible;
  const totalWords = rewardStatus?.total_words || 0;
  const surveyRounds = rewardStatus?.survey_rounds || 0;

  return (
    <div className="panel">
      <div className="page-top-actions">
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
      <h2>🎁 Win ₹10 Cashback - Get 10X Returns!</h2>
      <p className="page-subtitle">
        <strong>Pay just ₹1 to participate and get a chance to win ₹10 directly to your UPI!</strong>
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
            backgroundColor: 'var(--panel)',  
            borderRadius: '50%',  
            width: '80px',  
            height: '80px',
            margin: '0 auto 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
            border: '2px solid var(--border)'
          }}>
            <span style={{ fontSize: '40px' }}>{isWinner ? '🏆' : '🎁'}</span>
          </div>
          <p style={{ fontSize: '36px', fontWeight: 'bold', margin: '0', color: 'white' }}>
            ₹10
          </p>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,0.9)', fontSize: '14px' }}>
            {isWinner ? "🎉 Congratulations! You've been selected!" : "10X Your Money - Win ₹10 with Just ₹1!"}
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
          <h3 style={{ marginTop: '0', color: 'var(--primary)' }}>✨ How It Works</h3>
          <ul style={{ paddingLeft: '20px', marginBottom: '0' }}>
            <li><strong>🎯 Simple Entry:</strong> Pay just ₹1 to participate in this exciting research study</li>
            <li><strong>💎 Win Big:</strong> Get randomly selected to win ₹10 - that's 10X your entry amount!</li>
            <li><strong>⭐ Priority Advantage:</strong> Active participants get added to a priority list for higher winning chances</li>
            <li><strong>⚡ Instant Payout:</strong> Winners receive ₹10 directly to their UPI ID within 24-48 hours</li>
            <li><strong>🎁 Guaranteed Transfer:</strong> If selected, your reward is 100% assured</li>
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
            {priorityEligible ? '✅ You are on the Priority List!' : '⭐ Boost Your Winning Chances!'}
          </h3>
          <p style={{ marginBottom: '12px' }}>
            {priorityEligible 
              ? "Excellent! You're in the priority pool with significantly higher chances of winning the ₹10 reward!"
              : "Get on the priority list to maximize your chances! Priority members have better odds of winning."}
          </p>
          {!loadingStatus && !priorityEligible && (
            <div style={{ 
              backgroundColor: 'var(--soft-panel)', 
              padding: '12px', 
              borderRadius: '8px',
              fontSize: '14px',
              border: '1px solid var(--border)'
            }}>
              <strong>How to get priority status:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
                <li>Write detailed descriptions (120+ words total)</li>
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
            <li>Reward amount: <strong>₹10</strong> to selected participants</li>
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
          borderLeft: '4px solid #667eea',
          background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.05) 0%, rgba(118, 75, 162, 0.05) 100%)'
        }}>
          <h3 style={{ marginTop: '0', color: '#667eea' }}>💰 Just ₹1 Entry Fee!</h3>
          <p style={{ marginBottom: '12px', fontSize: '16px', fontWeight: '500' }}>
            Pay only <strong style={{ fontSize: '20px', color: '#667eea' }}>₹1</strong> to unlock your chance to win <strong style={{ fontSize: '20px', color: '#11998e' }}>₹10</strong>!
          </p>
          <div style={{ 
            backgroundColor: 'var(--soft-panel)', 
            padding: '15px', 
            borderRadius: '8px',
            marginBottom: '12px',
            border: '1px solid var(--border)'
          }}>
            <p style={{ margin: '0 0 8px', fontWeight: '600', color: 'var(--text)' }}>🎯 Why Pay ₹1?</p>
            <ul style={{ paddingLeft: '20px', marginBottom: '0', fontSize: '14px' }}>
              <li>Ensures genuine participation (no spam/bots)</li>
              <li>Guarantees quality research data</li>
              <li>Funds the ₹10 reward pool</li>
            </ul>
          </div>
          <p style={{ marginTop: '12px', marginBottom: '0', fontSize: '15px', fontWeight: '500', color: '#11998e' }}>
            ✨ Think of it as your lucky ticket to win 10X more!
          </p>
        </div>

        <div className="banner info" style={{ marginTop: '20px' }}>
          <strong>Note:</strong> ₹1 processing charge – non-refundable
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
          <strong>I agree to pay ₹1 and accept the reward terms</strong>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: 'var(--muted)', fontWeight: '400' }}>
            I understand that paying ₹1 gives me a chance to win ₹10 through random selection. 
            Active participants get priority status for better winning chances. The ₹1 fee is 
            non-refundable and payment details remain separate from research responses.
          </p>
        </label>
      </div>
      
      <div className="page-actions">
        <button
          className="primary"
          onClick={handleSubmit}
          disabled={!systemReady || submitting}
          style={{ 
            padding: '12px 32px', 
            fontSize: '18px', 
            fontWeight: '600',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            border: 'none',
            boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
          }}
        >
          {submitting ? "Processing..." : "🎯 Pay ₹1 & Win ₹10!"}
        </button>
      </div>
    </div>
  );
}