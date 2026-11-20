-- Accounts and saved CVs. Only the Spring Boot backend reads and writes these tables, over a
-- direct database connection, and it always filters by the authenticated user's id.
-- RLS is enabled with no policies so Supabase's public Data API (anon/authenticated roles)
-- cannot read or write any row.

create table public.profiles (
    id         uuid primary key references auth.users (id) on delete cascade,
    full_name  varchar(200),
    plan       varchar(20) not null default 'free' check (plan in ('free', 'pro', 'lifetime')),
    created_at timestamptz not null default now()
);

create table public.cvs (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references public.profiles (id) on delete cascade,
    title           varchar(200) not null,
    content         jsonb not null,
    job_description text,
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);
create index cvs_user_id_updated_at_idx on public.cvs (user_id, updated_at desc);

create table public.analyses (
    id              uuid primary key default gen_random_uuid(),
    cv_id           uuid not null references public.cvs (id) on delete cascade,
    user_id         uuid not null references public.profiles (id) on delete cascade,
    overall_score   integer not null check (overall_score between 0 and 100),
    category_scores jsonb not null,
    result          jsonb not null,
    created_at      timestamptz not null default now()
);
create index analyses_cv_id_created_at_idx on public.analyses (cv_id, created_at desc);
create index analyses_user_id_idx on public.analyses (user_id);

alter table public.profiles enable row level security;
alter table public.cvs enable row level security;
alter table public.analyses enable row level security;
-- Flyway's own history table is locked by Flyway while migrations run; afterMigrate.sql secures it.
