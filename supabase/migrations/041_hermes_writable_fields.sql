BEGIN;

ALTER TABLE custom_fields
  ADD COLUMN IF NOT EXISTS hermes_writable BOOLEAN NOT NULL DEFAULT FALSE;

-- These are explicit permissions, not a blanket write capability.
INSERT INTO custom_fields (account_id, user_id, field_name, field_type, hermes_writable)
SELECT a.id, a.owner_user_id, seed.field_name, seed.field_type, TRUE
FROM accounts a
CROSS JOIN (VALUES
  ('Cidade', 'text'),
  ('Estado', 'text'),
  ('Valor médio da fatura', 'number'),
  ('Concessionária', 'text'),
  ('Melhor horário', 'text'),
  ('Fatura recebida', 'boolean')
) AS seed(field_name, field_type)
WHERE a.owner_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM custom_fields cf
    WHERE cf.account_id = a.id AND lower(cf.field_name) = lower(seed.field_name)
  );

UPDATE custom_fields SET hermes_writable = TRUE
WHERE field_name IN (
  'Cidade', 'Estado', 'Valor médio da fatura',
  'Concessionária', 'Melhor horário', 'Fatura recebida'
);

COMMIT;
