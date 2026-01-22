# Copilot Instructions for JTaps Bar and Grill

Project snapshot
- Frontend: Astro 5 + React islands
- Data/Auth: Supabase (`@supabase/supabase-js` v2)
- Styling: component CSS under `src/styles/` + global in `Layout.astro`
- Deployment: Vercel/Netlify (Astro-native)

Architecture & rendering
- Astro drives static pages under `src/pages/` (e.g., `index.astro`, `menu.astro`, `contact.astro`, `watch-the-game.astro`).
- React is used for interactive islands; see [src/components/Navigation.tsx](src/components/Navigation.tsx) mounted in [src/layouts/Layout.astro](src/layouts/Layout.astro#L58) via `client:load`.
- Global SEO/meta and footer live in [src/layouts/Layout.astro](src/layouts/Layout.astro).
- Keep customer-facing pages lean; prefer Astro components ([src/components/About.astro](src/components/About.astro), [src/components/Hero.astro](src/components/Hero.astro), [src/components/MenuHighlight.astro](src/components/MenuHighlight.astro), [src/components/Visit.astro](src/components/Visit.astro)) for content.

Supabase integration
- Client init in [src/lib/supabase.ts](src/lib/supabase.ts): uses `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY`.
- `supabaseAdmin` uses `SUPABASE_SERVICE_ROLE_KEY` and must be server-only. Do not import it in React/Astro client code.
- Add environment variables to `.env` and configure host secrets accordingly.

Patterns & conventions
- React islands: import TSX in Astro and opt-in with `client:*` directives; prefer `client:visible` or `client:idle` unless functionality requires `client:load`.
- Styles: component-specific CSS in `src/styles/` (e.g., [src/styles/navigation.css](src/styles/navigation.css)), global styles in [src/layouts/Layout.astro](src/layouts/Layout.astro#L113).
- Routing: file-based under `src/pages/`; use semantic URLs (`/menu`, `/watch-the-game`, `/contact`).
- Assets: place images under `public/images/`; reference with `/images/...`.

Developer workflows
- Dev: `npm run dev` (Astro dev server).
- Build: `npm run build` (includes `astro check` then `astro build`).
- Preview: `npm run preview`.
- TypeScript ambient types in [src/env.d.ts](src/env.d.ts); keep imports typed.

Implementation examples
- Mount a React island: import `Navigation` in `Layout.astro` and render `<Navigation client:load />`.
- Use Supabase on client: `import { supabase } from '../lib/supabase';` then `await supabase.from('menu_items').select('*')` respecting RLS policies.

Security & data
- Enable RLS on tables with employee/privileged data; public tables (e.g., menu) can be read-only for anon.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to client; use only in server contexts (future API routes).

Adding features
- New static page: add `.astro` under `src/pages/` and wrap with `Layout.astro` props (`title`, `description`, `ogImage`).
- Interactive component: place TSX under `src/components/`, style under `src/styles/`, mount with an appropriate `client:*` directive.

Feedback
- If any of the above feels incomplete (e.g., admin API endpoints), say which features to prioritize and we’ll extend these instructions accordingly.
