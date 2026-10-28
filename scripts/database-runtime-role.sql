-- Provision with a migration/admin connection; never use the runtime role for DDL.
-- psql variable runtime_password must be supplied over stdin, not command-line arguments.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='police_runtime') THEN
        RAISE EXCEPTION 'police_runtime already exists; rotate/review explicitly, do not overwrite its credentials';
    END IF;
END $$;
CREATE ROLE police_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD :'runtime_password';
SELECT format('GRANT CONNECT ON DATABASE %I TO police_runtime',current_database()) \gexec
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public,tc2_roster TO police_runtime;
SELECT format('GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE %I.%I TO police_runtime',schemaname,tablename)
FROM pg_tables WHERE schemaname IN ('public','tc2_roster')
AND tablename NOT IN ('databasechangelog','databasechangeloglock','change_event','review_event','rbac_audit','document_record_history','spatial_ref_sys') \gexec
GRANT SELECT,INSERT,UPDATE,DELETE ON tc2_roster.household,tc2_roster.resident TO police_runtime;
GRANT SELECT ON public.v_household_address TO police_runtime;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA public,tc2_roster TO police_runtime;
GRANT SELECT,INSERT ON tc2_roster.change_event,tc2_roster.review_event,public.rbac_audit TO police_runtime;
SELECT format('GRANT SELECT,INSERT ON TABLE %I.%I TO police_runtime',schemaname,tablename)
FROM pg_tables WHERE schemaname='public' AND tablename='document_record_history' \gexec
SELECT format('GRANT SELECT ON TABLE %I.%I TO police_runtime',schemaname,tablename)
FROM pg_tables WHERE schemaname='public' AND tablename='spatial_ref_sys' \gexec
-- No access to database_repair or legacy_mock_20261027; no ownership or migration-table grants.
COMMIT;
