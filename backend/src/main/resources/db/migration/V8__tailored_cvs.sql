-- CVs made on /tailor: the job they were tailored for and the estimated match after tailoring,
-- for the "Tailored for {Company}" tag in My Documents. Null for ordinary CVs. RLS is already on.
alter table public.cvs
    add column tailored_company   varchar(120),
    add column tailored_job_title varchar(160),
    add column match_score        smallint check (match_score between 0 and 100);
