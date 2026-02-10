import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const MIN_WORDS = 20;
const PRACTICE_TARGET = 2;
const MAIN_TARGET = 10;
const ATTENTION_TARGET = 1;
const AUTO_NEXT_DELAY_MS = 1200;

const attentionInstruction = {
  "attention/attention-ocean.svg": {
    text: "Attention check: include the word \"ocean\" in your description.",
    expected: "ocean"
  }
};

function getStoredValue(key, fallback) {
  const stored = sessionStorage.getItem(key);
  return stored ? JSON.parse(stored) : fallback;
}

function saveStoredValue(key, value) {
  sessionStorage.setItem(key, JSON.stringify(value));
}

function createId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
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
  const [darkMode, setDarkMode] = useState(getStoredValue("darkMode", false));
  const [online, setOnline] = useState(navigator.onLine);
  const [stage, setStage] = useState("consent");
  const [consentChecked, setConsentChecked] = useState(false);
  const [demographics, setDemographics] = useState(
    getStoredValue("demographics", {
      ageGroup: "",
      language: "",
      experience: ""
    })
  );
  const [participantId] = useState(() => getStoredValue("participantId", createId()));
  const [sessionId] = useState(() => getStoredValue("sessionId", createId()));
  const [trial, setTrial] = useState(null);
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [practiceCompleted, setPracticeCompleted] = useState(0);
  const [mainCompleted, setMainCompleted] = useState(0);
  const [attentionRemaining, setAttentionRemaining] = useState(ATTENTION_TARGET);
  const [submissions, setSubmissions] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [practiceFeedbackReady, setPracticeFeedbackReady] = useState(false);
  const [readyForNext, setReadyForNext] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState(Date.now());
  const nextTimeout = useRef(null);

  const wordCount = useMemo(() => {
    return description.trim() ? description.trim().split(/\s+/).length : 0;
  }, [description]);

  const charCount = description.length;

  useEffect(() => {
    saveStoredValue("participantId", participantId);
    saveStoredValue("sessionId", sessionId);
  }, [participantId, sessionId]);

  useEffect(() => {
    saveStoredValue("demographics", demographics);
  }, [demographics]);

  useEffect(() => {
    saveStoredValue("darkMode", darkMode);
    document.body.classList.toggle("dark", darkMode);
  }, [darkMode]);

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

  const addToast = useCallback((message, type = "info", action) => {
    const id = createId();
    setToasts((prev) => [...prev, { id, message, type, action }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const clearNextTimeout = () => {
    if (nextTimeout.current) {
      clearTimeout(nextTimeout.current);
      nextTimeout.current = null;
    }
  };

  const fetchImage = useCallback(async (type) => {
    setFetchingImage(true);
    try {
      const response = await fetch(`${API_BASE}/api/images/random?type=${type}&session_id=${sessionId}`);
      if (!response.ok) {
        throw new Error("Unable to fetch image");
      }
      const data = await response.json();
      setTrial(data);
      setDescription("");
      setRating(5);
      setComments("");
      setIsZoomed(false);
      setTrialStartTime(Date.now());
      setPracticeFeedbackReady(false);
      setReadyForNext(false);
    } catch (error) {
      addToast(error.message || "Failed to load image", "error");
    } finally {
      setFetchingImage(false);
    }
  }, [addToast, sessionId]);

  const startPractice = async () => {
    setStage("practice");
    await fetchImage("practice");
  };

  const startMain = async () => {
    setStage("trial");
    await fetchImage(getNextType());
  };

  const getNextType = () => {
    if (attentionRemaining > 0) {
      if (mainCompleted >= MAIN_TARGET - 1) {
        return "attention";
      }
      if (Math.random() < 0.25) {
        return "attention";
      }
    }
    return "normal";
  };

  const handleConsentStart = () => {
    if (!consentChecked) return;
    startPractice();
  };

  const handleSubmit = async () => {
    if (!trial || submitting) return;
    if (wordCount < MIN_WORDS) {
      addToast(`Please write at least ${MIN_WORDS} words.`, "error");
      return;
    }
    setSubmitting(true);
    const timeSpentSeconds = Math.round((Date.now() - trialStartTime) / 1000);
    const attentionMeta = attentionInstruction[trial.image_id];
    const payload = {
      participant_id: participantId,
      session_id: sessionId,
      image_id: trial.image_id,
      image_url: trial.image_url,
      description,
      rating,
      feedback: comments,
      time_spent_seconds: timeSpentSeconds,
      word_count: wordCount,
      is_practice: trial.is_practice,
      is_attention: trial.is_attention,
      attention_expected: attentionMeta?.expected || ""
    };

    try {
      const response = await fetch(`${API_BASE}/api/submit`, {
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
        addToast("Attention check missed. Please follow instructions next time.", "warning");
      } else {
        addToast("Submission saved!", "success");
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
      setSubmissions((prev) => [...prev, { ...payload, attention_passed: result.attention_passed }]);

      if (trial.is_practice) {
        setPracticeCompleted((prev) => prev + 1);
        setPracticeFeedbackReady(true);
      } else {
        setMainCompleted((prev) => prev + 1);
        if (trial.is_attention) {
          setAttentionRemaining((prev) => Math.max(prev - 1, 0));
        }
        setReadyForNext(true);
        clearNextTimeout();
        nextTimeout.current = setTimeout(() => {
          handleNext();
        }, AUTO_NEXT_DELAY_MS);
      }
    } catch (error) {
      addToast(error.message || "Submission failed. Please retry.", "error", {
        label: "Retry",
        onClick: () => handleSubmit()
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    clearNextTimeout();
    setReadyForNext(false);
    if (stage === "practice" && practiceCompleted < PRACTICE_TARGET) {
      await fetchImage("practice");
      return;
    }
    if (stage === "practice") {
      await startMain();
      return;
    }
    if (mainCompleted >= MAIN_TARGET) {
      setStage("finished");
      return;
    }
    await fetchImage(getNextType());
  };

  const handleFinishEarly = () => {
    setStage("finished");
  };

  const downloadData = () => {
    const blob = new Blob([JSON.stringify(submissions, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `session-${sessionId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const currentInstruction = trial?.is_attention ? attentionInstruction[trial.image_id] : null;

  return (
    <ErrorBoundary onError={() => addToast("Unexpected error occurred.", "error")}>
      <div className="app">
        <header className="header">
          <div>
            <h1>Image Description Study</h1>
            <p className="subtitle">Describe each image with as much detail as possible.</p>
          </div>
          <div className="header-actions">
            <button className="ghost" onClick={() => setDarkMode((prev) => !prev)}>
              {darkMode ? "Light mode" : "Dark mode"}
            </button>
            <div className={`status-dot ${online ? "online" : "offline"}`}>
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </header>

        {!online && (
          <div className="banner warning">
            You appear to be offline. Submissions will fail until connectivity is restored.
          </div>
        )}

        {stage === "consent" && (
          <div className="panel">
            <h2>Consent</h2>
            <p>
              By participating, you consent to having your descriptions stored anonymously for research
              purposes. You may stop at any time.
            </p>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => setConsentChecked(event.target.checked)}
              />
              I consent to participate.
            </label>
            <div className="form-grid">
              <div>
                <label>Age group (optional)</label>
                <select
                  value={demographics.ageGroup}
                  onChange={(event) =>
                    setDemographics((prev) => ({ ...prev, ageGroup: event.target.value }))
                  }
                >
                  <option value="">Prefer not to say</option>
                  <option value="18-24">18-24</option>
                  <option value="25-34">25-34</option>
                  <option value="35-44">35-44</option>
                  <option value="45-54">45-54</option>
                  <option value="55+">55+</option>
                </select>
              </div>
              <div>
                <label>Native language (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., English"
                  value={demographics.language}
                  onChange={(event) =>
                    setDemographics((prev) => ({ ...prev, language: event.target.value }))
                  }
                />
              </div>
              <div>
                <label>Prior experience (optional)</label>
                <input
                  type="text"
                  placeholder="e.g., photography, art"
                  value={demographics.experience}
                  onChange={(event) =>
                    setDemographics((prev) => ({ ...prev, experience: event.target.value }))
                  }
                />
              </div>
            </div>
            <button className="primary" onClick={handleConsentStart} disabled={!consentChecked}>
              Start
            </button>
          </div>
        )}

        {stage === "practice" && trial && (
          <div className="panel">
            <div className="progress">
              <span>Practice {practiceCompleted + 1} / {PRACTICE_TARGET}</span>
            </div>
            {practiceFeedbackReady ? (
              <div className="guidance">
                <h2>Practice feedback</h2>
                <p>
                  Great work! Aim to describe colors, textures, relationships, and any notable objects.
                  Remember to write at least {MIN_WORDS} words.
                </p>
                <button className="primary" onClick={handleNext}>
                  Continue
                </button>
              </div>
            ) : (
              <TrialForm
                trial={trial}
                description={description}
                onDescription={setDescription}
                rating={rating}
                onRating={setRating}
                comments={comments}
                onComments={setComments}
                wordCount={wordCount}
                charCount={charCount}
                minWords={MIN_WORDS}
                onSubmit={handleSubmit}
                submitting={submitting}
                isZoomed={isZoomed}
                onToggleZoom={() => setIsZoomed((prev) => !prev)}
                instruction={currentInstruction}
                fetchingImage={fetchingImage}
                showNext={false}
                onNext={handleNext}
                showFinish={false}
              />
            )}
          </div>
        )}

        {stage === "trial" && trial && (
          <div className="panel">
            <div className="progress">
              <span>Progress {mainCompleted} / {MAIN_TARGET}</span>
              <button className="ghost" onClick={handleFinishEarly}>
                Finish / Stop
              </button>
            </div>
            <TrialForm
              trial={trial}
              description={description}
              onDescription={setDescription}
              rating={rating}
              onRating={setRating}
              comments={comments}
              onComments={setComments}
              wordCount={wordCount}
              charCount={charCount}
              minWords={MIN_WORDS}
              onSubmit={handleSubmit}
              submitting={submitting}
              isZoomed={isZoomed}
              onToggleZoom={() => setIsZoomed((prev) => !prev)}
              instruction={currentInstruction}
              fetchingImage={fetchingImage}
              showNext={readyForNext}
              onNext={handleNext}
              showFinish={true}
            />
          </div>
        )}

        {stage === "finished" && (
          <div className="panel">
            <h2>Thank you!</h2>
            <p>
              You have completed {mainCompleted} main trials and {practiceCompleted} practice trials.
              Your responses have been recorded. If you would like a copy of your data, download it
              below.
            </p>
            <p className="debrief">
              Debrief: This study examines how people describe visual scenes. Your anonymous responses
              will help improve language understanding models.
            </p>
            <button className="primary" onClick={downloadData} disabled={submissions.length === 0}>
              Download my data
            </button>
          </div>
        )}
      </div>
      <Confetti show={showConfetti} />
      <Toasts toasts={toasts} onDismiss={(id) => setToasts((prev) => prev.filter((toast) => toast.id !== id))} />
    </ErrorBoundary>
  );
}

function TrialForm({
  trial,
  description,
  onDescription,
  rating,
  onRating,
  comments,
  onComments,
  wordCount,
  charCount,
  minWords,
  onSubmit,
  submitting,
  isZoomed,
  onToggleZoom,
  instruction,
  fetchingImage,
  showNext,
  onNext,
  showFinish
}) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [trial.image_id]);

  const imageSrc = `${API_BASE}${trial.image_url}`;

  return (
    <div className="trial">
      {instruction && <div className="banner info">{instruction.text}</div>}
      <div className={`image-container ${isZoomed ? "zoomed" : ""}`}>
        <img src={imageSrc} alt="Study prompt" onClick={onToggleZoom} />
        <button className="zoom-toggle" onClick={onToggleZoom}>
          {isZoomed ? "Reset zoom" : "Zoom"}
        </button>
      </div>
      <div className="meta">
        <span className="timer">Time: {elapsed}s</span>
        {trial.is_attention && <span className="tag attention">Attention check</span>}
        {trial.is_practice && <span className="tag practice">Practice</span>}
      </div>
      <label className="field">
        Description
        <textarea
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="Describe what you see..."
          spellCheck
          autoFocus
        />
      </label>
      <div className="counts">
        <span>Words: {wordCount}</span>
        <span>Characters: {charCount}</span>
        <span className={wordCount >= minWords ? "ok" : "warning"}>
          Minimum: {minWords} words
        </span>
      </div>
      <label className="field">
        Effort rating: {rating}
        <input
          type="range"
          min="1"
          max="10"
          value={rating}
          onChange={(event) => onRating(Number(event.target.value))}
        />
      </label>
      <label className="field">
        Optional comments
        <textarea
          value={comments}
          onChange={(event) => onComments(event.target.value)}
          placeholder="Share any additional notes..."
        />
      </label>
      <div className="actions">
        <button
          className="primary"
          onClick={onSubmit}
          disabled={submitting || wordCount < minWords || fetchingImage}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
        {showNext && (
          <button className="ghost" onClick={onNext}>
            Next
          </button>
        )}
      </div>
      {showFinish && (
        <p className="hint">You can stop at any time using the Finish / Stop button above.</p>
      )}
    </div>
  );
}
