-- Apply to a validation branch first, then main. No business data is changed.
CREATE TABLE IF NOT EXISTS app_stz.web_users (
 user_id text PRIMARY KEY, email text NOT NULL, role text NOT NULL DEFAULT 'PENDIENTE'
 CHECK(role IN ('ADMIN','EDITOR','LECTOR','PENDIENTE','BLOQUEADO')),
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS app_stz.web_access_audit (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, actor text NOT NULL, subject text NOT NULL,
 old_role text, new_role text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON app_stz.web_users,app_stz.web_access_audit FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON app_stz.web_users TO stz_runtime;
GRANT SELECT,INSERT ON app_stz.web_access_audit TO stz_runtime;
GRANT USAGE ON SEQUENCE app_stz.web_access_audit_id_seq TO stz_runtime;
