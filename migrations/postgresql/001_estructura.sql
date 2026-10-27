-- Consolidación Obras y Servicios. Solo administración, transacción completa.
CREATE SCHEMA operativa_stz;
CREATE TABLE operativa_stz."stz_assets" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"location_id" bigint NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"criticality" text NOT NULL,
	"status" text DEFAULT 'OPERATIVO' NOT NULL,
	"notes" text NOT NULL
);

CREATE UNIQUE INDEX "stz_assets_code_unique" ON operativa_stz."stz_assets" ("code");

CREATE TABLE operativa_stz."stz_audit" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"operation" text NOT NULL,
	"actor" text NOT NULL,
	"reason" text NOT NULL,
	"before_json" jsonb,
	"after_json" jsonb,
	"created_at" timestamptz NOT NULL
);

CREATE TABLE operativa_stz."stz_budgets" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"revision" bigint NOT NULL,
	"status" text DEFAULT 'BORRADOR' NOT NULL,
	"reason" text NOT NULL,
	"approved_on" date,
	"reference" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamptz NOT NULL
);

CREATE UNIQUE INDEX "stz_budgets_project_id_revision_unique" ON operativa_stz."stz_budgets" ("project_id","revision");

CREATE TABLE operativa_stz."stz_certificate_lines" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"certificate_id" bigint NOT NULL,
	"measurement_id" bigint NOT NULL
);

CREATE UNIQUE INDEX "stz_certificate_lines_measurement_id_unique" ON operativa_stz."stz_certificate_lines" ("measurement_id");

CREATE TABLE operativa_stz."stz_certificates" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"contract_id" bigint NOT NULL,
	"code" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"status" text DEFAULT 'BORRADOR' NOT NULL,
	"reference" text NOT NULL,
	"actor" text NOT NULL,
	"validated_on" date
);

CREATE UNIQUE INDEX "stz_certificates_code_unique" ON operativa_stz."stz_certificates" ("code");

CREATE TABLE operativa_stz."stz_contract_projects" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"contract_id" bigint NOT NULL,
	"project_id" bigint NOT NULL,
	"role" text NOT NULL
);

CREATE UNIQUE INDEX "stz_contract_projects_contract_id_project_id_unique" ON operativa_stz."stz_contract_projects" ("contract_id","project_id");

CREATE TABLE operativa_stz."stz_contracts" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"supplier" text NOT NULL,
	"kind" text NOT NULL,
	"base_cents" bigint NOT NULL,
	"vat_bps" bigint NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date NOT NULL,
	"reference" text NOT NULL,
	"status" text DEFAULT 'VIGENTE' NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX "stz_contracts_code_unique" ON operativa_stz."stz_contracts" ("code");

CREATE TABLE operativa_stz."stz_documents" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"title" text NOT NULL,
	"kind" text NOT NULL,
	"version_label" text NOT NULL,
	"reference" text NOT NULL,
	"object_key" text,
	"sha256" text,
	"mime" text,
	"size_bytes" bigint,
	"actor" text NOT NULL,
	"created_at" timestamptz NOT NULL
);

CREATE TABLE operativa_stz."stz_forecasts" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"as_of" date NOT NULL,
	"total_cents" bigint NOT NULL,
	"reason" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamptz NOT NULL
);

CREATE TABLE operativa_stz."stz_incidents" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"asset_id" bigint NOT NULL,
	"project_id" bigint NOT NULL,
	"description" text NOT NULL,
	"priority" text NOT NULL,
	"reported_on" date NOT NULL,
	"due_on" date NOT NULL,
	"status" text DEFAULT 'ABIERTA' NOT NULL,
	"actor" text NOT NULL
);

CREATE TABLE operativa_stz."stz_invoice_lines" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"invoice_id" bigint NOT NULL,
	"certificate_id" bigint,
	"order_id" bigint,
	"description" text NOT NULL,
	"base_cents" bigint NOT NULL,
	"vat_cents" bigint NOT NULL,
	CONSTRAINT "invoice_one_source" CHECK(("certificate_id" IS NOT NULL) <> ("order_id" IS NOT NULL))
);

CREATE TABLE operativa_stz."stz_invoices" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"contract_id" bigint,
	"original_id" bigint,
	"code" text NOT NULL,
	"supplier" text NOT NULL,
	"issued_on" date NOT NULL,
	"status" text DEFAULT 'BORRADOR' NOT NULL,
	"reference" text NOT NULL,
	"actor" text NOT NULL
);

