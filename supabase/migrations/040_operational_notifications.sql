BEGIN;

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type IN (
  'conversation_assigned', 'new_contact', 'human_handoff_requested',
  'invoice_received', 'media_rejected', 'channel_failure', 'hermes_failure'
));
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'info'
    CHECK (severity IN ('info', 'attention', 'critical')),
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::JSONB;

CREATE OR REPLACE FUNCTION notify_account_operators(
  p_account_id UUID, p_type TEXT, p_title TEXT, p_body TEXT DEFAULT NULL,
  p_conversation_id UUID DEFAULT NULL, p_contact_id UUID DEFAULT NULL,
  p_severity TEXT DEFAULT 'info', p_preferred_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::JSONB
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO notifications (account_id, user_id, type, conversation_id, contact_id, title, body, severity, metadata)
  SELECT p_account_id, recipients.user_id, p_type, p_conversation_id, p_contact_id,
         p_title, p_body, p_severity, COALESCE(p_metadata, '{}'::JSONB)
  FROM (
    SELECT p_preferred_user_id AS user_id WHERE p_preferred_user_id IS NOT NULL
    UNION
    SELECT am.user_id FROM account_members am
    WHERE am.account_id = p_account_id AND am.role IN ('owner', 'admin')
      AND p_preferred_user_id IS NULL
  ) recipients
  WHERE recipients.user_id IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION notify_account_operators(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION notify_account_operators(UUID, TEXT, TEXT, TEXT, UUID, UUID, TEXT, UUID, JSONB)
  TO service_role;

CREATE OR REPLACE FUNCTION notify_new_contact()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM notify_account_operators(NEW.account_id, 'new_contact', 'Novo cliente',
    COALESCE(NULLIF(NEW.name, ''), NEW.phone) || ' entrou no atendimento.',
    NULL, NEW.id, 'info', NULL, jsonb_build_object('phone', NEW.phone));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notification new contact: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_contact_created_notification ON contacts;
CREATE TRIGGER on_contact_created_notification AFTER INSERT ON contacts
  FOR EACH ROW EXECUTE FUNCTION notify_new_contact();

CREATE OR REPLACE FUNCTION notify_human_handoff()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name TEXT;
BEGIN
  IF NOT NEW.human_handoff THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.human_handoff THEN RETURN NEW; END IF;
  SELECT COALESCE(NULLIF(name, ''), phone) INTO v_name FROM contacts WHERE id = NEW.contact_id;
  PERFORM notify_account_operators(NEW.account_id, 'human_handoff_requested',
    'Atendimento humano solicitado',
    COALESCE(v_name, 'Cliente') || ': ' || COALESCE(NEW.handoff_reason, 'Solicitado pela Diana'),
    NEW.id, NEW.contact_id, 'attention', NEW.assigned_agent_id,
    jsonb_build_object('reason', NEW.handoff_reason));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notification handoff: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_human_handoff_notification ON conversations;
CREATE TRIGGER on_human_handoff_notification AFTER INSERT OR UPDATE OF human_handoff ON conversations
  FOR EACH ROW EXECUTE FUNCTION notify_human_handoff();

CREATE OR REPLACE FUNCTION notify_invoice_received()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conversation conversations%ROWTYPE; v_name TEXT;
BEGIN
  IF NEW.sender_type <> 'customer' OR NEW.content_type <> 'document' THEN RETURN NEW; END IF;
  SELECT * INTO v_conversation FROM conversations WHERE id = NEW.conversation_id;
  SELECT COALESCE(NULLIF(name, ''), phone) INTO v_name FROM contacts WHERE id = v_conversation.contact_id;
  PERFORM notify_account_operators(v_conversation.account_id, 'invoice_received', 'Arquivo recebido',
    COALESCE(v_name, 'Cliente') || ' enviou um documento para análise.',
    NEW.conversation_id, v_conversation.contact_id, 'attention', v_conversation.assigned_agent_id,
    jsonb_build_object('message_id', NEW.id, 'media_url', NEW.media_url));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notification document: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_invoice_received_notification ON messages;
CREATE TRIGGER on_invoice_received_notification AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION notify_invoice_received();

CREATE OR REPLACE FUNCTION notify_rejected_media()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_conversation conversations%ROWTYPE; v_name TEXT;
BEGIN
  IF NEW.observation_type <> 'triage' OR NOT (
    lower(NEW.content) LIKE '%acima do limite%' OR lower(NEW.content) LIKE '%tamanho%recus%'
  ) THEN RETURN NEW; END IF;
  SELECT * INTO v_conversation FROM conversations WHERE id = NEW.conversation_id;
  SELECT COALESCE(NULLIF(name, ''), phone) INTO v_name FROM contacts WHERE id = NEW.contact_id;
  PERFORM notify_account_operators(NEW.account_id, 'media_rejected', 'Arquivo grande recusado',
    COALESCE(v_name, 'Cliente') || ': ' || NEW.content,
    NEW.conversation_id, NEW.contact_id, 'attention', v_conversation.assigned_agent_id,
    jsonb_build_object('observation_id', NEW.id));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notification rejected media: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_rejected_media_notification ON lead_observations;
CREATE TRIGGER on_rejected_media_notification AFTER INSERT ON lead_observations
  FOR EACH ROW EXECUTE FUNCTION notify_rejected_media();

CREATE OR REPLACE FUNCTION notify_evolution_failure()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status NOT IN ('disconnected', 'error') OR NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  PERFORM notify_account_operators(NEW.account_id, 'channel_failure', 'WhatsApp desconectado',
    'A instância ' || NEW.instance_name || ' precisa de atenção.', NULL, NULL, 'critical', NULL,
    jsonb_build_object('instance', NEW.instance_name, 'status', NEW.status));
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN RAISE WARNING 'notification Evolution: %', SQLERRM; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_evolution_failure_notification ON evolution_config;
CREATE TRIGGER on_evolution_failure_notification AFTER UPDATE OF status ON evolution_config
  FOR EACH ROW EXECUTE FUNCTION notify_evolution_failure();

COMMIT;
