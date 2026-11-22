-- Admin area: roles, cookieless visitor analytics, AI usage and an audit log of admin CV views.
-- Like V1, only the Spring Boot backend touches these tables; RLS with no policies keeps the
-- Supabase Data API out.

-- Set an admin by hand in the Supabase SQL editor:
--   update public.profiles set role = 'admin' where id = '<your auth user id>';
alter table public.profiles
    add column role varchar(20) not null default 'user' check (role in ('user', 'admin')),
    -- Country (ISO code) of the user's latest visit, from GeoIP. Never an IP address.
    add column country varchar(2);

-- One row per page view. No IP address, user id or cookie is stored: visitor_hash is
-- sha256(daily salt + IP + user agent), and the salt is deleted after a day, so a hash cannot be
-- linked to a person or to the same visitor on another day.
create table public.page_views (
    id              bigint generated always as identity primary key,
    path            varchar(200) not null,
    country         varchar(2),
    city            varchar(100),
    referrer_domain varchar(200),
    device_type     varchar(10) not null check (device_type in ('mobile', 'desktop')),
    visitor_hash    varchar(64) not null,
    created_at      timestamptz not null default now()
);
create index page_views_created_at_idx on public.page_views (created_at);

-- Today's (and yesterday's) random salt for visitor_hash; older salts are deleted daily.
create table public.visitor_salts (
    day  date primary key,
    salt bytea not null
);

-- Tokens per Claude call, for the admin cost estimate. cost_usd uses the prices configured when
-- the call was made, so a later price change does not rewrite history.
create table public.ai_usage (
    id            bigint generated always as identity primary key,
    -- Cleared when the account is deleted, so usage stays countable without pointing at a person.
    user_id       uuid references auth.users (id) on delete set null,
    endpoint      varchar(20) not null,
    model         varchar(60) not null,
    input_tokens  integer not null,
    output_tokens integer not null,
    cost_usd      numeric(12, 6) not null,
    created_at    timestamptz not null default now()
);
create index ai_usage_created_at_idx on public.ai_usage (created_at);

-- Every time an admin opens a user's CV content, with the reason they gave.
create table public.admin_audit_log (
    id         bigint generated always as identity primary key,
    admin_id   uuid not null,
    cv_id      uuid references public.cvs (id) on delete set null,
    reason     varchar(300) not null,
    created_at timestamptz not null default now()
);
create index admin_audit_log_created_at_idx on public.admin_audit_log (created_at desc);

create index analyses_created_at_idx on public.analyses (created_at);

alter table public.page_views enable row level security;
alter table public.visitor_salts enable row level security;
alter table public.ai_usage enable row level security;
alter table public.admin_audit_log enable row level security;
