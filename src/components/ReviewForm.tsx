import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { GOOGLE_WRITE_REVIEW_URL, isHighRating } from '../lib/reviews';
import '../styles/review-form.css';

type FormState = 'idle' | 'submitting' | 'success' | 'error';

export default function ReviewForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [website, setWebsite] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [error, setError] = useState('');
  const [showGooglePrompt, setShowGooglePrompt] = useState(false);
  const [submittedComment, setSubmittedComment] = useState('');

  useEffect(() => {
    const prefillProfile = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase
          .from('customer_profiles')
          .select('name, email')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (profile?.name) setName(profile.name);
        if (profile?.email) setEmail(profile.email);
        else if (session.user.email) setEmail(session.user.email);
      } catch {
        // Optional prefill only
      }
    };

    prefillProfile();
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!name.trim() || !email.trim() || !comment.trim() || rating === 0) {
      setError('Please add your name, email, star rating, and review.');
      setFormState('error');
      return;
    }

    setFormState('submitting');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const requestHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (session?.access_token) {
        requestHeaders.Authorization = `Bearer ${session.access_token}`;
      }

      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          rating,
          comment: comment.trim(),
          website,
          source: 'website',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Could not submit your review.');
      }

      setSubmittedComment(comment.trim());
      setShowGooglePrompt(Boolean(result.suggestGoogle));
      setFormState('success');
    } catch (err) {
      setFormState('error');
      setError(err instanceof Error ? err.message : 'Could not submit your review.');
    }
  };

  const handleGoogleReviewClick = () => {
    window.open(GOOGLE_WRITE_REVIEW_URL, '_blank', 'noopener,noreferrer');
  };

  if (formState === 'success' && showGooglePrompt) {
    return (
      <div className="review-form-page">
        <div className="review-form-card review-success-card review-google-step">
          <div className="review-success-icon">⭐</div>
          <h1>Thanks — one more step!</h1>
          <p className="google-step-lead">
            Your {rating}-star review was sent to our team. Help other Cincinnati fans discover JTAPS by sharing on Google too.
          </p>

          <div className="google-prompt google-prompt--primary">
            <div className="google-prompt-header">
              <svg width="24" height="24" viewBox="0 0 48 48" fill="none" aria-hidden="true">
                <path d="M44.5 20H24v8.5h11.8C34.7 33.9 30.1 37 24 37c-7.2 0-13-5.8-13-13s5.8-13 13-13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 11.8 2 2 11.8 2 24s9.8 22 22 22c11 0 21-8 21-22 0-1.3-.2-2.7-.5-4z" fill="#4285F4"/>
                <path d="M6.3 14.7l7 5.1C15 16 19.1 13 24 13c3.1 0 5.9 1.1 8.1 2.9l6.4-6.4C34.6 4.1 29.6 2 24 2 16.3 2 9.7 6.6 6.3 14.7z" fill="#EA4335"/>
                <path d="M24 46c5.4 0 10.4-1.8 14.3-5.1l-6.9-5.7C29.5 37 27 38 24 38c-6 0-11.1-4-12.8-9.5l-7.1 5.4C7.5 41.2 15.2 46 24 46z" fill="#34A853"/>
                <path d="M46 24c0-1.3-.2-2.7-.5-4H24v8.5h11.8c-1 2.7-2.8 4.9-5.2 6.4l6.9 5.7C42.1 36 46 30.6 46 24z" fill="#FBBC05"/>
              </svg>
              <h2>Post on Google</h2>
            </div>

            <ol className="google-steps">
              <li>Tap the button below — Google opens in a new tab</li>
              <li>Sign in with your Google account if Google asks</li>
              <li>Rate JTAPS and paste or rewrite your review</li>
            </ol>

            {submittedComment && (
              <div className="review-copy-hint">
                <p className="review-copy-label">Your review (copy if helpful):</p>
                <blockquote>{submittedComment}</blockquote>
              </div>
            )}

            <button type="button" className="google-review-btn" onClick={handleGoogleReviewClick}>
              Continue to Google Reviews
            </button>

            <p className="google-signin-note">
              Google requires you to sign in on their site — we can&apos;t post Google reviews for you from JTAPS.
            </p>
          </div>

          <button type="button" className="review-skip-link" onClick={() => setShowGooglePrompt(false)}>
            Skip for now — I&apos;m done
          </button>
        </div>
      </div>
    );
  }

  if (formState === 'success') {
    return (
      <div className="review-form-page">
        <div className="review-form-card review-success-card">
          <div className="review-success-icon">🎉</div>
          <h1>Thank You!</h1>
          <p>Your feedback means a lot to our team. We read every review and use it to keep JTAPS the best sports bar in Cincinnati.</p>
          <a href="/" className="review-back-link">← Back to Home</a>
        </div>
      </div>
    );
  }

  return (
    <div className="review-form-page">
      <div className="review-form-hero">
        <span className="review-tag">SHARE YOUR EXPERIENCE</span>
        <h1>Leave a Review</h1>
        <p>Tell us about your wings, gyros, burgers, or game-day visit. Your feedback goes straight to our team.</p>
      </div>

      <form className="review-form-card" onSubmit={handleSubmit}>
        <label className="review-label">
          Your Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First and last name"
            maxLength={100}
            required
          />
        </label>

        <label className="review-label">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={200}
            required
          />
        </label>

        <fieldset className="review-rating-field">
          <legend>Your Rating</legend>
          <div className="star-picker" onMouseLeave={() => setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((value) => (
              <button
                key={value}
                type="button"
                className={`star-btn ${value <= (hoverRating || rating) ? 'active' : ''}`}
                onMouseEnter={() => setHoverRating(value)}
                onClick={() => setRating(value)}
                aria-label={`${value} star${value === 1 ? '' : 's'}`}
              >
                ★
              </button>
            ))}
          </div>
          <p className="rating-hint">{rating ? `${rating} out of 5 stars` : 'Tap a star to rate'}</p>
        </fieldset>

        {isHighRating(rating) && (
          <div className="high-rating-banner">
            <strong>Love your visit?</strong> After you submit, we&apos;ll help you share on Google — you&apos;ll sign in there with your Google account to post.
          </div>
        )}

        <label className="review-label">
          Your Review
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="What did you order? What made your visit great?"
            rows={6}
            minLength={10}
            maxLength={2000}
            required
          />
        </label>

        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          className="review-honeypot"
          aria-hidden="true"
        />

        {error && <p className="review-error">{error}</p>}

        <button type="submit" className="review-submit-btn" disabled={formState === 'submitting'}>
          {formState === 'submitting' ? 'Submitting...' : isHighRating(rating) ? 'Submit & Continue to Google' : 'Submit Review'}
        </button>

        <p className="review-disclaimer">
          Reviews are collected internally first. For 4–5 star visits, we&apos;ll guide you to Google where you can sign in and post publicly.
        </p>
      </form>
    </div>
  );
}
