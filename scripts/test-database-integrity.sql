-- Run ONLY against a restored rehearsal database. All test writes are rolled back.
\set ON_ERROR_STOP on
BEGIN;
DO $$ BEGIN
    IF current_database() NOT LIKE 'tc2_restore_%' THEN
        RAISE EXCEPTION 'Integrity tests require an isolated tc2_restore_ database';
    END IF;
END $$;

DO $$
DECLARE person_id bigint; house_id bigint; building text; original_feature text; rejected boolean;
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.gis_field_building b
        CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.feature_json::jsonb#>'{properties,householdIds}', '[]'::jsonb)) l(household_id)
        LEFT JOIN public.household h ON h.id::text=l.household_id WHERE h.id IS NULL
    ) THEN RAISE EXCEPTION 'Dangling feature links remain'; END IF;
    IF EXISTS (
        SELECT b.id,l.household_id::bigint FROM public.gis_field_building b
        CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.feature_json::jsonb#>'{properties,householdIds}', '[]'::jsonb)) l(household_id)
        EXCEPT SELECT building_id,household_id FROM public.gis_field_building_household
    ) OR EXISTS (
        SELECT building_id,household_id FROM public.gis_field_building_household
        EXCEPT SELECT b.id,l.household_id::bigint FROM public.gis_field_building b
        CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.feature_json::jsonb#>'{properties,householdIds}', '[]'::jsonb)) l(household_id)
    ) THEN RAISE EXCEPTION 'Feature / relational projection mismatch'; END IF;
    RAISE NOTICE 'PASS: zero dangling links and relational projection matches JSON';

    SELECT household_id,building_id INTO STRICT house_id,building FROM public.gis_field_building_household LIMIT 1;
    BEGIN
        INSERT INTO public.gis_field_building(id,feature_json) VALUES ('__integrity_duplicate__',
            jsonb_build_object('properties',jsonb_build_object('householdIds',jsonb_build_array(house_id::text)))::text);
        RAISE EXCEPTION 'Duplicate household link was accepted';
    EXCEPTION WHEN unique_violation THEN RAISE NOTICE 'PASS: household cannot link two buildings'; END;
    BEGIN
        INSERT INTO public.gis_field_building(id,feature_json) VALUES ('__integrity_orphan__',
            jsonb_build_object('properties',jsonb_build_object('householdIds',jsonb_build_array((SELECT max(id)+1 FROM household))))::text);
        RAISE EXCEPTION 'Orphan household link was accepted';
    EXCEPTION WHEN foreign_key_violation THEN RAISE NOTICE 'PASS: dangling feature link rejected by FK'; END;

    rejected:=false;
    BEGIN
        INSERT INTO public.gis_field_building(id,feature_json) VALUES ('__integrity_bad_array__','{"properties":{"householdIds":{}}}');
    EXCEPTION WHEN raise_exception THEN rejected:=true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Invalid householdIds type was accepted'; END IF;
    RAISE NOTICE 'PASS: invalid householdIds type rejected';

    SELECT feature_json INTO original_feature FROM public.gis_field_building WHERE id=building;
    UPDATE public.gis_field_building SET feature_json=jsonb_set(feature_json::jsonb,'{properties,householdIds}','[]'::jsonb)::text WHERE id=building;
    IF EXISTS(SELECT 1 FROM public.gis_field_building_household WHERE building_id=building) THEN
        RAISE EXCEPTION 'Unlink failed to refresh relational projection';
    END IF;
    UPDATE public.gis_field_building SET feature_json=original_feature WHERE id=building;
    IF NOT EXISTS(SELECT 1 FROM public.gis_field_building_household WHERE building_id=building AND household_id=house_id) THEN
        RAISE EXCEPTION 'Relink failed to refresh relational projection';
    END IF;
    RAISE NOTICE 'PASS: unlink/relink keeps projection synchronized';

    rejected:=false;
    BEGIN
        UPDATE database_repair.field_building_snapshot SET reason='should fail';
    EXCEPTION WHEN raise_exception THEN rejected:=true; END;
    IF NOT rejected THEN RAISE EXCEPTION 'Repair archive was writable'; END IF;
    RAISE NOTICE 'PASS: repair snapshots immutable';

    PERFORM set_config('tc2.actor','integrity-regression-test',true);
    SELECT id INTO STRICT person_id FROM public.resident WHERE birth_date_precision='DAY' LIMIT 1;
    BEGIN
        UPDATE public.resident SET birth_year=NULL WHERE id=person_id;
        RAISE EXCEPTION 'DAY birth date without year was accepted';
    EXCEPTION WHEN check_violation THEN RAISE NOTICE 'PASS: incomplete DAY precision rejected'; END;
END $$;
ROLLBACK;
