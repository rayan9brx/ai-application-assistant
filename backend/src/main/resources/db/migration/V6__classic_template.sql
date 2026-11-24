-- The "Classic" CV template, now the default for new CVs. Existing CVs keep their template.
-- The allowed ids match CvTemplate on the backend and cv-templates.ts on the frontend.
alter table public.cvs drop constraint if exists cvs_template_check;
alter table public.cvs
    add constraint cvs_template_check
        check (template in ('classic', 'simple', 'modern', 'compact', 'creative'));
alter table public.cvs alter column template set default 'classic';
