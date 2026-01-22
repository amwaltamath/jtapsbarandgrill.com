-- ========== PHASE 1: EMAIL MARKETING ==========

-- Newsletter Subscribers
CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id BIGSERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public inserts" ON newsletter_subscribers;
CREATE POLICY "Allow public inserts" ON newsletter_subscribers
  FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated reads" ON newsletter_subscribers;
CREATE POLICY "Allow authenticated reads" ON newsletter_subscribers
  FOR SELECT TO authenticated USING (true);

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

