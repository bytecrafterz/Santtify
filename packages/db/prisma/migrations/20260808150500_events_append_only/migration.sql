-- Eventos são a fonte da verdade e não podem ser reescritos.
--
-- Isto foi prometido ao cliente em texto ("os eventos brutos individuais ficam
-- armazenados sempre") e aqui vira garantia estrutural em vez de convenção:
-- um bug de aplicação, um script de manutenção distraído ou um ORM mal usado
-- não conseguem alterar histórico.
--
-- A exclusão continua possível apenas dentro da política de retenção LGPD/GDPR
-- e do direito ao apagamento, executada com a flag de sessão abaixo:
--
--   SET LOCAL pv.allow_event_purge = 'on';
--   DELETE FROM events WHERE ...;
--
-- Isso mantém o apagamento auditável e deliberado, nunca acidental.

CREATE OR REPLACE FUNCTION pv_events_block_update()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION
    'events e append-only: UPDATE bloqueado (evento id=%). Corrija por evento compensatorio, nunca reescrevendo o historico.',
    OLD.id
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION pv_events_block_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF current_setting('pv.allow_event_purge', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION
      'events e append-only: DELETE bloqueado (evento id=%). Use SET LOCAL pv.allow_event_purge = ''on'' apenas para retencao LGPD/GDPR.',
      OLD.id
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_no_update
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION pv_events_block_update();

CREATE TRIGGER events_no_delete
  BEFORE DELETE ON events
  FOR EACH ROW EXECUTE FUNCTION pv_events_block_delete();

-- receivedAt é carimbo do servidor: a aplicação nunca deve ditá-lo.
CREATE OR REPLACE FUNCTION pv_events_stamp_received_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW."receivedAt" := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_stamp_received_at
  BEFORE INSERT ON events
  FOR EACH ROW EXECUTE FUNCTION pv_events_stamp_received_at();
