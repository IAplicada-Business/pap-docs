ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativa',
ADD COLUMN IF NOT EXISTS cor_acento text;

COMMENT ON COLUMN organizations.status IS 'Status da empresa: ativa, suspensa, trial';
COMMENT ON COLUMN organizations.cor_acento IS 'Cor de acento para branding white label';
