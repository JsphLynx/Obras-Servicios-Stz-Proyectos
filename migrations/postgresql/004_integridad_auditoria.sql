-- Writes must be serialized before taking the DML statement snapshot.
-- The application locks in a separate statement of the same READ COMMITTED transaction.
CREATE FUNCTION operativa_stz.require_transaction() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('app.actor',true) IS NULL OR NOT EXISTS(SELECT 1 FROM pg_locks WHERE locktype='advisory' AND pid=pg_backend_pid() AND classid=0 AND objid=6284019 AND objsubid=1 AND granted) THEN
  RAISE EXCEPTION 'La escritura requiere una transacción identificada y el bloqueo de Obras y Servicios';
 END IF;
 RETURN NULL;
END $$;
CREATE FUNCTION operativa_stz.audit_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,operativa_stz AS $$
DECLARE before_value jsonb; after_value jsonb;
BEGIN
 IF TG_OP<>'INSERT' THEN before_value=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN after_value=to_jsonb(NEW); END IF;
 INSERT INTO operativa_stz.stz_audit(table_name,record_id,operation,actor,reason,before_json,after_json,created_at)
 VALUES(TG_TABLE_SCHEMA||'.'||TG_TABLE_NAME,coalesce(after_value->>TG_ARGV[0],before_value->>TG_ARGV[0]),TG_OP,current_setting('app.actor'),coalesce(current_setting('app.reason',true),''),before_value,after_value,clock_timestamp());
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION operativa_stz.audit_change() FROM PUBLIC;
DO $$DECLARE t record; pk text; BEGIN
 FOR t IN SELECT table_schema,table_name FROM information_schema.tables WHERE table_schema='operativa_stz' AND table_name<>'stz_audit'
 UNION ALL SELECT unnest(ARRAY['gestion','gestion','gestion','gestion','gestion','gestion','patrimonio','gis','contratacion','contratacion','economico']),unnest(ARRAY['proyectos','actuaciones','proyecto_fichas','proyecto_emplazamientos','proyecto_gastos','actuacion_gastos','fichas_lm_em','emplazamientos','expedientes','lotes','gastos_ficha'])
 LOOP
 pk=CASE WHEN t.table_schema='operativa_stz' THEN 'id' WHEN t.table_name IN ('proyecto_fichas','proyecto_gastos') THEN 'id_proyecto' WHEN t.table_name='fichas_lm_em' THEN 'id_ficha_lm_em' WHEN t.table_name='gastos_ficha' THEN 'id_gasto' ELSE 'id_'||regexp_replace(t.table_name,'s$','') END;
 IF t.table_name='actuaciones' THEN pk='id_actuacion'; END IF;
 EXECUTE format('CREATE TRIGGER stz_require_transaction BEFORE INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH STATEMENT EXECUTE FUNCTION operativa_stz.require_transaction()',t.table_schema,t.table_name);
 EXECUTE format('CREATE TRIGGER stz_audit_change AFTER INSERT OR UPDATE OR DELETE ON %I.%I FOR EACH ROW EXECUTE FUNCTION operativa_stz.audit_change(%L)',t.table_schema,t.table_name,pk);
 END LOOP;
