import React, { useState, useEffect, useRef } from "react";
import { getApiUrl } from "../utils/apiBase";

const MIN_WORDS = 60;

const attentionInstruction = {
  "survey/attention-red.svg": {
    text: "Special task: Include the word \"red\" in your description!",
    expected: "red"
  },
  "survey/attention-circle.svg": {
    text: "Special task: Include the word \"circle\" in your description!",
    expected: "circle"
  },
  "survey/attention-ocean.svg": {
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
  const [submitError, setSubmitError] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const trialStartTime = useRef(Date.now());
  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const charCount = description.length;
  const commentsValid = comments.trim().length >= 5;
  const canSubmit = wordCount >= MIN_WORDS && rating !== 0 && commentsValid && !submitting;
  const currentInstruction = trial?.is_attention ? attentionInstruction[trial.image_id] : null;

  const handleRetryImage = () => {
    setImageError(false);
    setImageLoaded(false);
    // Force reload the image by adding a timestamp
    const img = document.querySelector('.image-container img');
    if (img && img.src) {
      const originalSrc = img.src;
      img.src = originalSrc.split('?')[0] + '?retry=' + Date.now();
    } else {
      // If img element not found, trigger a reload through parent
      console.warn('Image element not found, cannot retry');
    }
  };

  useEffect(() => {
    setElapsed(0);
    setImageLoaded(false);
    setImageError(false);
    setIsZoomed(false);
    setSubmitError("");
    trialStartTime.current = Date.now();
    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [trial?.image_id]);

  useEffect(() => {
    if (submitError) {
      setSubmitError("");
    }
  }, [description, rating, comments]);

  const handleSubmit = async () => {
    if (!canSubmit) {
      setSubmitError(getSubmitTooltip());
      return;
    }

    setSubmitting(true);
    setSubmitError("");
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
    } catch (error) {
      setSubmitError(error?.message || "Submission failed. Please try again.");
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

  const getSubmitTooltip = () => {
    if (submitting) return "Submitting...";
    if (wordCount < MIN_WORDS) return `Need at least ${MIN_WORDS} words (currently ${wordCount})`;
    if (rating === 0) return "Please select a rating";
    if (!commentsValid) return "Comments must be at least 5 characters";
    return "Submit your response";
  };

  const imageSrc = trial ? getApiUrl(trial.image_url) : "";

  if (isSurvey && surveyFeedbackReady) {
    return (
      <div className="panel">
        <div className="guidance" style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--success), var(--primary))',
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            margin: '0 auto 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '48px',
            boxShadow: '0 4px 20px rgba(24, 119, 242, 0.3)'
          }}>
            ✓
          </div>
          <h2 style={{ color: 'var(--success)', marginBottom: '20px', marginTop: '0' }}>Survey Complete!</h2>
          <p style={{ fontSize: '16px', lineHeight: '1.8', marginBottom: '32px', maxWidth: '500px', margin: '0 auto 32px' }}>
            Great job on your survey trial! You can now choose to continue with more survey 
            images or finish the study.
          </p>
          <div style={{
            backgroundColor: 'var(--accent-bg)',
            padding: '20px',
            borderRadius: '12px',
            marginBottom: '32px',
            borderLeft: '4px solid var(--primary)',
            maxWidth: '600px',
            margin: '0 auto 32px'
          }}>
            <p style={{ margin: '0', color: 'var(--muted)', lineHeight: '1.6' }}>
              <em>Tip: Aim to describe colors, textures, relationships, and any notable objects.
              Remember to write at least {MIN_WORDS} words per description.</em>
            </p>
          </div>
          <div style={{ display: 'flex', gap: '20px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '20px' }}>
            <button
              className="primary"
              onClick={onSurveyContinue}
              style={{ padding: '14px 28px', fontSize: '14px', height: '48px' }}
            >
              Continue Survey
            </button>
            <button
              className="ghost"
              onClick={onSurveyFinish}
              style={{ padding: '14px 28px', border: '2px solid var(--error)', color: 'var(--error)', fontSize: '14px', height: '48px' }}
            >
              Finish
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!trial) {
    return (
      <div className="panel" style={{ textAlign: 'center', padding: '40px' }}>
        <div className="spinner" style={{ margin: '20px auto' }}></div>
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
            key={imageSrc}
            src={imageSrc}
            alt="Prompt"
            onClick={() => setIsZoomed(!isZoomed)}
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{ display: imageLoaded ? 'block' : 'none' }}
          />
        ) : (
          <div className="image-error">
            <p>Image failed to load.</p>
            <button
              className="primary"
              onClick={handleRetryImage}
              style={{ marginTop: '12px', padding: '8px 16px' }}
            >
              Retry
            </button>
          </div>
        )}
        {!imageLoaded && !imageError && (
          <div className="image-loading">
            <div className="spinner" style={{ margin: '20px auto' }}></div>
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
      </div>

      <div className="field">
        <label>Description</label>
        <textarea
          className={wordCount > 0 && wordCount < MIN_WORDS ? 'error-input' : ''}
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
          className={comments.length > 0 && comments.length < 5 ? 'error-input' : ''}
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          placeholder="Share any additional notes..."
        />
      </div>

      {submitError && <div className="banner warning">{submitError}</div>}

      <div className="actions">
        <button
          className={`primary ${submitting ? "wiggle" : ""}`}
          onClick={handleSubmit}
          disabled={!canSubmit}
          title={getSubmitTooltip()}
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