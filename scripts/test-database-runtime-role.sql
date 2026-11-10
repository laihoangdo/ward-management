-- Append to the role provisioning script instead of its COMMIT during rehearsal.
-- Never commit fixture writes: caller must wrap provisioning and these checks in one transaction.
SET LOCAL ROLE police_runtime;
DO $$ BEGIN
    IF current_database() NOT LIKE 'tc2_restore_%' THEN RAISE EXCEPTION 'Rehearsal DB required'; END IF;
    IF (SELECT rolsuper OR rolcreatedb OR rolcreaterole OR rolbypassrls FROM pg_roles WHERE rolname=current_user) THEN
        RAISE EXCEPTION 'Runtime role has administrative privileges';
    END IF;
    IF has_schema_privilege(current_user,'public','CREATE') OR has_schema_privilege(current_user,'tc2_roster','CREATE') THEN
        RAISE EXCEPTION 'Runtime role can create application objects';
    END IF;
    IF has_schema_privilege(current_user,'database_repair','USAGE') OR has_schema_privilege(current_user,'legacy_mock_20261027','USAGE') THEN
        RAISE EXCEPTION 'Runtime role can access private archives';
    END IF;
    IF has_table_privilege(current_user,'public.databasechangelog','UPDATE') OR
       has_table_privilege(current_user,'tc2_roster.change_event','DELETE') OR
       has_table_privilege(current_user,'tc2_roster.change_event','UPDATE') THEN
        RAISE EXCEPTION 'Runtime role can modify migration/history records';
    END IF;
    PERFORM set_config('tc2.actor','runtime-role-test',true);
    UPDATE public.resident SET version=version WHERE id=(SELECT min(id) FROM public.resident);
    UPDATE public.gis_field_building SET feature_json=feature_json WHERE id=(SELECT min(id) FROM public.gis_field_building);
    PERFORM count(*) FROM tc2_roster.resident_identity;
    PERFORM count(*) FROM tc2_roster.household;
    RAISE NOTICE 'PASS: runtime CRUD/trigger access works without DDL, archive or history mutation privileges';
END $$;
RESET ROLE;
ROLLBACK;
