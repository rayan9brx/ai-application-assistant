CREATE TABLE application_draft (
    id UUID PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    job_title VARCHAR(150) NOT NULL,
    company VARCHAR(150) NOT NULL,
    language VARCHAR(10) NOT NULL CHECK (language IN ('English', 'German')),
    source_cv TEXT NOT NULL CHECK (CHAR_LENGTH(source_cv) <= 30000),
    job_description TEXT NOT NULL CHECK (CHAR_LENGTH(job_description) <= 30000),
    include_letter BOOLEAN NOT NULL,
    motivation VARCHAR(3000) NOT NULL,
    edited_cv TEXT NOT NULL CHECK (CHAR_LENGTH(edited_cv) <= 60000),
    edited_letter TEXT CHECK (CHAR_LENGTH(edited_letter) <= 60000),
    demo BOOLEAN NOT NULL,
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX application_draft_owner_updated ON application_draft(user_id, updated_at DESC, id);