CREATE UNIQUE INDEX "stz_invoices_code_unique" ON operativa_stz."stz_invoices" ("code");

CREATE TABLE operativa_stz."stz_items" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"budget_id" bigint NOT NULL,
	"action_id" bigint NOT NULL,
	"contract_id" bigint,
	"chapter" text NOT NULL,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"quantity_milli" bigint NOT NULL,
	"unit_cents" bigint NOT NULL,
	"vat_bps" bigint NOT NULL,
	"start_on" date NOT NULL,
	"end_on" date NOT NULL,
	"budget_application" text NOT NULL,
	CONSTRAINT "item_positive" CHECK("quantity_milli">0 AND "unit_cents">=0 AND "vat_bps" BETWEEN 0 AND 10000)
);

CREATE UNIQUE INDEX "stz_items_budget_id_code_unique" ON operativa_stz."stz_items" ("budget_id","code");

CREATE TABLE operativa_stz."stz_measurements" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"item_id" bigint NOT NULL,
	"quantity_milli" bigint NOT NULL,
	"measured_on" date NOT NULL,
	"evidence" text NOT NULL,
	"actor" text NOT NULL,
	"created_at" timestamptz NOT NULL,
	CONSTRAINT "measurement_positive" CHECK("quantity_milli">0)
);

CREATE TABLE operativa_stz."stz_milestones" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"name" text NOT NULL,
	"baseline_on" date NOT NULL,
	"forecast_on" date NOT NULL,
	"actual_on" date,
	"reason" text NOT NULL,
	"reference" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL
);

CREATE TABLE operativa_stz."stz_obligations" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"scope" text NOT NULL,
	"title" text NOT NULL,
	"source_url" text NOT NULL,
	"requirement" text NOT NULL,
	"review_status" text NOT NULL,
	"responsible" text NOT NULL,
	"review_on" date NOT NULL
);

CREATE TABLE operativa_stz."stz_orders" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"asset_id" bigint NOT NULL,
	"contract_id" bigint,
	"plan_id" bigint,
	"incident_id" bigint,
	"code" text NOT NULL,
	"description" text NOT NULL,
	"responsible" text NOT NULL,
	"due_on" date NOT NULL,
	"start_on" date,
	"finished_on" date,
	"status" text DEFAULT 'ABIERTA' NOT NULL,
	"result" text DEFAULT '' NOT NULL,
	"evidence" text DEFAULT '' NOT NULL,
	"checked_by" text,
	"checked_on" date,
	"expected_cents" bigint DEFAULT 0 NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL
);

CREATE UNIQUE INDEX "stz_orders_code_unique" ON operativa_stz."stz_orders" ("code");

CREATE UNIQUE INDEX "stz_orders_plan_id_due_on_unique" ON operativa_stz."stz_orders" ("plan_id","due_on");

CREATE TABLE operativa_stz."stz_payments" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"invoice_id" bigint NOT NULL,
	"paid_on" date NOT NULL,
	"amount_cents" bigint NOT NULL,
	"reference" text NOT NULL,
	"actor" text NOT NULL,
	CONSTRAINT "payment_nonzero" CHECK("amount_cents"<>0)
);

CREATE TABLE operativa_stz."stz_plans" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"asset_id" bigint NOT NULL,
	"project_id" bigint NOT NULL,
	"contract_id" bigint,
	"name" text NOT NULL,
	"frequency_days" bigint NOT NULL,
	"next_due" date NOT NULL,
	"checklist" text NOT NULL,
	"reference" text NOT NULL,
	"responsible" text NOT NULL,
	"active" bigint DEFAULT 1 NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL,
	CONSTRAINT "plan_frequency" CHECK("frequency_days">0)
);

CREATE TABLE operativa_stz."stz_receipts" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"project_id" bigint NOT NULL,
	"contract_id" bigint NOT NULL,
	"received_on" date NOT NULL,
	"result" text NOT NULL,
	"defects" text NOT NULL,
	"correction_due" date,
	"corrected_on" date,
	"warranty_until" date NOT NULL,
	"reference" text NOT NULL,
	"actor" text NOT NULL,
	"version" bigint DEFAULT 1 NOT NULL
);

