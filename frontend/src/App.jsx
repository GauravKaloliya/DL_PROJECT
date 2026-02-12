import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import UserDetailsPage from "./pages/UserDetailsPage.jsx";
import ConsentPage from "./pages/ConsentPage.jsx";
import PaymentPage from "./pages/PaymentPage.jsx";
import TrialPage from "./pages/TrialPage.jsx";
import FinishedPage from "./pages/FinishedPage.jsx";
import { getApiUrl } from "./utils/apiBase";

function createId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

function getStoredValue(key, fallback) {
  const stored = sessionStorage.getItem(key);
  return stored ? JSON.parse(stored) : fallback;
}

function saveStoredValue(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="panel">
          <h1>Something went wrong</h1>
          <p>Please refresh the page to continue.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.type}`}>
          <span>{toast.message}</span>
          {toast.action && (
            <button
              className="toast-action"
              onClick={() => {
                toast.action.onClick();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
          <button onClick={() => onDismiss(toast.id)} aria-label="Dismiss">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function Confetti({ show }) {
  if (!show) return null;
  return (
    <div className="confetti">
      {Array.from({ length: 24 }).map((_, index) => (
        <span key={index} className={`confetti-piece piece-${index % 6}`} />
      ))}
    </div>
  );
}

export default function App() {
  const navigate = useNavigate();
  
  // System state
  const [systemReady, setSystemReady] = useState(false);
  const [systemError, setSystemError] = useState(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [darkMode, setDarkMode] = useState(getStoredValue("darkMode", false));
  
  // Flow state
  const [stage, setStage] = useState(getStoredValue("stage", "consent"));
  const [participantId] = useState(() => getStoredValue("participantId", createId()));
  const [sessionId] = useState(() => getStoredValue("sessionId", createId()));
  const [consentGiven, setConsentGiven] = useState(() => getStoredValue("consentGiven", false));
  
  // Demographics state
  const [demographics, setDemographics] = useState(
    getStoredValue("demographics", {
      username: "",
      email: "",
      phone: "",
      gender: "",
      age: "",
      place: "",
      native_language: "",
      prior_experience: ""
    })
  );
  
  // Trial state
  const [trial, setTrial] = useState(getStoredValue("trial", null));
  const [surveyCompleted, setSurveyCompleted] = useState(getStoredValue("surveyCompleted", 0));
  const [mainCompleted, setMainCompleted] = useState(getStoredValue("mainCompleted", 0));
  const [surveyFeedbackReady, setSurveyFeedbackReady] = useState(false);
  const [readyForNext, setReadyForNext] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);
  
  // UI state
  const [toasts, setToasts] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);

  // Persist state
  useEffect(() => { saveStoredValue("participantId", participantId); }, [participantId]);
  useEffect(() => { saveStoredValue("sessionId", sessionId); }, [sessionId]);
  useEffect(() => { saveStoredValue("consentGiven", consentGiven); }, [consentGiven]);
  useEffect(() => { saveStoredValue("demographics", demographics); }, [demographics]);
  useEffect(() => { saveStoredValue("stage", stage); }, [stage]);
  useEffect(() => { saveStoredValue("trial", trial); }, [trial]);
  useEffect(() => { saveStoredValue("surveyCompleted", surveyCompleted); }, [surveyCompleted]);
  useEffect(() => { saveStoredValue("mainCompleted", mainCompleted); }, [mainCompleted]);
  useEffect(() => { saveStoredValue("darkMode", darkMode); document.body.classList.toggle("dark", darkMode); }, [darkMode]);
  
  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Health check on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const response = await fetch(getApiUrl('/api/health'));
        if (response.ok) {
          const data = await response.json();
          if (data.status === 'healthy' && data.services.database === 'connected') {
            setSystemReady(true);
            setSystemError(null);
          } else {
            setSystemReady(false);
            setSystemError('System is degraded. Please try again later.');
          }
        } else {
          setSystemReady(false);
          setSystemError('Unable to connect to the server.');
        }
      } catch (err) {
        setSystemReady(false);
        setSystemError('Unable to connect to the server. Please check your connection.');
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const addToast = useCallback((message, type = "info", action) => {
    const id = createId();
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  // Create participant in database
  const createParticipant = async () => {
    const response = await fetch(getApiUrl('/api/participants'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        session_id: sessionId,
        username: demographics.username,
        email: demographics.email,
        phone: demographics.phone,
        gender: demographics.gender,
        age: parseInt(demographics.age),
        place: demographics.place,
        native_language: demographics.native_language,
        prior_experience: demographics.prior_experience
      })
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMessage = data.error || "Failed to create participant";
      throw new Error(errorMessage);
    }

    return response.json();
  };

  // Record consent in database
  const recordConsent = async () => {
    const response = await fetch(getApiUrl('/api/consent'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        participant_id: participantId,
        consent_given: true
      })
    });

    if (!response.ok) {
      const data = await response.json();
      const errorMessage = data.error || "Failed to record consent";
      throw new Error(errorMessage);
    }

    return response.json();
  };

  // Handle user details submission
  const handleUserDetailsSubmit = async () => {
    try {
      await createParticipant();
      if (consentGiven) {
        await recordConsent();
      }
      setStage("payment");
      addToast("Details saved successfully", "success");
    } catch (err) {
      // If participant already exists (409), that's okay - just continue
      if (err.message && err.message.includes("already exists")) {
        if (consentGiven) {
          try {
            await recordConsent();
          } catch (consentErr) {
            // Consent might already be recorded too, ignore error
            console.log("Consent already recorded or failed:", consentErr.message);
          }
        }
        setStage("payment");
        addToast("Details saved successfully", "success");
      } else {
        addToast(err.message, "error");
        throw err;
      }
    }
  };

  // Handle consent given
  const handleConsentGiven = async () => {
    setConsentGiven(true);
    setStage("user-details");
    addToast("Consent recorded successfully", "success");
  };

  // Handle payment completion
  const handlePaymentComplete = async () => {
    setStage("survey");
    try {
      await fetchImage("survey");
      addToast("Payment completed successfully", "success");
    } catch (err) {
      addToast("Failed to load first survey image. Please try again.", "error");
      // Stay on survey page but show error
    }
  };

  // Fetch image
  const fetchImage = async (type) => {
    setFetchingImage(true);
    setReadyForNext(false);
    setSurveyFeedbackReady(false);

    try {
      const response = await fetch(getApiUrl(`/api/images/random?type=${type}&session_id=${sessionId}`));
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Unable to fetch image");
      }
      const data = await response.json();
      setTrial(data);
    } catch (error) {
      addToast(error.message || "Failed to load image", "error");
      // Don't set trial to null, keep previous state or set to empty object
      setTrial(null);
    } finally {
      setFetchingImage(false);
    }
  };

  // Get next image type
  const getNextType = () => {
    if (mainCompleted >= 14) {
      return "attention";
    }
    if (Math.random() < 0.25) {
      return "attention";
    }
    return "normal";
  };

  // Handle submission
  const handleSubmit = async (formData) => {
    const payload = {
      participant_id: participantId,
      session_id: sessionId,
      image_id: trial.image_id,
      image_url: trial.image_url,
      description: formData.description,
      rating: formData.rating,
      feedback: formData.comments,
      time_spent_seconds: formData.timeSpentSeconds,
      is_survey: trial.is_survey,
      is_attention: trial.is_attention,
      attention_expected: formData.attentionExpected
    };

    const response = await fetch(getApiUrl('/api/submit'), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || "Submission failed");
    }

    const result = await response.json();

    if (trial.is_attention && !result.attention_passed) {
      addToast("Please follow the special instructions next time!", "warning");
    } else {
      addToast("Your response was saved!", "success");
    }

    setShowConfetti(true);
    setTimeout(() => setShowConfetti(false), 1200);

    if (trial.is_survey) {
      setSurveyCompleted((prev) => prev + 1);
      setSurveyFeedbackReady(true);
    } else {
      setMainCompleted((prev) => prev + 1);
      setReadyForNext(true);
    }
  };

  // Handle next trial
  const handleNext = async () => {
    setReadyForNext(false);

    if (stage === "survey") {
      // Transition from survey to main trials
      addToast("Starting main trials...", "success");
      await fetchImage(getNextType());
      setStage("trial");
      return;
    }

    if (mainCompleted >= 15) {
      setStage("finished");
      return;
    }

    await fetchImage(getNextType());
  };

  // Handle finish
  const handleFinish = () => {
    setStage("finished");
  };

  // Handle survey continue
  const handleSurveyContinue = async () => {
    setSurveyFeedbackReady(false);
    await fetchImage("survey");
  };

  // Handle survey finish
  const handleSurveyFinish = () => {
    setStage("finished");
  };

  // Render based on stage
  const renderContent = () => {
    if (!systemReady && !systemError) {
      return (
        <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Loading C.O.G.N.I.T.</h2>
          <p style={{ color: 'var(--muted)', marginTop: '16px' }}>
            Checking system connectivity...
          </p>
          <div className="spinner" style={{ margin: '24px auto 0' }} />
        </div>
      );
    }

    if (systemError) {
      return (
        <div className="panel" style={{ textAlign: 'center' }}>
          <h2>System Error</h2>
          <p style={{ color: 'var(--muted)', margin: '16px 0' }}>{systemError}</p>
          <button className="primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      );
    }

    switch (stage) {
      case "consent":
        return (
          <ConsentPage
            onConsentGiven={handleConsentGiven}
            systemReady={systemReady}
          />
        );

      case "user-details":
        return (
          <UserDetailsPage
            demographics={demographics}
            setDemographics={setDemographics}
            onSubmit={handleUserDetailsSubmit}
            onBack={() => setStage("consent")}
            systemReady={systemReady}
          />
        );
      
      case "payment":
        return (
          <PaymentPage
            onPaymentComplete={handlePaymentComplete}
            onBack={() => setStage("user-details")}
            systemReady={systemReady}
            participantId={participantId}
          />
        );
      
      case "survey":
        return (
          <TrialPage
            trial={trial}
            participantId={participantId}
            sessionId={sessionId}
            onSubmit={handleSubmit}
            onNext={handleNext}
            onFinish={handleFinish}
            showNext={readyForNext}
            isSurvey={true}
            surveyFeedbackReady={surveyFeedbackReady}
            onSurveyContinue={handleSurveyContinue}
            onSurveyFinish={handleSurveyFinish}
          />
        );
      
      case "trial":
        return (
          <TrialPage
            trial={trial}
            participantId={participantId}
            sessionId={sessionId}
            onSubmit={handleSubmit}
            onNext={handleNext}
            onFinish={handleFinish}
            showNext={readyForNext}
            isSurvey={false}
          />
        );
      
      case "finished":
        return <FinishedPage surveyCompleted={surveyCompleted} participantId={participantId} />;
      
      default:
        return <UserDetailsPage demographics={demographics} setDemographics={setDemographics} onSubmit={handleUserDetailsSubmit} onBack={() => setStage("consent")} systemReady={systemReady} />;
    }
  };

  return (
    <ErrorBoundary onError={() => addToast("Unexpected error occurred.", "error")}>
      <div className="app">
        <header className="header">
          <div>
            <h1>C.O.G.N.I.T.</h1>
            <p className="subtitle">Describe each image with as much detail as possible</p>
          </div>
          <div className="header-actions">
            <button 
              className="ghost dark-mode-toggle" 
              onClick={() => setDarkMode((prev) => !prev)}
              title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {darkMode ? "☀️" : "🌙"}
            </button>
            <button className="ghost" onClick={() => navigate("/")}>
              API Docs
            </button>
            <div className={`status-dot ${online ? "online" : "offline"}`}>
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </header>

        {!online && systemReady && (
          <div className="banner warning">
            You appear to be offline. Submissions will fail until connectivity is restored.
          </div>
        )}

        {renderContent()}

        <div className="branding-footer">
          Created by Gaurav Kaloliya
        </div>
      </div>
      
      <Confetti show={showConfetti} />
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
    </ErrorBoundary>
  );
}
