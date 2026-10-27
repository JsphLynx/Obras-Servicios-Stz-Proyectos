CREATE TABLE IF NOT EXISTS app_stz.web_environment(id integer PRIMARY KEY CHECK(id=1),branch_id text NOT NULL UNIQUE);
-- Substitute :branch_id using the confirmed target branch, never a request value.
INSERT INTO app_stz.web_environment VALUES(1,':branch_id') ON CONFLICT(id) DO NOTHING;
REVOKE ALL ON app_stz.web_environment FROM PUBLIC;
GRANT SELECT ON app_stz.web_environment TO stz_runtime;
CREATE OR REPLACE FUNCTION app_stz.check_web_environment(expected text) RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog AS $$
BEGIN
 IF current_user<>'stz_runtime' OR NOT EXISTS(SELECT 1 FROM app_stz.web_environment WHERE id=1 AND branch_id=expected) THEN
 RAISE EXCEPTION 'Conexión o rol incompatible con el entorno solicitado'; END IF;
 RETURN true;
END $$;
REVOKE ALL ON FUNCTION app_stz.check_web_environment(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_stz.check_web_environment(text) TO stz_runtime;
CREATE OR REPLACE VIEW app_stz.web_awards AS
 SELECT a.id_adjudicacion id,e.id_proyecto project_id,e.numero_expediente||' · lote '||l.numero_lote name,
 a.importe_sin_iva*100 base_cents,a.importe_iva*100 vat_cents,t.codigo kind,c.razon_social supplier,
 a.fecha_inicio start_on,a.fecha_fin_prevista end_on,a.referencia_resolucion reference,e.objeto object,
 a.vigente,e.estado,(SELECT id FROM operativa_stz.stz_contracts s WHERE s.id_adjudicacion=a.id_adjudicacion) contract_id
 FROM contratacion.adjudicaciones a JOIN contratacion.lotes l USING(id_lote)
 JOIN contratacion.expedientes e USING(id_expediente) JOIN contratacion.contratistas c USING(id_contratista)
 JOIN catalogo.tipo_contrato t USING(id_tipo_contrato);
GRANT SELECT ON app_stz.web_awards,app_stz.demo_casos,app_stz.demo_documentos_contenido TO stz_runtime;
