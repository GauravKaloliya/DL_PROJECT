import React, { useState, useEffect, useRef } from "react";
import { API_BASE } from "../utils/apiBase";

const MIN_WORDS = 30;

const attentionInstruction = {
  "attention/attention-red.svg": {
    text: "Special task: Include the word \"red\" in your description!",
    expected: "red"
  },
  "attention/attention-circle.svg": {
    text: "Special task: Include the word \"circle\" in your description!",
    expected: "circle"
  },
  "attention/attention-ocean.svg": {
    text: "Special task: Include the word \"ocean\" in your description!",
    expected: "ocean"
  }
};

export default function TrialPage({
  trial,
  participantId,
  sessionId,
  onSubmit,
  onNext,
  onFinish,
  showNext,
  isSurvey = false,
  surveyFeedbackReady = false,
  onSurveyContinue,
  onSurveyFinish
}) {
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState(0);
  const [comments, setComments] = useState("");
  const [isZoomed, setIsZoomed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const trialStartTime = useRef(Date.now());
  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const charCount = description.length;
  const commentsValid = comments.trim().length >= 5;
  const currentInstruction = trial?.is_attention ? attentionInstruction[trial.image_id] : null;

  useEffect(() => {
    setElapsed(0);
    trialStartTime.current = Date.now();
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [trial?.image_id]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (wordCount < MIN_WORDS) return;
    if (rating === 0) return;
    if (!commentsValid) return;

    setSubmitting(true);
    const timeSpentSeconds = Math.round((Date.now() - trialStartTime.current) / 1000);

    try {
      await onSubmit({
        description,
        rating,
        comments,
        timeSpentSeconds,
        attentionExpected: currentInstruction?.expected || ""
      });
      
      // Reset form after successful submission
      setDescription("");
      setRating(0);
      setComments("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(false);
  };

  const imageSrc = trial ? `${API_BASE}${trial.image_url}` : "";

  if (isSurvey && surveyFeedbackReady) {
    return (
      <div className="panel">
        <div className="guidance" style={{ textAlign: 'center' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, var(--success), var(--primary))',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            margin: '0 auto 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '48px',
            boxShadow: '0 4px 20px rgba(24, 119, 242, 0.3)'
          }}>
            ✓
          </div>
          <h2 style={{ color: 'var(--success)', marginBottom: '16px' }}>Survey Complete!</h2>
          <p style={{ fontSize: '16px', lineHeight: '1.6', marginBottom: '24px' }}>
            Great job on your survey trial! You can now choose to continue with more survey 
            images or finish the session.
          </p>
          <div style={{ 
            backgroundColor: 'var(--accent-bg)', 
            padding: '16px', 
            borderRadius: '12px',
            marginBottom: '24px',
            borderLeft: '4px solid var(--primary)'
          }}>
            <p style={{ margin: '0', color: 'var(--muted)' }}>
              <em>Tip: Aim to describe colors, textures, relationships, and any notable objects. 
              Remember to write at least {MIN_WORDS} words per description.</em>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <button 
              className="primary"
              onClick={onSurveyContinue}
              style={{ padding: '12px 24px', backgroundColor: 'var(--primary)', color: 'white' }}
            >
              Continue Survey
            </button>
            <button 
              className="ghost"
              onClick={onSurveyFinish}
              style={{ padding: '12px 24px', border: '2px solid var(--primary)', color: 'var(--primary)' }}
            >
              Finish Survey
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!trial) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
        <p>Loading trial...</p>
      </div>
    );
  }

  return (
    <div className="panel">
      <div className="progress">
        {isSurvey ? (
          <span>Survey Session</span>
        ) : (
          <button className="ghost" onClick={onFinish}>
            Finish
          </button>
        )}
      </div>

      {currentInstruction && (
        <div className="banner info">{currentInstruction.text}</div>
      )}

      <div className={`image-container ${isZoomed ? "zoomed" : ""}`}>
        {!imageError ? (
          <img 
            src={imageSrc} 
            alt="Prompt" 
            onClick={() => setIsZoomed(!isZoomed)}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        ) : (
          <div className="image-error">
            <p>Image failed to load. Please refresh the page.</p>
          </div>
        )}
        {!imageLoaded && !imageError && (
          <div className="image-loading">
            <p>Loading image...</p>
          </div>
        )}
        <button 
          className="zoom-toggle" 
          onClick={() => setIsZoomed(!isZoomed)}
          disabled={!imageLoaded || imageError}
        >
          {isZoomed ? "Reset zoom" : "Zoom"}
        </button>
      </div>

      <div className="meta">
        <span className="timer">Time: {elapsed}s</span>
        {trial.is_attention && <span className="tag attention">Attention check</span>}
        {trial.is_survey && <span className="tag survey">Survey</span>}
      </div>

      <div className="field">
        <label>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you see..."
          spellCheck
        />
      </div>

      <div className="counts">
        <span>Words: {wordCount} / Min {MIN_WORDS}</span>
        <span>Characters: {charCount}</span>
        <span className={wordCount >= MIN_WORDS ? "ok" : "warning"}>
          Minimum: {MIN_WORDS} words
        </span>
      </div>

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
                onChange={() => setRating(val)}
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

      <div className="field">
        <label>Comments</label>
        <textarea
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Share any additional notes..."
        />
      </div>

      <div className="actions">
        <button
          className={`primary ${submitting ? "wiggle" : ""}`}
          onClick={handleSubmit}
          disabled={submitting || wordCount < MIN_WORDS || rating === 0 || !commentsValid}
        >
          {submitting ? "Submitting..." : "Submit"}
        </button>
        {showNext && (
          <button className="ghost" onClick={onNext}>
            Next
          </button>
        )}
      </div>

      {!isSurvey && (
        <p className="hint">You can stop at any time using the Finish button above</p>
      )}
    </div>
  );
}