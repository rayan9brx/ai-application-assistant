-- What people type into the smart prompt box (homepage and dashboard), for the admin's
-- "What users ask for". The text is cut to 300 characters; rows are deleted after 90 days
-- (PromptLogService.cleanUp). Like the other tables, only the backend touches it: RLS with no
-- policies keeps the Supabase Data API out.
create table public.prompt_logs (
    id         bigint generated always as identity primary key,
    text       varchar(300) not null,
    route      varchar(10) not null check (route in ('score', 'tailor', 'fix', 'build', 'other')),
    -- Null for guests; cleared when the account is deleted.
    user_id    uuid references auth.users (id) on delete set null,
    created_at timestamptz not null default now()
);
create index prompt_logs_created_at_idx on public.prompt_logs (created_at desc);

alter table public.prompt_logs enable row level security;
