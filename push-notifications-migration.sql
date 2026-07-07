-- Push notification subscriptions and campaign history

create table if not exists public.push_subscriptions (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  platform text not null default 'web',
  user_agent text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_active on public.push_subscriptions(active);
create index if not exists idx_push_subscriptions_user_id on public.push_subscriptions(user_id);

create table if not exists public.push_campaigns (
  id bigserial primary key,
  title text not null,
  message text not null,
  target_count integer not null default 0,
  sent_count integer not null default 0,
  failed_count integer not null default 0,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
