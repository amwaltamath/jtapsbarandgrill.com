# Copilot Instructions for JTaps Bar and Grill

## Project snapshot
- Astro 5 static site with React islands (see astro.config.mjs; output is `static`).
- Supabase (`@supabase/supabase-js` v2) for data and auth; admin UI uses client-side auth.
- API routes under src/pages/api integrate Resend (email) and Twilio (SMS).
- Styles: component CSS in src/styles, global styles in Layout.astro.

## Architecture & data flow
- Public pages are Astro files in src/pages and wrap Layout.astro for SEO/meta/footer.
- React islands live in src/components and are mounted from Astro via client:* directives (e.g., Navigation in Layout.astro, AdminDashboard in src/pages/admin/index.astro with client:only="react").
- Admin dashboard uses Supabase client auth and CRUDs tables like menu_items, specials, game_calendar, newsletter_subscribers via components in src/components/admin.
- **Role-based access control**: AdminDashboard fetches user role from admin_users table and filters visible tabs per role (ROLE_ALLOWED_TABS map in AdminDashboard.tsx). API route /api/admin/users handles user promotion/demotion and set_role action.
- API routes:
  - subscribe.ts saves newsletter_subscribers and sends welcome email via Resend.
  - send-promotional-email.ts batch-sends Resend email campaigns.
  - send-sms-campaign.ts sends Twilio SMS and records sms_campaigns.
  - /api/admin/users.ts requires admin auth and manages user admin_users entries with role field.

## Conventions & patterns
- Prefer Astro components for static content (src/components/*.astro); use React only for interactive admin/features.
- Assets live under public/images and are referenced as /images/...
- Supabase clients are proxied in src/lib/supabase.ts; `supabaseAdmin` must stay server-only.
- API routes expect JSON and return JSON responses with status codes.
- **Admin users**: Must have a row in admin_users table (user_id FK to auth.users, role field defaults to 'admin', supports 'beer_menu').
- **Role management**: Add role to ROLE_ALLOWED_TABS map in AdminDashboard.tsx to create new roles; API validates role values server-side.

## Environment & integrations
- Supabase: PUBLIC_SUPABASE_URL, PUBLIC_SUPABASE_ANON_KEY; SUPABASE_SERVICE_ROLE_KEY for server-only usage.
- Resend: RESEND_API_KEY (see src/lib/resend.ts).
- Twilio: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (see src/lib/twilio.ts).

## Developer workflows
- Dev server: npm run dev
- Build: npm run build (runs astro check then astro build)
- Preview: npm run preview
- Types: ambient types live in src/env.d.ts

## Examples
- Mount a React island: Layout.astro renders <Navigation client:load />.
- Use Supabase in UI components: MenuManager.tsx reads/writes menu_items with supabase.from(...).

## Feedback
- If any workflows or integrations are missing, say which ones to add.