CREATE TABLE operativa_stz."stz_resources" (
	"id" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
	"order_id" bigint NOT NULL,
	"kind" text NOT NULL,
	"description" text NOT NULL,
	"quantity_milli" bigint NOT NULL,
	"unit_cents" bigint NOT NULL,
	CONSTRAINT "resource_positive" CHECK("quantity_milli">0 AND "unit_cents">=0)
);

ALTER TABLE operativa_stz."stz_assets" ADD FOREIGN KEY ("location_id") REFERENCES gis.emplazamientos("id_emplazamiento") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_budgets" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_certificate_lines" ADD FOREIGN KEY ("certificate_id") REFERENCES operativa_stz."stz_certificates"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_certificate_lines" ADD FOREIGN KEY ("measurement_id") REFERENCES operativa_stz."stz_measurements"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_certificates" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_certificates" ADD FOREIGN KEY ("contract_id") REFERENCES operativa_stz."stz_contracts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_contract_projects" ADD FOREIGN KEY ("contract_id") REFERENCES operativa_stz."stz_contracts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_contract_projects" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_documents" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_forecasts" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_incidents" ADD FOREIGN KEY ("asset_id") REFERENCES operativa_stz."stz_assets"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_incidents" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_invoice_lines" ADD FOREIGN KEY ("invoice_id") REFERENCES operativa_stz."stz_invoices"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_invoice_lines" ADD FOREIGN KEY ("certificate_id") REFERENCES operativa_stz."stz_certificates"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_invoice_lines" ADD FOREIGN KEY ("order_id") REFERENCES operativa_stz."stz_orders"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_invoices" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_invoices" ADD FOREIGN KEY ("contract_id") REFERENCES operativa_stz."stz_contracts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_invoices" ADD FOREIGN KEY ("original_id") REFERENCES operativa_stz."stz_invoices"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_items" ADD FOREIGN KEY ("budget_id") REFERENCES operativa_stz."stz_budgets"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_items" ADD FOREIGN KEY ("action_id") REFERENCES gestion.actuaciones("id_actuacion") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_items" ADD FOREIGN KEY ("contract_id") REFERENCES operativa_stz."stz_contracts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_measurements" ADD FOREIGN KEY ("item_id") REFERENCES operativa_stz."stz_items"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_milestones" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_orders" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_orders" ADD FOREIGN KEY ("asset_id") REFERENCES operativa_stz."stz_assets"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_orders" ADD FOREIGN KEY ("contract_id") REFERENCES operativa_stz."stz_contracts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_orders" ADD FOREIGN KEY ("plan_id") REFERENCES operativa_stz."stz_plans"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_orders" ADD FOREIGN KEY ("incident_id") REFERENCES operativa_stz."stz_incidents"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_payments" ADD FOREIGN KEY ("invoice_id") REFERENCES operativa_stz."stz_invoices"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_plans" ADD FOREIGN KEY ("asset_id") REFERENCES operativa_stz."stz_assets"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_plans" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_plans" ADD FOREIGN KEY ("contract_id") REFERENCES operativa_stz."stz_contracts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_receipts" ADD FOREIGN KEY ("project_id") REFERENCES gestion.proyectos("id_proyecto") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_receipts" ADD FOREIGN KEY ("contract_id") REFERENCES operativa_stz."stz_contracts"("id") ON UPDATE no action ON DELETE no action;

ALTER TABLE operativa_stz."stz_resources" ADD FOREIGN KEY ("order_id") REFERENCES operativa_stz."stz_orders"("id") ON UPDATE no action ON DELETE no action;


