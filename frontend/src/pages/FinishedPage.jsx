import React, { useEffect } from "react";

export default function FinishedPage({ surveyCompleted }) {
  useEffect(() => {
    document.title = "Thank You - C.O.G.N.I.T.";
  }, []);

  const handleFinish = () => {
    // Clear session storage and reload
    sessionStorage.clear();
    window.location.href = "/";
  };

  return (
    <div className="panel">
      <div style={{ textAlign: 'center' }}>
        <h2>Thank you for completing the C.O.G.N.I.T. survey</h2>
        <p>
          You have completed {surveyCompleted} survey trials!
          Your responses have been recorded.
        </p>
        <p className="debrief">
          Debrief: C.O.G.N.I.T. (Cognitive Observation & Generalized Narrative Inquiry Tool) 
          examines how people describe visual scenes. Your responses
          will help improve language understanding models.
        </p>
        <button className="primary" onClick={handleFinish} style={{ marginTop: '20px' }}>
          Finish
        </button>
      </div>
    </div>
  );
}