END $$;
CREATE UNIQUE INDEX stz_one_draft ON operativa_stz.stz_budgets(project_id) WHERE status='BORRADOR';
ALTER TABLE operativa_stz.stz_budgets ADD CHECK(status IN ('BORRADOR','APROBADO')),ADD CHECK(revision>0);
ALTER TABLE operativa_stz.stz_certificates ADD CHECK(status IN ('BORRADOR','VALIDADA')),ADD CHECK(period_end>=period_start),ADD CHECK(status<>'VALIDADA' OR validated_on IS NOT NULL);
ALTER TABLE operativa_stz.stz_invoices ADD CHECK(status IN ('BORRADOR','REGISTRADA'));
ALTER TABLE operativa_stz.stz_contracts ADD CHECK(base_cents>=0 AND vat_bps BETWEEN 0 AND 10000),ADD CHECK(end_on>=start_on);
ALTER TABLE operativa_stz.stz_items ADD CHECK(end_on>=start_on);
ALTER TABLE operativa_stz.stz_orders ADD CHECK(status IN ('ABIERTA','EN_CURSO','PENDIENTE_VALIDACION','CERRADA','REABIERTA')),ADD CHECK(expected_cents>=0),ADD CHECK(finished_on>=start_on),ADD CHECK(status<>'CERRADA' OR (checked_on IS NOT NULL AND checked_by IS NOT NULL));
ALTER TABLE operativa_stz.stz_plans ADD CHECK(active IN (0,1));
ALTER TABLE operativa_stz.stz_incidents ADD CHECK(due_on>=reported_on),ADD CHECK(status IN ('ABIERTA','EN_TRATAMIENTO','RESUELTA'));
ALTER TABLE operativa_stz.stz_forecasts ADD CHECK(total_cents>=0);
ALTER TABLE operativa_stz.stz_receipts ADD CHECK(warranty_until>=received_on),ADD CHECK(result IN ('CONFORME','CON_DEFECTOS')),ADD CHECK(result<>'CON_DEFECTOS' OR (correction_due IS NOT NULL AND correction_due>=received_on));
CREATE FUNCTION operativa_stz.initial_status() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF NEW.status<>TG_ARGV[0] THEN RAISE EXCEPTION 'Crea el registro en su estado inicial y utiliza la operación de validación'; END IF; RETURN NEW; END$$;
CREATE TRIGGER initial_status BEFORE INSERT ON operativa_stz.stz_budgets FOR EACH ROW EXECUTE FUNCTION operativa_stz.initial_status('BORRADOR');
CREATE TRIGGER initial_status BEFORE INSERT ON operativa_stz.stz_certificates FOR EACH ROW EXECUTE FUNCTION operativa_stz.initial_status('BORRADOR');
CREATE TRIGGER initial_status BEFORE INSERT ON operativa_stz.stz_invoices FOR EACH ROW EXECUTE FUNCTION operativa_stz.initial_status('BORRADOR');
CREATE TRIGGER initial_status BEFORE INSERT ON operativa_stz.stz_orders FOR EACH ROW EXECUTE FUNCTION operativa_stz.initial_status('ABIERTA');
CREATE FUNCTION operativa_stz.bump_version() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN NEW.version=OLD.version+1; RETURN NEW; END$$;
DO $$DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['gestion.proyectos','gestion.actuaciones','operativa_stz.stz_contracts','operativa_stz.stz_plans','operativa_stz.stz_orders','operativa_stz.stz_milestones','operativa_stz.stz_receipts'] LOOP EXECUTE format('CREATE TRIGGER stz_version BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION operativa_stz.bump_version()',t); END LOOP; END$$;
CREATE FUNCTION operativa_stz.scope_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=operativa_stz,app_stz,pg_catalog AS $$BEGIN
 IF TG_TABLE_NAME IN ('stz_certificates','stz_receipts','stz_invoices') THEN
 IF NEW.contract_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM stz_contract_projects WHERE project_id=NEW.project_id AND contract_id=NEW.contract_id) THEN RAISE EXCEPTION 'Vincula el contrato al proyecto'; END IF;
 END IF;
 IF TG_TABLE_NAME='stz_incidents' THEN
 IF NOT EXISTS(SELECT 1 FROM stz_assets a JOIN proyecto_emplazamientos pe ON pe.id_emplazamiento=a.location_id WHERE a.id=NEW.asset_id AND pe.id_proyecto=NEW.project_id) THEN RAISE EXCEPTION 'Activo fuera del ámbito del proyecto'; END IF;
 END IF;
 RETURN NEW; END$$;
