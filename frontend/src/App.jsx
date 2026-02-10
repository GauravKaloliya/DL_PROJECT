import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const MIN_WORDS = 30;
const MAIN_TARGET = 15;
const ATTENTION_TARGET = 1;
const AUTO_NEXT_DELAY_MS = 1200;

const attentionInstruction = {
  "attention/attention-red.svg": {
    text: "💝 Special task: Include the word \"red\" in your description!",
    expected: "red"
  },
  "attention/attention-circle.svg": {
    text: "🎯 Special task: Include the word \"circle\" in your description!",
    expected: "circle"
  },
  "attention/attention-ocean.svg": {
    text: "🌊 Special task: Include the word \"ocean\" in your description!",
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

// Allow copy/paste only in input fields
const preventCopyPaste = (e) => {
  const target = e.target;
  const isInputField = target.tagName === 'INPUT' || 
                       target.tagName === 'TEXTAREA' || 
                       target.contentEditable === 'true' ||
                       target.closest('input') ||
                       target.closest('textarea') ||
                       target.closest('[contenteditable="true"]');
  
  // Allow copy/paste only in input fields
  if (!isInputField) {
    e.preventDefault();
    return false;
  }
};

export default function App() {
  const [darkMode, setDarkMode] = useState(getStoredValue("darkMode", false));
  const [online, setOnline] = useState(navigator.onLine);
  const [stage, setStage] = useState(getStoredValue("stage", "consent"));
  const [consentChecked, setConsentChecked] = useState(getStoredValue("consentChecked", false));
  const [demographics, setDemographics] = useState(
    getStoredValue("demographics", {
      username: "",
      gender: "",
      age: "",
      place: "",
      language: "",
      experience: ""
    })
  );
  const [formErrors, setFormErrors] = useState({});
  const [participantId] = useState(() => getStoredValue("participantId", createId()));
  const [sessionId] = useState(() => getStoredValue("sessionId", createId()));
  const [trial, setTrial] = useState(getStoredValue("trial", null));
  const [description, setDescription] = useState(getStoredValue("description", ""));
  const [rating, setRating] = useState(getStoredValue("rating", 0));
  const [comments, setComments] = useState(getStoredValue("comments", ""));
  const [submitting, setSubmitting] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(getStoredValue("surveyCompleted", 0));
  const [mainCompleted, setMainCompleted] = useState(getStoredValue("mainCompleted", 0));
  const [attentionRemaining, setAttentionRemaining] = useState(getStoredValue("attentionRemaining", ATTENTION_TARGET));
  const [submissions, setSubmissions] = useState(getStoredValue("submissions", []));
  const [toasts, setToasts] = useState([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [surveyFeedbackReady, setSurveyFeedbackReady] = useState(false);
  const [readyForNext, setReadyForNext] = useState(false);
  const [fetchingImage, setFetchingImage] = useState(false);
  const [trialStartTime, setTrialStartTime] = useState(Date.now());
  const nextTimeout = useRef(null);
  
  const navigate = useNavigate();
  
  // Prevent copy/paste on the entire application
  useEffect(() => {
    const handleCopy = (e) => preventCopyPaste(e);
    const handlePaste = (e) => preventCopyPaste(e);
    const handleCut = (e) => preventCopyPaste(e);
    
    document.addEventListener("copy", handleCopy);
    document.addEventListener("paste", handlePaste);
    document.addEventListener("cut", handleCut);
    
    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("paste", handlePaste);
      document.removeEventListener("cut", handleCut);
    };
  }, []);

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
    saveStoredValue("stage", stage);
  }, [stage]);

  useEffect(() => {
    saveStoredValue("consentChecked", consentChecked);
  }, [consentChecked]);

  useEffect(() => {
    saveStoredValue("trial", trial);
  }, [trial]);

  useEffect(() => {
    saveStoredValue("description", description);
  }, [description]);

  useEffect(() => {
    saveStoredValue("rating", rating);
  }, [rating]);

  useEffect(() => {
    saveStoredValue("comments", comments);
  }, [comments]);

  useEffect(() => {
    saveStoredValue("surveyCompleted", surveyCompleted);
  }, [surveyCompleted]);

  useEffect(() => {
    saveStoredValue("mainCompleted", mainCompleted);
  }, [mainCompleted]);

  useEffect(() => {
    saveStoredValue("attentionRemaining", attentionRemaining);
  }, [attentionRemaining]);

  useEffect(() => {
    saveStoredValue("submissions", submissions);
  }, [submissions]);

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
      setRating(0);
      setComments("");
      setIsZoomed(false);
      setTrialStartTime(Date.now());
      setSurveyFeedbackReady(false);
      setReadyForNext(false);
    } catch (error) {
      addToast(error.message || "Failed to load image", "error");
    } finally {
      setFetchingImage(false);
    }
  }, [addToast, sessionId]);

  const startSurvey = async () => {
    setStage("survey");
    await fetchImage("survey");
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

  const validateForm = () => {
    const errors = {};
    if (!demographics.username || demographics.username.trim().length < 2) errors.username = "Username is required (min 2 characters)";
    if (!demographics.gender) errors.gender = "Gender is required";
    if (!demographics.age || isNaN(demographics.age) || demographics.age < 1 || demographics.age > 120) {
      errors.age = "Please enter a valid age (1-120)";
    }
    if (!demographics.place || demographics.place.trim().length < 2) {
      errors.place = "Place/Location is required";
    }
    if (!demographics.language) {
      errors.language = "Native language is required";
    }
    if (!demographics.experience) {
      errors.experience = "Prior experience is required";
    }
    if (!consentChecked) {
      errors.consent = "You must consent to participate";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleConsentStart = () => {
    if (!validateForm()) {
      addToast("Please fill in all required fields correctly 💕", "error");
      return;
    }
    startSurvey();
  };

  const handleSubmit = async () => {
    if (!trial || submitting) return;
    if (wordCount < MIN_WORDS) {
      addToast(`Almost there! ✨ Please write at least ${MIN_WORDS} words.`, "error");
      return;
    }
    if (rating === 0) {
      addToast("Please provide an image rating 💕", "error");
      return;
    }
    if (comments.trim().length < 5) {
      addToast("Please add at least 5 characters in comments ✨", "error");
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
      is_attention: trial.is_attention,
      attention_expected: attentionMeta?.expected || "",
      username: demographics.username,
      gender: demographics.gender,
      age: demographics.age,
      place: demographics.place,
      native_language: demographics.language,
      prior_experience: demographics.experience
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
        addToast("Oopsie! 💕 Please follow the special instructions next time!", "warning");
      } else {
        addToast("Yay! 🎉 Your response was saved!", "success");
      }
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 1200);
      setSubmissions((prev) => [...prev, { ...payload, attention_passed: result.attention_passed }]);

      if (trial.is_survey) {
        setSurveyCompleted((prev) => prev + 1);
        setSurveyFeedbackReady(true);
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
    if (stage === "survey") {
      await fetchImage("survey");
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
      <div className="app" onCopy={preventCopyPaste} onPaste={preventCopyPaste}>
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
              {darkMode ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="5"/>
                  <line x1="12" y1="1" x2="12" y2="3"/>
                  <line x1="12" y1="21" x2="12" y2="23"/>
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
                  <line x1="1" y1="12" x2="3" y2="12"/>
                  <line x1="21" y1="12" x2="23" y2="12"/>
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                </svg>
              )}
            </button>
            <button className="ghost" onClick={() => navigate("/api/docs")}>
              API Docs
            </button>
            <button className="ghost" onClick={() => navigate("/admin")}>
              Admin
            </button>
            <div className={`status-dot ${online ? "online" : "offline"}`}>
              {online ? "Online" : "Offline"}
            </div>
          </div>
        </header>

        {!online && (
          <div className="banner warning">
            Oh no! 💕 You appear to be offline. Submissions will fail until connectivity is restored.
          </div>
        )}

        {stage === "consent" && (
          <div className="panel">
            <h2>Survey Consent Form</h2>
            <p style={{ color: 'var(--muted)', fontSize: '15px', marginBottom: '20px' }}>
              <strong>C.O.G.N.I.T.: Cognitive Observation & Generalized Narrative Inquiry Tool</strong>
            </p>
            
            <div className="welcome-info">
              <h3>Purpose of the Research</h3>
              <p>
                This research aims to understand how individuals perceive, interpret, and describe visual content. 
                Your participation will contribute to advancing knowledge in cognitive science, computer vision, 
                and natural language processing. The insights gained may help improve image understanding systems 
                and descriptive language models.
              </p>
              
              <h3>What You Will Do</h3>
              <ul>
                <li>View a series of images presented on your screen</li>
                <li>Provide detailed written descriptions of each image (minimum 30 words)</li>
                <li>Rate each image on a scale of 1-10 based on visual complexity</li>
                <li>Complete a brief survey session before the main research</li>
                <li>Share any additional observations or comments about the images</li>
              </ul>
              
              <h3>Time and Duration</h3>
              <p>
                The survey takes approximately 15-20 minutes to complete. You may take breaks between images as needed. 
                You have the option to exit the survey at any point without penalty. Your progress is automatically saved.
              </p>
              
              <h3>Benefits and Risks</h3>
              <p>
                <strong>Benefits:</strong> You will contribute to scientific research that may lead to better 
                image understanding technologies and accessibility tools. There is no monetary compensation for participation.
              </p>
              
              <h3>Data Privacy and Confidentiality</h3>
              <ul>
                <li>All responses are collected anonymously and stored securely</li>
                <li>No personally identifiable information will be published or shared</li>
                <li>Data will be used solely for academic research purposes</li>
                <li>Aggregated results may be published in research papers or presented at conferences</li>
              </ul>
              
              <h3>Your Rights</h3>
              <p>
                Participation in this survey is entirely voluntary. You have the right to:
              </p>
              <ul>
                <li>Decline to participate without any consequences</li>
                <li>Withdraw from the survey at any time without penalty</li>
                </ul>
              
              <h3>Contact Information</h3>
              <p>
                If you have any questions about this survey, please contact the research team at 
                <strong> research@cognit.org</strong>. For questions about your rights as a research participant, 
                contact the Institutional Review Board.
              </p>
              
              <h3>Consent Statement</h3>
              <p>
                By checking the consent box below and clicking "Start", you confirm that:
              </p>
              <ul>
                <li>You are at least 18 years of age</li>
                <li>You have read and understood this consent form</li>
                <li>You agree to participate in this research survey voluntarily</li>
                <li>You understand that your responses will be collected</li>
              </ul>
            </div>
            
            <h3 style={{ color: 'var(--primary)', marginTop: '24px', marginBottom: '16px' }}>Participant Information</h3>
            <div className="consent-form-grid">
              <div className={`form-field ${formErrors.username ? 'error' : ''}`}>
                <label>Username</label>
                <input
                  type="text"
                  placeholder="Enter your username"
                  value={demographics.username}
                  onChange={(event) => {
                    setDemographics((prev) => ({ ...prev, username: event.target.value }));
                    if (formErrors.username) setFormErrors(prev => ({ ...prev, username: null }));
                  }}
                  className={formErrors.username ? 'error-input' : ''}
                />
                {formErrors.username && <span className="error-text">{formErrors.username}</span>}
              </div>
              
              <div className={`form-field ${formErrors.gender ? 'error' : ''}`}>
                <label>Gender</label>
                <select
                  value={demographics.gender}
                  onChange={(event) => {
                    setDemographics((prev) => ({ ...prev, gender: event.target.value }));
                    if (formErrors.gender) setFormErrors(prev => ({ ...prev, gender: null }));
                  }}
                  className={formErrors.gender ? 'error-input' : ''}
                >
                  <option value="">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="non-binary">Non-binary</option>
                  <option value="prefer-not-say">Prefer not to say</option>
                  <option value="other">Other</option>
                </select>
                {formErrors.gender && <span className="error-text">{formErrors.gender}</span>}
              </div>
              
              <div className={`form-field ${formErrors.age ? 'error' : ''}`}>
                <label>Age</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  placeholder="Enter your age"
                  value={demographics.age}
                  onChange={(event) => {
                    setDemographics((prev) => ({ ...prev, age: event.target.value }));
                    if (formErrors.age) setFormErrors(prev => ({ ...prev, age: null }));
                  }}
                  className={formErrors.age ? 'error-input' : ''}
                />
                {formErrors.age && <span className="error-text">{formErrors.age}</span>}
              </div>
              
              <div className={`form-field ${formErrors.place ? 'error' : ''}`}>
                <label>Place/Location</label>
                <input
                  type="text"
                  placeholder="e.g., India"
                  value={demographics.place}
                  onChange={(event) => {
                    setDemographics((prev) => ({ ...prev, place: event.target.value }));
                    if (formErrors.place) setFormErrors(prev => ({ ...prev, place: null }));
                  }}
                  className={formErrors.place ? 'error-input' : ''}
                />
                {formErrors.place && <span className="error-text">{formErrors.place}</span>}
              </div>
              
              <div className={`form-field ${formErrors.language ? 'error' : ''}`}>
                <label>Native language</label>
                <select
                  value={demographics.language}
                  onChange={(event) => {
                    setDemographics((prev) => ({ ...prev, language: event.target.value }));
                    if (formErrors.language) setFormErrors(prev => ({ ...prev, language: null }));
                  }}
                  className={formErrors.language ? 'error-input' : ''}
                >
                  <option value="">Select native language</option>
                  <option value="English">English</option>
                  <option value="Spanish">Spanish</option>
                  <option value="French">French</option>
                  <option value="German">German</option>
                  <option value="Chinese">Chinese</option>
                  <option value="Japanese">Hindi</option>
                  <option value="Korean">Korean</option>
                  <option value="Portuguese">Portuguese</option>
                  <option value="Italian">Italian</option>
                  <option value="Russian">Russian</option>
                  <option value="Other">Other</option>
                </select>
                {formErrors.language && <span className="error-text">{formErrors.language}</span>}
              </div>
              
              <div className={`form-field ${formErrors.experience ? 'error' : ''}`}>
                <label>Prior experience</label>
                <select
                  value={demographics.experience}
                  onChange={(event) => {
                    setDemographics((prev) => ({ ...prev, experience: event.target.value }));
                    if (formErrors.experience) setFormErrors(prev => ({ ...prev, experience: null }));
                  }}
                  className={formErrors.experience ? 'error-input' : ''}
                >
                  <option value="">Select prior experience</option>
                  <option value="Photography">Photography</option>
                  <option value="Art/Design">Art/Design</option>
                  <option value="Computer Vision">Computer Vision</option>
                  <option value="Image Processing">Image Processing</option>
                  <option value="Graphic Design">Graphic Design</option>
                  <option value="Video Editing">Video Editing</option>
                  <option value="3D Modeling">3D Modeling</option>
                  <option value="UI/UX Design">UI/UX Design</option>
                  <option value="Animation">Animation</option>
                  <option value="Other">Other</option>
                </select>
                {formErrors.experience && <span className="error-text">{formErrors.experience}</span>}
              </div>
            </div>
            
            <div className={`consent-checkbox ${formErrors.consent ? 'error' : ''}`}>
              <input
                type="checkbox"
                checked={consentChecked}
                onChange={(event) => {
                  setConsentChecked(event.target.checked);
                  if (formErrors.consent) setFormErrors(prev => ({ ...prev, consent: null }));
                }}
                id="consent-check"
              />
              <label htmlFor="consent-check">
                <strong>I consent to participate in this research survey</strong>
                <p style={{ margin: '8px 0 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '400' }}>
                  I confirm that I am 18 years or older, I have read and understood the consent form, 
                  and I agree to participate voluntarily. I understand my responses will be collected 
                  and used for research purposes only.
                </p>
              </label>
              {formErrors.consent && <span className="error-text consent-error">{formErrors.consent}</span>}
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
              <button className="primary" onClick={handleConsentStart}>
                Start Survey
              </button>
            </div>
          </div>
        )}

        {stage === "survey" && trial && (
          <div className="panel">
            <div className="progress">
              <span>Survey Session</span>
            </div>
            {surveyFeedbackReady ? (
              <div className="guidance">
                <h2>Survey Complete! 🎉</h2>
                <p>
                  Great job on your survey trial! You can now choose to continue with more survey 
                  images or finish the session.
                </p>
                <p style={{ color: 'var(--muted)', margin: '16px 0' }}>
                  <em>Tip: Aim to describe colors, textures, relationships, and any notable objects. 
                  Remember to write at least {MIN_WORDS} words per description.</em>
                </p>
                <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="ghost" onClick={handleNext}>
                    Continue Survey
                  </button>
                  <button className="ghost" onClick={handleFinishEarly}>
                    Finish Survey
                  </button>
                </div>
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
                onBack={() => setStage("consent")}
              />
            )}
          </div>
        )}

        {stage === "trial" && trial && (
          <div className="panel">
            <div className="progress">
              <button className="ghost" onClick={handleFinishEarly}>
                Finish
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
              onBack={() => setStage("consent")}
            />
          </div>
        )}

        {stage === "finished" && (
          <div className="panel">
            <h2>Thank you for completing C.O.G.N.I.T. survey</h2>
            <p>
              You have completed {mainCompleted} main trials and {surveyCompleted} survey trials! 🎉
              Your responses have been recorded. If you would like a copy of your data, download it
              below
            </p>
            <p className="debrief">
              Debrief: C.O.G.N.I.T. (Cognitive Observation & Generalized Narrative Inquiry Tool) 
              examines how people describe visual scenes. Your responses
              will help improve language understanding models ✨
            </p>
            <button className="primary" onClick={downloadData} disabled={submissions.length === 0}>
              Download my data 📥
            </button>
          </div>
        )}
        <div className="branding-footer" style={{ textAlign: 'center', marginTop: '8px', color: 'var(--muted)', fontSize: '14px' }}>
          Created by Gaurav Kaloliya
        </div>
        <div className="branding-header" style={{ textAlign: 'center', marginTop: '8px', color: 'var(--muted)', fontSize: '14px' }}>
          <strong>Gaurav Kaloliya</strong> - Founder of C.O.G.N.I.T. 
        </div>
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
  showFinish,
  onBack
}) {
  const [elapsed, setElapsed] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setElapsed(0);
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [trial.image_id]);

  const imageSrc = `${API_BASE}${trial.image_url}`;

  const commentsValid = comments.trim().length >= 5;

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  return (
    <div className="trial">
      {instruction && <div className="banner info">{instruction.text}</div>}
      <div className="back-button-container">
        <button className="ghost back-button" onClick={onBack} title="Back to Consent">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
      </div>
      <div className={`image-container ${isZoomed ? "zoomed" : ""}`}>
        {!imageError ? (
          <img 
            src={imageSrc} 
            alt="Prompt" 
            onClick={onToggleZoom} 
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        ) : (
          <div className="image-error">
            <p>⚠️ Image failed to load. Please refresh the page.</p>
          </div>
        )}
        {!imageLoaded && !imageError && (
          <div className="image-loading">
            <p>Loading image...</p>
          </div>
        )}
        <button className="zoom-toggle" onClick={onToggleZoom} disabled={!imageLoaded || imageError}>
          {isZoomed ? "Reset zoom 🔍" : "Zoom 🔍"}
        </button>
      </div>
      <div className="meta">
        <span className="timer">Time: {elapsed}s ⏱️</span>
        {trial.is_attention && <span className="tag attention">Attention check 💝</span>}
        {trial.is_survey && <span className="tag survey">Survey 🎯</span>}
      </div>
      <label className="field">
        Description 📝
        <textarea
          value={description}
          onChange={(event) => onDescription(event.target.value)}
          placeholder="Describe what you see..."
          spellCheck
          autoFocus
        />
      </label>
      <div className="counts">
        <span>Words: {wordCount} / Min {minWords} 📝</span>
        <span>Characters: {charCount} ⌨️</span>
        <span className={wordCount >= minWords ? "ok" : "warning"}>
          Minimum: {minWords} words ✨
        </span>
      </div>
      
      {/* Image Rating - Radio buttons */}
      <div className="field effort-rating">
        <label>Image rating {rating > 0 ? `${rating}/10` : ""}</label>
        <div className="rating-scale">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((val) => (
            <label key={val} className="rating-option">
              <input
                type="radio"
                name="effort-rating"
                value={val}
                checked={rating === val}
                onChange={() => onRating(val)}
              />
              <span className="rating-label">{val}</span>
            </label>
          ))}
        </div>
        <div className="rating-labels">
          <span>Very Low</span>
          <span>Very High</span>
        </div>
      </div>

      {/* Comments */}
      <label className="field">
        Comments
        <textarea
          value={comments}
          onChange={(event) => onComments(event.target.value)}
          placeholder="Share any additional notes..."
        />
      </label>

      <div className="actions">
        <button
          className={`primary ${submitting ? "wiggle" : ""}`}
          onClick={onSubmit}
          disabled={submitting || wordCount < minWords || fetchingImage || rating === 0 || !commentsValid}
        >
          {submitting ? "Submitting... 🌸" : "Submit"}
        </button>
        {showNext && (
          <button className="ghost" onClick={onNext}>
            Next
          </button>
        )}
      </div>
      {showFinish && (
        <p className="hint">You can stop at any time using the Finish button above 💕</p>
      )}
    </div>
  );
}
