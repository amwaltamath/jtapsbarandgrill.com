-- Create newsletter_subscribers table
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

-- Enable Row Level Security (RLS)
ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

-- Create policy to allow inserts from anyone (for newsletter signup)
CREATE POLICY "Allow public inserts" ON newsletter_subscribers
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create policy to allow authenticated users to read all subscribers
CREATE POLICY "Allow authenticated reads" ON newsletter_subscribers
  FOR SELECT
  TO authenticated
  USING (true);

-- Optional: Create policy to allow authenticated users to delete subscribers
CREATE POLICY "Allow authenticated deletes" ON newsletter_subscribers
  FOR DELETE
  TO authenticated
  USING (true);
