import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { InternalReview, ReviewStatus } from '../../lib/reviews';
import { GOOGLE_REVIEW_URL, starsForRating } from '../../lib/reviews';

type StatusFilter = 'all' | ReviewStatus;

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  featured: 'Featured',
  declined: 'Declined',
  google_invited: 'Google Invited',
};

export default function ReviewManager() {
  const [reviews, setReviews] = useState<InternalReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchReviews();
  }, [statusFilter]);

  const fetchReviews = async () => {
    setLoading(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Not authenticated. Please login again.');
        return;
      }

      const query = statusFilter === 'all' ? 'all' : statusFilter;
      const response = await fetch(`/api/admin/reviews?status=${query}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to load reviews');
      }

      setReviews(result.reviews || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reviews');
    } finally {
      setLoading(false);
    }
  };

  const updateReview = async (id: number, status: ReviewStatus) => {
    setActionLoading(id);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/reviews', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id, status }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Update failed');

      setSuccess(`Review marked as ${STATUS_LABELS[status]}.`);
      await fetchReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setActionLoading(null);
    }
  };

  const sendGoogleInvite = async (review: InternalReview) => {
    if (!window.confirm(`Send a Google review invite email to ${review.reviewer_email}?`)) return;

    setActionLoading(review.id);
    setError('');
    setSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch('/api/admin/reviews/send-google-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: review.id }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Failed to send invite');

      setSuccess(`Google review invite sent to ${review.reviewer_email}.`);
      await fetchReviews();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setActionLoading(null);
    }
  };

  const summary = useMemo(() => ({
    pending: reviews.filter((r) => r.status === 'pending').length,
    featured: reviews.filter((r) => r.status === 'featured').length,
    googleInvited: reviews.filter((r) => r.status === 'google_invited').length,
  }), [reviews]);

  const formatDate = (value: string) =>
    new Date(value).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div className="review-manager">
      <div className="review-manager-header">
        <div>
          <h3>Customer Reviews</h3>
          <p>Collect feedback internally, feature the best on your site, and invite happy guests to post on Google.</p>
        </div>
        <button type="button" className="btn-secondary" onClick={fetchReviews} disabled={loading}>
          Refresh
        </button>
      </div>

      <div className="review-info-banner">
        <strong>Google note:</strong> Google does not allow businesses to post reviews on a customer&apos;s behalf.
        Use <em>Send Google Invite</em> to email them a direct link to leave their own Google review.
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="review-filter-row">
        {(['all', 'pending', 'approved', 'featured', 'google_invited', 'declined'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            type="button"
            className={`filter-chip ${statusFilter === status ? 'active' : ''}`}
            onClick={() => setStatusFilter(status)}
          >
            {status === 'all' ? 'All' : STATUS_LABELS[status as ReviewStatus]}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="loading-text">Loading reviews...</p>
      ) : reviews.length === 0 ? (
        <div className="empty-state">
          <p>No reviews in this queue yet.</p>
          <a href="/review" target="_blank" rel="noopener noreferrer">Open public review form →</a>
        </div>
      ) : (
        <div className="review-list">
          {reviews.map((review) => (
            <article key={review.id} className={`review-card review-card--${review.status}`}>
              <div className="review-card-top">
                <div>
                  <strong>{review.reviewer_name}</strong>
                  <span className="review-email">{review.reviewer_email}</span>
                </div>
                <div className="review-meta">
                  <span className="review-stars">{starsForRating(review.rating)}</span>
                  <span className={`status-badge status-${review.status}`}>{STATUS_LABELS[review.status]}</span>
                </div>
              </div>

              <p className="review-comment">{review.comment}</p>

              <div className="review-card-footer">
                <span>{formatDate(review.created_at)}</span>
                {review.google_invite_sent_at && (
                  <span>Google invite sent {formatDate(review.google_invite_sent_at)}</span>
                )}
              </div>

              <div className="review-actions">
                {review.status === 'pending' && (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={actionLoading === review.id}
                      onClick={() => updateReview(review.id, 'approved')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={actionLoading === review.id}
                      onClick={() => updateReview(review.id, 'featured')}
                    >
                      Feature on Site
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      disabled={actionLoading === review.id}
                      onClick={() => updateReview(review.id, 'declined')}
                    >
                      Decline
                    </button>
                  </>
                )}

                {review.status === 'approved' && (
                  <>
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={actionLoading === review.id}
                      onClick={() => updateReview(review.id, 'featured')}
                    >
                      Feature on Site
                    </button>
                    {review.rating >= 4 && (
                      <button
                        type="button"
                        className="btn-google"
                        disabled={actionLoading === review.id}
                        onClick={() => sendGoogleInvite(review)}
                      >
                        Send Google Invite
                      </button>
                    )}
                  </>
                )}

                {review.status === 'featured' && review.rating >= 4 && (
                  <button
                    type="button"
                    className="btn-google"
                    disabled={actionLoading === review.id}
                    onClick={() => sendGoogleInvite(review)}
                  >
                    Send Google Invite
                  </button>
                )}

                {review.status !== 'declined' && review.status !== 'google_invited' && (
                  <button
                    type="button"
                    className="btn-link"
                    disabled={actionLoading === review.id}
                    onClick={() => updateReview(review.id, 'declined')}
                  >
                    Hide
                  </button>
                )}

                <a href={GOOGLE_REVIEW_URL} target="_blank" rel="noopener noreferrer" className="btn-link">
                  Google link
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {!loading && statusFilter === 'all' && (
        <p className="review-summary-footnote">
          Pending: {summary.pending} · Featured: {summary.featured} · Google invited: {summary.googleInvited}
        </p>
      )}

      <style>{`
        .review-manager-header {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
          margin-bottom: 1rem;
        }
        .review-manager-header h3 {
          margin: 0 0 0.35rem;
        }
        .review-manager-header p {
          margin: 0;
          color: #666;
          max-width: 720px;
        }
        .review-info-banner {
          background: #fff8e6;
          border: 1px solid #f0d58a;
          border-radius: 10px;
          padding: 0.85rem 1rem;
          margin-bottom: 1rem;
          color: #5c4a00;
          line-height: 1.5;
        }
        .review-filter-row {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          margin-bottom: 1.25rem;
        }
        .filter-chip {
          border: 1px solid #ddd;
          background: #fff;
          border-radius: 999px;
          padding: 0.45rem 0.9rem;
          cursor: pointer;
          font-size: 0.85rem;
        }
        .filter-chip.active {
          background: var(--admin-accent, #E13622);
          border-color: var(--admin-accent, #E13622);
          color: #fff;
        }
        .review-list {
          display: grid;
          gap: 1rem;
        }
        .review-card {
          background: #fff;
          border: 1px solid #e8e8e8;
          border-radius: 12px;
          padding: 1rem 1.1rem;
        }
        .review-card-top {
          display: flex;
          justify-content: space-between;
          gap: 1rem;
          align-items: flex-start;
        }
        .review-email {
          display: block;
          color: #888;
          font-size: 0.85rem;
          margin-top: 0.15rem;
        }
        .review-meta {
          text-align: right;
        }
        .review-stars {
          display: block;
          color: #ffc107;
          letter-spacing: 1px;
          margin-bottom: 0.35rem;
        }
        .status-badge {
          display: inline-block;
          font-size: 0.75rem;
          padding: 0.2rem 0.55rem;
          border-radius: 999px;
          background: #f0f0f0;
          color: #555;
        }
        .status-pending { background: #fff3cd; color: #856404; }
        .status-featured { background: #d4edda; color: #155724; }
        .status-google_invited { background: #d1ecf1; color: #0c5460; }
        .status-declined { background: #f8d7da; color: #721c24; }
        .review-comment {
          margin: 0.85rem 0;
          line-height: 1.65;
          color: #333;
        }
        .review-card-footer {
          display: flex;
          flex-wrap: wrap;
          gap: 0.75rem 1.25rem;
          color: #888;
          font-size: 0.82rem;
          margin-bottom: 0.85rem;
        }
        .review-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
          align-items: center;
        }
        .btn-google {
          background: #4285F4;
          color: #fff;
          border: none;
          border-radius: 8px;
          padding: 0.55rem 0.9rem;
          cursor: pointer;
          font-weight: 600;
        }
        .btn-link {
          color: #666;
          text-decoration: underline;
          background: none;
          border: none;
          cursor: pointer;
          padding: 0.35rem;
        }
        .review-summary-footnote {
          margin-top: 1rem;
          color: #888;
          font-size: 0.9rem;
        }
      `}</style>
    </div>
  );
}
