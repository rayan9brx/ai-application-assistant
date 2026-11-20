-- Flyway callback, run after every migrate. Flyway's history table sits in the exposed public
-- schema; enable RLS (no policies) so Supabase's Data API cannot read it. Idempotent.
alter table public.flyway_schema_history enable row level security;
