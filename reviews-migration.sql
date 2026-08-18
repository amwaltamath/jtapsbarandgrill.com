-- Internal Reviews Migration
-- Collect customer feedback internally; admins can feature on site and invite to Google.

CREATE TABLE IF NOT EXISTS internal_reviews (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  source TEXT DEFAULT 'website',
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'featured', 'declined', 'google_invited')),
  google_invite_sent_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_internal_reviews_status ON internal_reviews(status);
CREATE INDEX IF NOT EXISTS idx_internal_reviews_email ON internal_reviews(reviewer_email);
CREATE INDEX IF NOT EXISTS idx_internal_reviews_created ON internal_reviews(created_at DESC);

ALTER TABLE internal_reviews ENABLE ROW LEVEL SECURITY;

-- Admins can manage all reviews
DROP POLICY IF EXISTS "Admin full access to internal_reviews" ON internal_reviews;
CREATE POLICY "Admin full access to internal_reviews"
  ON internal_reviews FOR ALL
  USING (EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid()));

-- Public can read featured reviews only
DROP POLICY IF EXISTS "Public can read featured reviews" ON internal_reviews;
CREATE POLICY "Public can read featured reviews"
  ON internal_reviews FOR SELECT
  USING (status = 'featured');
