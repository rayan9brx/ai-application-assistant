-- One-time onboarding question after a user's first sign-up / log-in.
-- onboarding_answer is one of the keys AccountService.ONBOARDING_ANSWERS accepts, or 'skipped'.
alter table public.profiles
    add column onboarding_answer varchar(40),
    add column onboarding_done   boolean not null default false;
