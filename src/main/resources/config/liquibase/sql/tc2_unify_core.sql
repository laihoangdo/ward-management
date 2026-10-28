-- User confirmed all pre-existing public household/resident rows are mock.
-- Transactional migration: no CASCADE, no source/history rewrite, no invented personal data.
LOCK TABLE public.household, public.resident, tc2_roster.household, tc2_roster.resident IN ACCESS EXCLUSIVE MODE;
CREATE SCHEMA legacy_mock_20261027;
CREATE TABLE legacy_mock_20261027.household AS TABLE public.household;
CREATE TABLE legacy_mock_20261027.resident AS TABLE public.resident;
CREATE TABLE legacy_mock_20261027.building_household_link AS
 SELECT id,household_id FROM public.gis_building WHERE household_id IS NOT NULL;
COMMENT ON SCHEMA legacy_mock_20261027 IS 'Recovery archive only: user-confirmed mock; never an operational data source';
UPDATE public.gis_building SET household_id=NULL WHERE household_id IS NOT NULL;
DELETE FROM public.resident;
DELETE FROM public.household;

ALTER TABLE public.household
 ALTER id SET DEFAULT nextval('public.sequence_generator'),
 ALTER house_number DROP NOT NULL, ALTER street DROP NOT NULL,
 ALTER owner_name DROP NOT NULL, ALTER owner_phone DROP NOT NULL,
 ALTER type SET DEFAULT 'RESIDENTIAL', ALTER hamlet SET DEFAULT 'Trung Chánh 2',
 ADD roster_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 ADD source_case_number text, ADD case_scope text, ADD raw_address text NOT NULL DEFAULT '',
 ADD origin text NOT NULL DEFAULT 'MANUAL', ADD verification_status text NOT NULL DEFAULT 'UNVERIFIED',
 ADD coordinate_method text NOT NULL DEFAULT 'UNLOCATED', ADD coordinate_seed text, ADD boundary_hash text,
 ADD version bigint NOT NULL DEFAULT 0, ADD created_at timestamptz NOT NULL DEFAULT now(),
 ADD updated_at timestamptz NOT NULL DEFAULT now(), ADD UNIQUE(roster_id,hamlet_id),
 ADD CHECK(origin IN ('EXCEL','MANUAL')),
 ADD CHECK(coordinate_method IN ('UNLOCATED','RANDOM_WITHIN_TC2','VERIFIED')),
 ADD CHECK((latitude IS NULL)=(longitude IS NULL)),
 ADD CHECK(latitude BETWEEN -90 AND 90), ADD CHECK(longitude BETWEEN -180 AND 180);
CREATE UNIQUE INDEX ux_household_source_case ON public.household(hamlet_id,case_scope,source_case_number)
 WHERE source_case_number IS NOT NULL;
ALTER TABLE public.resident
 ALTER id SET DEFAULT nextval('public.sequence_generator'), ALTER residence_type SET DEFAULT 'UNVERIFIED',
 ADD roster_id uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
 ADD hamlet_id bigint NOT NULL REFERENCES public.hamlet(id), ADD birth_date date,
 ADD birth_date_precision text NOT NULL DEFAULT 'UNKNOWN', ADD father_name text, ADD mother_name text,
 ADD origin text NOT NULL DEFAULT 'MANUAL', ADD verification_status text NOT NULL DEFAULT 'UNVERIFIED',
 ADD version bigint NOT NULL DEFAULT 0, ADD created_at timestamptz NOT NULL DEFAULT now(),
 ADD updated_at timestamptz NOT NULL DEFAULT now(), ADD UNIQUE(roster_id,hamlet_id),
 ADD CHECK(origin IN ('EXCEL','MANUAL')), ADD CHECK(birth_year BETWEEN 1850 AND 2200),
 ADD CHECK(gender IS NULL OR gender IN ('MALE','FEMALE','OTHER')),
 ADD CHECK((birth_date_precision='DAY' AND birth_date IS NOT NULL AND birth_year=extract(year FROM birth_date)) OR
 (birth_date_precision='YEAR' AND birth_date IS NULL AND birth_year IS NOT NULL) OR
 (birth_date_precision='UNKNOWN' AND birth_date IS NULL AND birth_year IS NULL));

INSERT INTO public.household(roster_id,hamlet_id,code,source_case_number,case_scope,owner_name,owner_phone,raw_address,
 street,alley,origin,verification_status,longitude,latitude,coordinate_method,coordinate_seed,boundary_hash,
 version,created_at,updated_at,legacy_address)
SELECT id,hamlet_id,code,source_case_number,case_scope,representative_name,phone,raw_address,
 street,alley,origin,verification_status,longitude,latitude,coordinate_method,coordinate_seed,boundary_hash,
 version,created_at,updated_at,raw_address FROM tc2_roster.household;
