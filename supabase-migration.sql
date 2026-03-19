-- ========== PHASE 1: EMAIL MARKETING ==========

-- Newsletter Subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE,
  phone TEXT UNIQUE,
  name TEXT,
  sms_opt_in BOOLEAN DEFAULT false,
  email_opt_in BOOLEAN DEFAULT true,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT email_or_phone_required CHECK (
    (email IS NOT NULL) OR (phone IS NOT NULL)
  )
);

-- Ensure all columns exist for existing tables
ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS phone TEXT;

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS name TEXT;

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT true;

ALTER TABLE newsletter_subscribers
  ADD COLUMN IF NOT EXISTS subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_phone ON newsletter_subscribers(phone);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts" ON newsletter_subscribers;
CREATE POLICY "Allow public inserts" ON newsletter_subscribers
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated inserts" ON newsletter_subscribers;
CREATE POLICY "Allow authenticated inserts" ON newsletter_subscribers
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated reads" ON newsletter_subscribers;
CREATE POLICY "Allow authenticated reads" ON newsletter_subscribers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Allow authenticated updates" ON newsletter_subscribers;
CREATE POLICY "Allow authenticated updates" ON newsletter_subscribers
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated deletes" ON newsletter_subscribers;
CREATE POLICY "Allow authenticated deletes" ON newsletter_subscribers
  FOR DELETE TO authenticated USING (true);

