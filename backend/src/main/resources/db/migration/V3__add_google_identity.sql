ALTER TABLE app_user ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE app_user ADD COLUMN google_sub VARCHAR(255) UNIQUE;
ALTER TABLE app_user ADD CONSTRAINT app_user_has_credential
    CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);