INSERT INTO public.resident(roster_id,hamlet_id,full_name,birth_date,birth_year,birth_date_precision,gender,
 father_name,mother_name,origin,verification_status,version,created_at,updated_at)
SELECT id,hamlet_id,full_name,birth_date,birth_year,birth_date_precision,gender,
 father_name,mother_name,origin,verification_status,version,created_at,updated_at FROM tc2_roster.resident;

-- Retarget every FK (including review resolution and composite territory FKs).
DO $$ DECLARE c record; definition text; BEGIN
 FOR c IN SELECT conrelid::regclass child,conname,pg_get_constraintdef(oid) definition
 FROM pg_constraint WHERE contype='f' AND confrelid IN ('tc2_roster.household'::regclass,'tc2_roster.resident'::regclass)
 LOOP
  definition:=replace(replace(c.definition,
   'REFERENCES tc2_roster.household(id','REFERENCES public.household(roster_id'),
   'REFERENCES tc2_roster.resident(id','REFERENCES public.resident(roster_id');
  EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',c.child,c.conname);
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',c.child,c.conname,definition);
 END LOOP;
END $$;
DROP TABLE tc2_roster.household;
DROP TABLE tc2_roster.resident;

-- Simple automatically updatable views: compatibility API, NOT a second copy.
CREATE VIEW tc2_roster.household AS SELECT roster_id id,hamlet_id,code,source_case_number,case_scope,
 owner_name representative_name,owner_phone phone,raw_address,street,alley,origin,verification_status,
 longitude,latitude,coordinate_method,coordinate_seed,boundary_hash,version,created_at,updated_at FROM public.household;
CREATE VIEW tc2_roster.resident AS SELECT roster_id id,hamlet_id,full_name,birth_date,birth_year,birth_date_precision,
 gender,father_name,mother_name,origin,verification_status,version,created_at,updated_at FROM public.resident;

-- Preserve exactly the old UUID-shaped snapshots for continuous history/reporting.
CREATE FUNCTION tc2_roster.audit_core_entity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b jsonb; a jsonb; actor_name text; BEGIN
 actor_name:=nullif(current_setting('tc2.actor',true),'');
 IF actor_name IS NULL THEN RAISE EXCEPTION 'Use the audited roster workflow to write household/resident'; END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'End memberships/residence records; do not delete people or households'; END IF;
 IF TG_OP='UPDATE' AND (NEW.roster_id<>OLD.roster_id OR NEW.id<>OLD.id OR NEW.origin<>OLD.origin OR NEW.hamlet_id<>OLD.hamlet_id) THEN
  RAISE EXCEPTION 'Identity, origin and management scope are immutable'; END IF;
 IF TG_OP='UPDATE' THEN
  EXECUTE format('SELECT to_jsonb(x) FROM jsonb_populate_record(null::tc2_roster.%I,$1) x',TG_TABLE_NAME)
   INTO b USING to_jsonb(OLD)||jsonb_build_object('id',OLD.roster_id,'representative_name',to_jsonb(OLD)->'owner_name','phone',to_jsonb(OLD)->'owner_phone');
 END IF;
 EXECUTE format('SELECT to_jsonb(x) FROM jsonb_populate_record(null::tc2_roster.%I,$1) x',TG_TABLE_NAME)
  INTO a USING to_jsonb(NEW)||jsonb_build_object('id',NEW.roster_id,'representative_name',to_jsonb(NEW)->'owner_name','phone',to_jsonb(NEW)->'owner_phone');
 INSERT INTO tc2_roster.change_event(hamlet_id,entity_type,entity_id,operation,change_kind,actor,reason,effective_date,collection_id,before_data,after_data)
 VALUES(NEW.hamlet_id,TG_TABLE_NAME,NEW.roster_id,TG_OP,coalesce(nullif(current_setting('tc2.change_kind',true),''),'CORRECTION'),
 actor_name,coalesce(current_setting('tc2.reason',true),''),nullif(current_setting('tc2.effective_date',true),'')::date,
 nullif(current_setting('tc2.collection_id',true),'')::uuid,b,a);
 RETURN NEW;
END $$;
CREATE TRIGGER audit_core AFTER INSERT OR UPDATE OR DELETE ON public.household FOR EACH ROW EXECUTE FUNCTION tc2_roster.audit_core_entity();
CREATE TRIGGER audit_core AFTER INSERT OR UPDATE OR DELETE ON public.resident FOR EACH ROW EXECUTE FUNCTION tc2_roster.audit_core_entity();
COMMENT ON VIEW tc2_roster.household IS 'Updatable UUID projection of public.household; no duplicated storage';
COMMENT ON VIEW tc2_roster.resident IS 'Updatable UUID projection of public.resident; no duplicated storage';
COMMENT ON SCHEMA tc2_roster IS 'Import, membership, residence and immutable source/history; core data stored in public';
