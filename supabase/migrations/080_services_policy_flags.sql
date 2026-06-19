ALTER TABLE services
  ADD COLUMN IF NOT EXISTS policy_flags jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN services.policy_flags IS
  'Structured salon service policies for voice agent — array of {type, ...params}.';
