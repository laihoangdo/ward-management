-- Transactional repair: preserve original features, remove ONLY confirmed archived mock links.
-- Never infer a replacement household from an address, owner name or random coordinate.
LOCK TABLE public.gis_field_building IN SHARE ROW EXCLUSIVE MODE;

CREATE SCHEMA database_repair;
REVOKE ALL ON SCHEMA database_repair FROM PUBLIC;
CREATE TABLE database_repair.field_building_snapshot (
    building_id varchar(120) PRIMARY KEY,
    feature_json text NOT NULL,
    migration_id text NOT NULL DEFAULT '20261028000000-1',
    reason text NOT NULL DEFAULT 'Remove links to user-confirmed archived mock households',
    captured_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE database_repair.integrity_summary (
    migration_id text PRIMARY KEY,
    affected_buildings bigint NOT NULL,
    removed_mock_links bigint NOT NULL,
    applied_at timestamptz NOT NULL DEFAULT clock_timestamp()
);

-- Unknown dangling IDs need human review; do not silently discard them.
DO $$ BEGIN
    IF EXISTS (
        SELECT 1 FROM public.gis_field_building b
        CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.feature_json::jsonb#>'{properties,householdIds}', '[]'::jsonb)) l(household_id)
        LEFT JOIN public.household h ON h.id::text=l.household_id
        LEFT JOIN legacy_mock_20261027.household old ON old.id::text=l.household_id
        WHERE h.id IS NULL AND old.id IS NULL
    ) THEN RAISE EXCEPTION 'Unknown dangling building links: review before migrating'; END IF;
END $$;

INSERT INTO database_repair.field_building_snapshot(building_id,feature_json)
SELECT b.id,b.feature_json FROM public.gis_field_building b WHERE EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(coalesce(b.feature_json::jsonb#>'{properties,householdIds}', '[]'::jsonb)) l(household_id)
    JOIN legacy_mock_20261027.household old ON old.id::text=l.household_id
    WHERE NOT EXISTS (SELECT 1 FROM public.household h WHERE h.id::text=l.household_id)
);
INSERT INTO database_repair.integrity_summary(migration_id,affected_buildings,removed_mock_links)
SELECT '20261028000000-1', (SELECT count(*) FROM database_repair.field_building_snapshot), count(*)
FROM database_repair.field_building_snapshot b
CROSS JOIN LATERAL jsonb_array_elements_text(b.feature_json::jsonb#>'{properties,householdIds}') l(household_id)
WHERE NOT EXISTS (SELECT 1 FROM public.household h WHERE h.id::text=l.household_id);

UPDATE public.gis_field_building b SET feature_json=jsonb_set(b.feature_json::jsonb, '{properties,householdIds}', (
    SELECT coalesce(jsonb_agg(l.value ORDER BY l.ordinality), '[]'::jsonb)
    FROM jsonb_array_elements(b.feature_json::jsonb#>'{properties,householdIds}') WITH ORDINALITY l(value,ordinality)
    WHERE EXISTS (SELECT 1 FROM public.household h WHERE h.id::text=l.value#>>'{}')
))::text WHERE EXISTS (SELECT 1 FROM database_repair.field_building_snapshot s WHERE s.building_id=b.id);

CREATE TRIGGER immutable_snapshot BEFORE UPDATE OR DELETE ON database_repair.field_building_snapshot
FOR EACH ROW EXECUTE FUNCTION tc2_roster.immutable_event();
CREATE TRIGGER immutable_snapshot_truncate BEFORE TRUNCATE ON database_repair.field_building_snapshot
FOR EACH STATEMENT EXECUTE FUNCTION tc2_roster.immutable_event();
CREATE TRIGGER immutable_summary BEFORE UPDATE OR DELETE ON database_repair.integrity_summary
FOR EACH ROW EXECUTE FUNCTION tc2_roster.immutable_event();

-- Relational projection of the existing API payload: FK + uniqueness hold for direct SQL too.
CREATE TABLE public.gis_field_building_household (
    building_id varchar(120) NOT NULL REFERENCES public.gis_field_building(id) ON DELETE CASCADE,
    household_id bigint NOT NULL REFERENCES public.household(id),
    PRIMARY KEY(building_id,household_id),
    CONSTRAINT ux_field_household_single_building UNIQUE(household_id)
);
CREATE FUNCTION public.sync_field_building_households() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE links jsonb; link jsonb; identifier text;
BEGIN
    IF NEW.feature_json IS NOT JSON OBJECT THEN
        RAISE EXCEPTION 'Building feature must be a JSON object';
    END IF;
    links:=NEW.feature_json::jsonb#>'{properties,householdIds}';
    IF links IS NULL THEN links:='[]'::jsonb; END IF;
    IF jsonb_typeof(links)<>'array' THEN RAISE EXCEPTION 'householdIds must be an array'; END IF;
    DELETE FROM public.gis_field_building_household WHERE building_id=NEW.id;
    FOR link IN SELECT value FROM jsonb_array_elements(links) LOOP
        identifier:=link#>>'{}';
        IF jsonb_typeof(link) NOT IN ('string','number') OR identifier IS NULL OR identifier !~ '^[0-9]+$' THEN
            RAISE EXCEPTION 'Invalid household ID in building feature';
        END IF;
        INSERT INTO public.gis_field_building_household(building_id,household_id) VALUES (NEW.id,identifier::bigint);
    END LOOP;
    RETURN NEW;
END $$;
CREATE TRIGGER sync_household_links AFTER INSERT OR UPDATE OF feature_json ON public.gis_field_building
FOR EACH ROW EXECUTE FUNCTION public.sync_field_building_households();
INSERT INTO public.gis_field_building_household(building_id,household_id)
SELECT b.id,l.household_id::bigint FROM public.gis_field_building b
CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(b.feature_json::jsonb#>'{properties,householdIds}', '[]'::jsonb)) l(household_id);
COMMENT ON TABLE public.gis_field_building_household IS 'FK-checked projection maintained by gis_field_building trigger; write features through the authorized API';

-- Fail closed on NULL: ordinary CHECK expressions accept UNKNOWN, not just TRUE.
ALTER TABLE public.household ALTER COLUMN hamlet_id SET NOT NULL;
ALTER TABLE public.resident ADD CONSTRAINT ck_resident_birth_precision_strict CHECK ((
    (birth_date_precision='DAY' AND birth_date IS NOT NULL AND birth_year IS NOT NULL AND birth_year=extract(year FROM birth_date)) OR
    (birth_date_precision='YEAR' AND birth_date IS NULL AND birth_year IS NOT NULL) OR
    (birth_date_precision='UNKNOWN' AND birth_date IS NULL AND birth_year IS NULL)
) IS TRUE);

CREATE INDEX ix_tc2_member_resident_period ON tc2_roster.household_membership(resident_id,valid_to);
CREATE INDEX ix_tc2_record_household_kind_period ON tc2_roster.residence_record(household_id,record_kind,valid_to);
CREATE INDEX ix_resident_hamlet_id ON public.resident(hamlet_id,id);
