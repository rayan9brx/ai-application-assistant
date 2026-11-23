-- The CV template (PDF layout) chosen for each saved CV. Existing CVs keep the plain layout
-- they were exported with so far ('simple'). The allowed ids match CvTemplate on the backend
-- and cv-templates.ts on the frontend.
alter table public.cvs
    add column template varchar(20) not null default 'simple'
        check (template in ('simple', 'modern', 'compact', 'creative'));