CREATE SCHEMA app_stz;
CREATE TABLE app_stz.schema_migrations (version text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now());
ALTER TABLE gestion.proyectos ADD COLUMN version bigint NOT NULL DEFAULT 1, ADD COLUMN escenario text;
ALTER TABLE gestion.actuaciones ADD COLUMN version bigint NOT NULL DEFAULT 1;
ALTER TABLE patrimonio.fichas_lm_em ADD COLUMN longitud numeric CHECK(longitud BETWEEN -180 AND 180), ADD COLUMN latitud numeric CHECK(latitud BETWEEN -90 AND 90);
CREATE VIEW app_stz.proyectos AS SELECT * FROM gestion.proyectos;
CREATE VIEW app_stz.actuaciones AS SELECT * FROM gestion.actuaciones;
CREATE VIEW app_stz.inmuebles AS SELECT * FROM patrimonio.fichas_lm_em;
CREATE VIEW app_stz.proyecto_inmuebles AS SELECT * FROM gestion.proyecto_fichas;
CREATE VIEW app_stz.proyecto_emplazamientos AS SELECT * FROM gestion.proyecto_emplazamientos;
CREATE VIEW app_stz.actuacion_gastos AS SELECT * FROM gestion.actuacion_gastos;
CREATE VIEW app_stz.emplazamientos AS SELECT e.*, t.codigo tipo, CASE WHEN e.geom IS NULL THEN 'PENDIENTE' ELSE 'DIGITALIZADA' END geometria FROM gis.emplazamientos e JOIN catalogo.tipo_emplazamiento t USING(id_tipo_emplazamiento);
CREATE VIEW app_stz.expedientes AS SELECT e.*,prestacion_intelectual intelectual,servicios_anexo_iv anexo_iv,porcentaje_juicio_valor juicio_valor,preve_prorroga prorrogas FROM contratacion.expedientes e;
CREATE VIEW app_stz.lotes AS SELECT l.*,numero_lote numero,presupuesto_base_sin_iva importe_sin_iva FROM contratacion.lotes l;
CREATE VIEW app_stz.gastos AS SELECT g.id_gasto,pg.id_proyecto,g.id_tipo_gasto,g.numero_factura,g.concepto,g.proveedor,pg.importe_imputado importe,g.fecha_gasto,g.pagado,g.fecha_pago FROM economico.gastos_ficha g JOIN gestion.proyecto_gastos pg USING(id_gasto);
CREATE FUNCTION app_stz.require_change(n bigint) RETURNS bigint LANGUAGE plpgsql AS $$BEGIN IF n=0 THEN RAISE EXCEPTION 'El registro cambió en otra sesión. Actualiza antes de continuar.'; END IF; RETURN n; END$$;
INSERT INTO catalogo.origen_proyecto(codigo,nombre) VALUES ('PLAN_MUNICIPAL','PLAN MUNICIPAL') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.origen_proyecto(codigo,nombre) VALUES ('CONSERVACION','CONSERVACION') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.departamento(codigo,nombre) VALUES ('OBRAS_Y_SERVICIOS','OBRAS Y SERVICIOS') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.departamento(codigo,nombre) VALUES ('MEDIO_AMBIENTE','MEDIO AMBIENTE') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.departamento(codigo,nombre) VALUES ('DEPORTES','DEPORTES') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_actuacion(codigo,nombre) VALUES ('OBRA','OBRA') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_actuacion(codigo,nombre) VALUES ('SUMINISTRO','SUMINISTRO') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_actuacion(codigo,nombre) VALUES ('SERVICIO','SERVICIO') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_actuacion(codigo,nombre) VALUES ('ESTUDIO','ESTUDIO') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_actuacion(codigo,nombre) VALUES ('MANTENIMIENTO','MANTENIMIENTO') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_elemento(codigo,nombre) VALUES ('EDIFICIO','EDIFICIO') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_elemento(codigo,nombre) VALUES ('INSTALACION','INSTALACION') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_gasto(codigo,nombre) VALUES ('CERTIFICACION','CERTIFICACION') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_gasto(codigo,nombre) VALUES ('SUMINISTRO','SUMINISTRO') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_gasto(codigo,nombre) VALUES ('SERVICIO','SERVICIO') ON CONFLICT(codigo) DO NOTHING;
INSERT INTO catalogo.tipo_gasto(codigo,nombre) VALUES ('COSTE_INTERNO','COSTE INTERNO') ON CONFLICT(codigo) DO NOTHING;
-- Cutover gate: keep writes closed until the last D1 snapshot is reconciled.
CREATE TABLE app_stz.runtime_status(id integer PRIMARY KEY CHECK(id=1),write_enabled boolean NOT NULL DEFAULT false);
INSERT INTO app_stz.runtime_status(id) VALUES(1);
CREATE FUNCTION app_stz.require_ready() RETURNS boolean LANGUAGE plpgsql SET search_path=pg_catalog,app_stz AS $$BEGIN
 IF NOT (SELECT write_enabled FROM app_stz.runtime_status WHERE id=1) THEN RAISE EXCEPTION 'Consolidación en curso. Los datos se pueden consultar; vuelve a intentar guardar en unos minutos.'; END IF; RETURN true;
END$$;
