-- ============================================================
-- 037_behub_foundation.sql
-- Base operacional da BeHub: Evolution, handoff, observacoes
-- imutaveis, auditoria, qualificacao e defaults brasileiros.
-- ============================================================

BEGIN;

ALTER TABLE accounts
  ALTER COLUMN default_currency SET DEFAULT 'BRL';

UPDATE accounts
SET default_currency = 'BRL'
WHERE default_currency = 'USD';

ALTER TABLE deals
  ALTER COLUMN currency SET DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS qualification_data JSONB NOT NULL DEFAULT '{}'::JSONB,
  ADD COLUMN IF NOT EXISTS ai_summary TEXT,
  ADD COLUMN IF NOT EXISTS next_action TEXT,
  ADD COLUMN IF NOT EXISTS qualification_reason TEXT;

UPDATE deals
SET currency = 'BRL'
WHERE currency = 'USD';

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS human_handoff BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS handoff_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS handoff_reason TEXT,
  ADD COLUMN IF NOT EXISTS automation_contact_allowed BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS do_not_contact_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS do_not_contact_reason TEXT,
  ADD COLUMN IF NOT EXISTS queue_entered_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_handoff_queue
  ON conversations(account_id, queue_entered_at)
  WHERE human_handoff AND assigned_agent_id IS NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'meta',
  ADD COLUMN IF NOT EXISTS provider_instance TEXT,
  ADD COLUMN IF NOT EXISTS external_message_id TEXT,
  ADD COLUMN IF NOT EXISTS sent_by_type TEXT
    CHECK (sent_by_type IS NULL OR sent_by_type IN ('diana', 'human', 'system'));

UPDATE messages
SET external_message_id = message_id
WHERE external_message_id IS NULL AND message_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_provider_external_unique
  ON messages(provider, COALESCE(provider_instance, ''), external_message_id)
  WHERE external_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS evolution_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL UNIQUE REFERENCES accounts(id) ON DELETE CASCADE,
  api_url TEXT NOT NULL,
  encrypted_api_key TEXT,
  instance_name TEXT NOT NULL DEFAULT 'BeHub',
  instance_id TEXT,
  integration_type TEXT NOT NULL DEFAULT 'WHATSAPP-BAILEYS',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  status TEXT NOT NULL DEFAULT 'disconnected'
    CHECK (status IN ('disconnected', 'connecting', 'connected', 'error')),
  connected_phone TEXT,
  last_event_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE evolution_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS evolution_config_select ON evolution_config;
DROP POLICY IF EXISTS evolution_config_insert ON evolution_config;
DROP POLICY IF EXISTS evolution_config_update ON evolution_config;
DROP POLICY IF EXISTS evolution_config_delete ON evolution_config;

CREATE POLICY evolution_config_select ON evolution_config FOR SELECT
  USING (is_account_member(account_id, 'admin'));
CREATE POLICY evolution_config_insert ON evolution_config FOR INSERT
  WITH CHECK (is_account_member(account_id, 'admin'));
CREATE POLICY evolution_config_update ON evolution_config FOR UPDATE
  USING (is_account_member(account_id, 'admin'));
CREATE POLICY evolution_config_delete ON evolution_config FOR DELETE
  USING (is_account_member(account_id, 'owner'));

DROP TRIGGER IF EXISTS set_updated_at ON evolution_config;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON evolution_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS lead_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
  author_type TEXT NOT NULL CHECK (author_type IN ('diana', 'human', 'system')),
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observation_type TEXT NOT NULL DEFAULT 'note',
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_observations_contact_created
  ON lead_observations(account_id, contact_id, created_at DESC);

ALTER TABLE lead_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_observations_select ON lead_observations;
DROP POLICY IF EXISTS lead_observations_insert ON lead_observations;

CREATE POLICY lead_observations_select ON lead_observations FOR SELECT
  USING (is_account_member(account_id));
CREATE POLICY lead_observations_insert ON lead_observations FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

-- Sem UPDATE/DELETE para usuarios autenticados: o historico e append-only.

CREATE TABLE IF NOT EXISTS behub_audit_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('diana', 'human', 'system', 'integration')),
  actor_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  before_data JSONB,
  after_data JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_behub_audit_account_created
  ON behub_audit_log(account_id, created_at DESC);

ALTER TABLE behub_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS behub_audit_log_select ON behub_audit_log;
DROP POLICY IF EXISTS behub_audit_log_insert ON behub_audit_log;

CREATE POLICY behub_audit_log_select ON behub_audit_log FOR SELECT
  USING (is_account_member(account_id, 'admin'));
CREATE POLICY behub_audit_log_insert ON behub_audit_log FOR INSERT
  WITH CHECK (is_account_member(account_id, 'agent'));

COMMIT;
