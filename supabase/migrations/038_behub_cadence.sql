-- Cadencia comercial BeHub sem n8n: 15 min, 4 h e 24 h.
BEGIN;

ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS cadence_step SMALLINT NOT NULL DEFAULT 0
    CHECK (cadence_step BETWEEN 0 AND 3),
  ADD COLUMN IF NOT EXISTS cadence_due_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cadence_last_inbound_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cadence_completed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_conversations_cadence_due
  ON conversations(cadence_due_at)
  WHERE cadence_due_at IS NOT NULL
    AND cadence_completed_at IS NULL
    AND automation_contact_allowed = TRUE
    AND do_not_contact_at IS NULL;

COMMIT;