DO $$DECLARE t text; BEGIN FOREACH t IN ARRAY ARRAY['stz_certificates','stz_receipts','stz_invoices','stz_incidents'] LOOP EXECUTE format('CREATE TRIGGER stz_scope_guard BEFORE INSERT OR UPDATE ON operativa_stz.%I FOR EACH ROW EXECUTE FUNCTION operativa_stz.scope_guard()',t); END LOOP; END$$;
CREATE FUNCTION operativa_stz.order_guard() RETURNS trigger LANGUAGE plpgsql SET search_path=operativa_stz,app_stz,pg_catalog AS $$BEGIN
 IF NEW.incident_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM stz_incidents WHERE id=NEW.incident_id AND project_id=NEW.project_id AND asset_id=NEW.asset_id) THEN RAISE EXCEPTION 'Incidencia incompatible con la orden'; END IF;
 IF NEW.plan_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM stz_plans WHERE id=NEW.plan_id AND project_id=NEW.project_id AND asset_id=NEW.asset_id AND contract_id IS NOT DISTINCT FROM NEW.contract_id) THEN RAISE EXCEPTION 'Plan incompatible con la orden'; END IF;
 IF TG_OP='UPDATE' AND NEW.status<>OLD.status THEN
 IF NOT ((OLD.status='ABIERTA' AND NEW.status='EN_CURSO') OR (OLD.status IN ('EN_CURSO','REABIERTA') AND NEW.status=CASE WHEN OLD.status='REABIERTA' THEN 'EN_CURSO' ELSE 'PENDIENTE_VALIDACION' END) OR (OLD.status='PENDIENTE_VALIDACION' AND NEW.status IN ('CERRADA','EN_CURSO')) OR (OLD.status='CERRADA' AND NEW.status='REABIERTA')) THEN RAISE EXCEPTION 'Transición de estado no permitida'; END IF;
 IF NEW.status='REABIERTA' AND EXISTS(SELECT 1 FROM stz_invoice_lines l JOIN stz_invoices f ON f.id=l.invoice_id WHERE l.order_id=NEW.id AND f.status='REGISTRADA') THEN RAISE EXCEPTION 'La orden facturada conserva su evidencia; crea una orden correctiva'; END IF;
 END IF;
 RETURN NEW; END$$;
CREATE TRIGGER stz_order_guard BEFORE INSERT OR UPDATE ON operativa_stz.stz_orders FOR EACH ROW EXECUTE FUNCTION operativa_stz.order_guard();
CREATE FUNCTION operativa_stz.immutable_parent() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF (to_jsonb(NEW)->TG_ARGV[0]) IS DISTINCT FROM (to_jsonb(OLD)->TG_ARGV[0]) THEN RAISE EXCEPTION 'No se puede trasladar el registro entre ámbitos'; END IF; RETURN NEW; END$$;
DO $$DECLARE pair text[]; BEGIN FOREACH pair SLICE 1 IN ARRAY ARRAY[['stz_items','budget_id'],['stz_resources','order_id'],['stz_budgets','project_id'],['stz_certificates','project_id'],['stz_certificates','contract_id'],['stz_invoices','project_id'],['stz_invoices','contract_id'],['stz_invoices','original_id'],['stz_orders','project_id'],['stz_orders','asset_id'],['stz_orders','contract_id'],['stz_plans','project_id'],['stz_plans','asset_id'],['stz_plans','contract_id']] LOOP EXECUTE format('CREATE TRIGGER stz_parent_%I BEFORE UPDATE ON operativa_stz.%I FOR EACH ROW EXECUTE FUNCTION operativa_stz.immutable_parent(%L)',pair[2],pair[1],pair[2]); END LOOP; END$$;
CREATE FUNCTION operativa_stz.action_guard() RETURNS trigger LANGUAGE plpgsql AS $$BEGIN
 IF EXISTS(SELECT 1 FROM catalogo.estado_actuacion WHERE id_estado_actuacion=NEW.id_estado_actuacion AND codigo='FINALIZADO') AND NEW.porcentaje_avance IS DISTINCT FROM 100 THEN RAISE EXCEPTION 'Una actuación finalizada debe tener un avance del 100%%'; END IF;
 IF TG_OP='UPDATE' AND NEW.id_proyecto<>OLD.id_proyecto AND EXISTS(SELECT 1 FROM operativa_stz.stz_items WHERE action_id=OLD.id_actuacion) THEN RAISE EXCEPTION 'La actuación tiene partidas; no puede cambiar de proyecto'; END IF; RETURN NEW; END$$;
CREATE TRIGGER stz_action_guard BEFORE INSERT OR UPDATE ON gestion.actuaciones FOR EACH ROW EXECUTE FUNCTION operativa_stz.action_guard();
CREATE UNIQUE INDEX stz_gasto_factura_unique ON economico.gastos_ficha(numero_factura) WHERE numero_factura IS NOT NULL;
