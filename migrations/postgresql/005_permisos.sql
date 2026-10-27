-- Role is created by the administrator with a generated secret before this script.
ALTER ROLE stz_runtime NOCREATEDB NOCREATEROLE;
DO $$DECLARE membership record; BEGIN FOR membership IN SELECT parent.rolname FROM pg_auth_members m JOIN pg_roles parent ON parent.oid=m.roleid JOIN pg_roles member ON member.oid=m.member WHERE member.rolname='stz_runtime' LOOP EXECUTE format('REVOKE %I FROM stz_runtime',membership.rolname); END LOOP; END$$;
GRANT USAGE ON SCHEMA app_stz,operativa_stz,catalogo,gestion,gis,patrimonio,contratacion,economico TO stz_runtime;
GRANT SELECT ON ALL TABLES IN SCHEMA app_stz,operativa_stz,catalogo TO stz_runtime;
GRANT SELECT,INSERT,UPDATE ON gestion.proyectos,gestion.actuaciones,gestion.proyecto_fichas,gestion.proyecto_emplazamientos,gestion.proyecto_gastos,gestion.actuacion_gastos,patrimonio.fichas_lm_em,gis.emplazamientos,contratacion.expedientes,contratacion.lotes,economico.gastos_ficha TO stz_runtime;
GRANT INSERT,UPDATE ON app_stz.proyectos,app_stz.actuaciones,app_stz.inmuebles,app_stz.proyecto_inmuebles,app_stz.proyecto_emplazamientos,app_stz.actuacion_gastos TO stz_runtime;
DO $$DECLARE t record; BEGIN FOR t IN SELECT table_name FROM information_schema.tables WHERE table_schema='operativa_stz' AND table_name<>'stz_audit' LOOP EXECUTE format('GRANT INSERT,UPDATE ON operativa_stz.%I TO stz_runtime',t.table_name); END LOOP; END$$;
GRANT DELETE ON operativa_stz.stz_measurements,operativa_stz.stz_certificate_lines,operativa_stz.stz_invoice_lines TO stz_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA gestion,gis,patrimonio,contratacion,economico,operativa_stz TO stz_runtime;
GRANT EXECUTE ON FUNCTION app_stz.require_change(bigint) TO stz_runtime;
REVOKE ALL ON operativa_stz.stz_audit FROM stz_runtime;
GRANT SELECT ON operativa_stz.stz_audit TO stz_runtime;
REVOKE ALL ON app_stz.schema_migrations FROM stz_runtime;
GRANT SELECT ON app_stz.schema_migrations TO stz_runtime;
-- Existing deferred integrity validation reads several municipal schemas and locks
-- funding rows. Run that reviewed, fixed-SQL validator as its owner without giving
-- the application general access to those modules.
ALTER FUNCTION gestion.validar_integridad() SECURITY DEFINER;
ALTER FUNCTION gestion.validar_integridad() SET search_path=pg_catalog,public;
REVOKE ALL ON FUNCTION gestion.validar_integridad() FROM PUBLIC;
ALTER FUNCTION gestion.validar_territorio_v3() SECURITY DEFINER;
ALTER FUNCTION gestion.validar_territorio_v3() SET search_path=pg_catalog,public;
REVOKE ALL ON FUNCTION gestion.validar_territorio_v3() FROM PUBLIC;
