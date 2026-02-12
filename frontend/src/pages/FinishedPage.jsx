import React, { useEffect, useState } from "react";
import { getApiUrl } from "../utils/apiBase";

export default function FinishedPage({ surveyCompleted, participantId }) {
  const [rewardStatus, setRewardStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    document.title = "Thank You - C.O.G.N.I.T.";
    if (participantId) {
      checkRewardWinner();
    } else {
      setLoading(false);
    }
  }, [participantId]);

  const checkRewardWinner = async () => {
    try {
      // First check current status
      const statusResponse = await fetch(getApiUrl(`/api/reward/${participantId}`));
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        // If not already a winner, try to select
        if (!statusData.is_winner) {
          const selectResponse = await fetch(getApiUrl(`/api/reward/select/${participantId}`), {
            method: "POST",
            headers: { "Content-Type": "application/json" }
          });
          if (selectResponse.ok) {
            const selectData = await selectResponse.json();
            if (selectData.selected) {
              setRewardStatus({ is_winner: true, reward_amount: selectData.reward_amount });
            } else {
              setRewardStatus({ ...statusData, was_checked: true });
            }
          } else {
            setRewardStatus(statusData);
          }
        } else {
          setRewardStatus(statusData);
        }
      }
    } catch (err) {
      console.log("Failed to check reward status");
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    // Preserve dark mode setting before clearing
    const darkMode = sessionStorage.getItem("darkMode");
    // Clear session storage and reload
    sessionStorage.clear();
    // Restore dark mode setting
    if (darkMode !== null) {
      sessionStorage.setItem("darkMode", darkMode);
    }
    window.location.href = "/";
  };

  const isWinner = rewardStatus?.is_winner;
  const totalWords = rewardStatus?.total_words || 0;
  const priorityEligible = rewardStatus?.priority_eligible;

  return (
    <div className="panel">
      <div style={{ textAlign: 'center' }}>
        <h2>Thank you for completing the C.O.G.N.I.T. survey</h2>
        <p className="page-subtitle">
          You have completed {surveyCompleted} survey trials!
          Your responses have been recorded.
        </p>
        
        {/* Reward Status Section */}
        {!loading && (
          <div style={{
            background: isWinner 
              ? 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' 
              : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '24px',
            borderRadius: '16px',
            margin: '24px 0',
            color: 'white',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}>
            {isWinner ? (
              <>
                <div style={{ fontSize: '48px', marginBottom: '12px' }}>🎉</div>
                <h3 style={{ margin: '0 0 12px', color: 'white' }}>Congratulations!</h3>
                <p style={{ fontSize: '20px', fontWeight: 'bold', margin: '0 0 8px' }}>
                  You've been selected as a reward winner!
                </p>
                <p style={{ margin: '0', opacity: 0.9, fontSize: '14px' }}>
                  Thank you for your valuable participation. Your reward will be processed shortly.
                </p>
              </>
            ) : (
              <>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>🎁</div>
                <h3 style={{ margin: '0 0 12px', color: 'white' }}>Thank You for Participating!</h3>
                <p style={{ margin: '0 0 12px', opacity: 0.9 }}>
                  Your responses are valuable to our research and contribute to advancing language understanding models.
                </p>
                {totalWords > 0 && (
                  <p style={{ margin: '0', fontSize: '14px', opacity: 0.85 }}>
                    You wrote <strong>{totalWords} words</strong> across your responses. 
                    {priorityEligible 
                      ? " Your detailed participation puts you in the priority pool for future opportunities!" 
                      : " Keep participating in future studies for more chances to win!"}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* UPI Reward Reminder */}
        <div style={{ 
          backgroundColor: 'var(--panel)', 
          padding: '20px', 
          borderRadius: '12px',
          marginBottom: '20px',
          border: '2px dashed var(--primary)',
          textAlign: 'left'
        }}>
          <h4 style={{ marginTop: '0', color: 'var(--primary)' }}>💰 About the Reward Program</h4>
          <ul style={{ paddingLeft: '20px', marginBottom: '0', fontSize: '14px' }}>
            <li>Participants are <strong>randomly selected</strong> to receive <strong>₹10 rewards</strong></li>
            <li>Active participants who write detailed descriptions get added to a <strong>priority list</strong></li>
            <li>Priority participants have <strong>higher chances</strong> of being selected</li>
            <li>Rewards are sent via <strong>UPI transfer</strong> within 24-48 hours</li>
            <li>If you're selected, you'll receive an email/SMS with payment confirmation</li>
          </ul>
        </div>

        <p className="debrief">
          Debrief: C.O.G.N.I.T. (Cognitive Network for Image & Text Modeling) 
          advances our understanding of how humans describe visual content and how AI can better model this cognitive process. Your responses
          contribute to improving image-text understanding and generation systems.
        </p>

        <div className="page-actions">
          <button className="primary" onClick={handleFinish} style={{ padding: '16px 32px', fontSize: '16px' }}>
            Finish
          </button>
        </div>
      </div>
    </div>
  );
}
