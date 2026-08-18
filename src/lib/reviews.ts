export const GOOGLE_PLACE_ID = 'ChIJTUoiD17KQYgR-aX9v-55Nck';

/** Opens Google's write-review screen — customer signs in with Google there */
export const GOOGLE_WRITE_REVIEW_URL =
  `https://search.google.com/local/writereview?placeid=${GOOGLE_PLACE_ID}`;

export const GOOGLE_REVIEW_URL = GOOGLE_WRITE_REVIEW_URL;

export function isHighRating(rating: number): boolean {
  return rating >= 4;
}

export type ReviewStatus = 'pending' | 'approved' | 'featured' | 'declined' | 'google_invited';

export interface InternalReview {
  id: number;
  user_id: string | null;
  reviewer_name: string;
  reviewer_email: string;
  rating: number;
  comment: string;
  source: string;
  status: ReviewStatus;
  google_invite_sent_at: string | null;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
}

export function starsForRating(rating: number): string {
  return '★'.repeat(rating) + '☆'.repeat(5 - rating);
}

export function initialsForName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return `${parts[0].charAt(0)}${parts[parts.length - 1].charAt(0)}`.toUpperCase();
}

export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Guest';
  if (parts.length === 1) return `${parts[0].charAt(0).toUpperCase()}${parts[0].slice(1)}.`;
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export function googleReviewUrl(reviewId?: number): string {
  const base = GOOGLE_WRITE_REVIEW_URL;
  if (!reviewId) return base;
  const params = new URLSearchParams({
    utm_source: 'jtaps',
    utm_medium: 'review_invite',
    utm_campaign: 'google_review',
    review_id: String(reviewId),
  });
  return `${base}&${params.toString()}`;
}