-- Email Campaigns
CREATE TABLE IF NOT EXISTS email_campaigns (
  id BIGSERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  sent_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE email_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON email_campaigns;
CREATE POLICY "Allow authenticated full access" ON email_campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Admin Users
CREATE TABLE IF NOT EXISTS admin_users (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'admin',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_users_user_id ON admin_users(user_id);

ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own admin status" ON admin_users;
CREATE POLICY "Users can view own admin status" ON admin_users
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Email Campaign Progress
CREATE TABLE IF NOT EXISTS email_campaign_progress (
  id BIGSERIAL PRIMARY KEY,
  campaign_key TEXT UNIQUE NOT NULL,
  campaign_id BIGINT REFERENCES email_campaigns(id) ON DELETE SET NULL,
  batch_size INT DEFAULT 100,
  next_offset INT DEFAULT 0,
  total_recipients INT DEFAULT 0,
  last_sent_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_campaign_progress_key ON email_campaign_progress(campaign_key);

ALTER TABLE email_campaign_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON email_campaign_progress;
CREATE POLICY "Allow authenticated full access" ON email_campaign_progress
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SMS Campaigns
CREATE TABLE IF NOT EXISTS sms_campaigns (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  sent_count INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE sms_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON sms_campaigns;
CREATE POLICY "Allow authenticated full access" ON sms_campaigns
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== PHASE 2: SPORTS BAR OPERATIONS ==========

-- Game Calendar
CREATE TABLE IF NOT EXISTS game_calendar (
  id BIGSERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  league TEXT NOT NULL,
  matchup TEXT NOT NULL,
  game_date TIMESTAMP WITH TIME ZONE NOT NULL,
  tv_channel TEXT,
  importance INT DEFAULT 3,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

CREATE INDEX IF NOT EXISTS idx_game_date ON game_calendar(game_date);

ALTER TABLE game_calendar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON game_calendar;
CREATE POLICY "Allow authenticated full access" ON game_calendar
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Specials & Promotions
CREATE TABLE IF NOT EXISTS specials (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  discount_type TEXT,
  discount_amount DECIMAL(10,2),
  start_time TIME,
  end_time TIME,
  days_of_week TEXT[],
  active BOOLEAN DEFAULT true,
  linked_game_id BIGINT REFERENCES game_calendar(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

ALTER TABLE specials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON specials;
CREATE POLICY "Allow authenticated full access" ON specials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TV Schedule / Channel Setup
CREATE TABLE IF NOT EXISTS tv_setup (
  id BIGSERIAL PRIMARY KEY,
  tv_number INT NOT NULL,
  location TEXT,
  currently_showing TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE tv_setup ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON tv_setup;
CREATE POLICY "Allow authenticated full access" ON tv_setup
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== PHASE 3: BUSINESS OPERATIONS ==========

-- Menu Items
CREATE TABLE IF NOT EXISTS menu_items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image_url TEXT,
  available BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menu_category ON menu_items(category);

ALTER TABLE menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON menu_items;
CREATE POLICY "Allow authenticated full access" ON menu_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Staff Scheduling
CREATE TABLE IF NOT EXISTS staff_shifts (
  id BIGSERIAL PRIMARY KEY,
  staff_name TEXT NOT NULL,
  position TEXT,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_date ON staff_shifts(shift_date);

ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON staff_shifts;
CREATE POLICY "Allow authenticated full access" ON staff_shifts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ========== PHASE 4: CUSTOMER ENGAGEMENT ==========

-- Loyalty Program
CREATE TABLE IF NOT EXISTS loyalty_members (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  phone TEXT,
  points INT DEFAULT 0,
  tier TEXT DEFAULT 'bronze',
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_visit TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loyalty_email ON loyalty_members(email);

ALTER TABLE loyalty_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated reads" ON loyalty_members;
CREATE POLICY "Allow authenticated reads" ON loyalty_members
  FOR SELECT TO authenticated USING (true);

-- Promo Codes
CREATE TABLE IF NOT EXISTS promo_codes (
  id BIGSERIAL PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT,
  discount_amount DECIMAL(10,2) NOT NULL,
  valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
  valid_until TIMESTAMP WITH TIME ZONE NOT NULL,
  max_uses INT,
  uses_count INT DEFAULT 0,
  active BOOLEAN DEFAULT true,
  campaign_name TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_promo_code ON promo_codes(code);

ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated full access" ON promo_codes;
CREATE POLICY "Allow authenticated full access" ON promo_codes
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_date ON analytics_events(created_at);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts" ON analytics_events;
CREATE POLICY "Allow public inserts" ON analytics_events
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated reads" ON analytics_events;
CREATE POLICY "Allow authenticated reads" ON analytics_events
  FOR SELECT TO authenticated USING (true);

-- ========== PHASE 5: CUSTOMER ACCOUNTS ==========

-- Customer Profiles
CREATE TABLE IF NOT EXISTS customer_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT,
  favorite_games BIGINT[],
  favorite_specials BIGINT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_user_id ON customer_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_customer_email ON customer_profiles(email);

ALTER TABLE customer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON customer_profiles;
CREATE POLICY "Users can view own profile" ON customer_profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own profile" ON customer_profiles;
CREATE POLICY "Users can update own profile" ON customer_profiles
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own profile" ON customer_profiles;
CREATE POLICY "Users can insert own profile" ON customer_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Ensure phone column exists (safe for existing tables)
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS phone TEXT;

-- ========== PHASE 6: CUSTOMER CHECK-INS ==========

-- Check-In Records
CREATE TABLE IF NOT EXISTS customer_checkins (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points_awarded INT DEFAULT 10,
  checked_in_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  method TEXT DEFAULT 'manual'  -- 'manual', 'geo', 'qr'
);

CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON customer_checkins(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON customer_checkins(checked_in_at);

ALTER TABLE customer_checkins ENABLE ROW LEVEL SECURITY;

-- Customers can view their own check-ins
DROP POLICY IF EXISTS "Users can view own checkins" ON customer_checkins;
CREATE POLICY "Users can view own checkins" ON customer_checkins
  FOR SELECT USING (auth.uid() = user_id);

-- Customers can insert their own check-ins
DROP POLICY IF EXISTS "Users can insert own checkins" ON customer_checkins;
CREATE POLICY "Users can insert own checkins" ON customer_checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Admins can view all check-ins (via service role key, bypasses RLS)

-- Add check-in points and streak tracking to customer profiles
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS checkin_points INT DEFAULT 0;
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS total_checkins INT DEFAULT 0;
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS current_streak INT DEFAULT 0;
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS longest_streak INT DEFAULT 0;
ALTER TABLE customer_profiles
  ADD COLUMN IF NOT EXISTS last_checkin_date DATE;

-- ========== PHASE 7: BEER MENU (TV DISPLAY) ==========

-- Beer Menu Items
CREATE TABLE IF NOT EXISTS beer_menu (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  brewery TEXT,
  style TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2),
  abv DECIMAL(4,1),
  ibu INT,
  serving TEXT DEFAULT 'Draft',
  available BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure price column is nullable (alter for existing tables)
ALTER TABLE beer_menu
  ALTER COLUMN price DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_beer_style ON beer_menu(style);
CREATE INDEX IF NOT EXISTS idx_beer_available ON beer_menu(available);

ALTER TABLE beer_menu ENABLE ROW LEVEL SECURITY;

-- Public can read available beers (for TV display page)
DROP POLICY IF EXISTS "Allow public reads" ON beer_menu;
CREATE POLICY "Allow public reads" ON beer_menu
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "Allow authenticated full access" ON beer_menu;
CREATE POLICY "Allow authenticated full access" ON beer_menu
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

