-- Multi-step onboarding (replaces V3's single question). One row per user, saved after every
-- step, so a user who skips keeps their partial answers. Like V1, only the Spring Boot backend
-- reads and writes this table, always filtered by the authenticated user's id; RLS with no
-- policies keeps the Supabase Data API out. Rows go with the profile when an account is deleted.
create table public.onboarding_answers (
    user_id          uuid primary key references public.profiles (id) on delete cascade,
    challenge        varchar(40),
    found_jobs       varchar(40),
    search_status    varchar(40),
    experience_level varchar(40),
    roles            text[] not null default '{}',
    work_modes       text[] not null default '{}',
    locations        text[] not null default '{}',
    min_salary       varchar(20),
    completed        boolean not null default false,
    -- The step (1-8) the user pressed "Skip for now" on; null if they never skipped.
    skipped_at_step  integer check (skipped_at_step between 1 and 8),
    created_at       timestamptz not null default now(),
    updated_at       timestamptz not null default now()
);
alter table public.onboarding_answers enable row level security;

-- Keep the answers to V3's single question (those users count as onboarded: skipped at step 1),
-- then drop its columns.
insert into public.onboarding_answers (user_id, challenge, completed, skipped_at_step)
select id,
       case when onboarding_answer in ('cv_quality', 'ats', 'tailor', 'job_search') then onboarding_answer end,
       false,
       1
from public.profiles
where onboarding_done;

alter table public.profiles
    drop column onboarding_answer,
    drop column onboarding_done;
