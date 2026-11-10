CREATE SCHEMA tc2_roster;
COMMENT ON SCHEMA tc2_roster IS 'Real roster, isolated from legacy public households/residents; source and history preserved';

CREATE TABLE tc2_roster.import_collection (
 id uuid PRIMARY KEY, hamlet_id bigint NOT NULL REFERENCES public.hamlet(id), label text NOT NULL,
 mapping_version text NOT NULL, source_date date, status text NOT NULL DEFAULT 'STAGED',
 created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), applied_at timestamptz,
 UNIQUE(id,hamlet_id), CHECK(status IN ('STAGED','APPLIED'))
);
CREATE TABLE tc2_roster.import_batch (
 id uuid PRIMARY KEY, collection_id uuid NOT NULL REFERENCES tc2_roster.import_collection(id),
 file_name text NOT NULL, file_sha256 char(64) NOT NULL, legacy_hamlet text NOT NULL,
 source_extent text NOT NULL, UNIQUE(collection_id,file_sha256)
);
CREATE TABLE tc2_roster.import_row (
 id uuid PRIMARY KEY, batch_id uuid NOT NULL REFERENCES tc2_roster.import_batch(id), sheet text NOT NULL,
 row_number integer NOT NULL CHECK(row_number>0), raw_ciphertext text NOT NULL, parsed_ciphertext text NOT NULL,
 row_kind text NOT NULL, status text NOT NULL, errors jsonb NOT NULL DEFAULT '[]',
 identity_lookup text, resident_id uuid, household_id uuid, record_id uuid,
 decision text, reviewed_by text, reviewed_at timestamptz,
 UNIQUE(batch_id,sheet,row_number), CHECK(status IN ('READY','REVIEW','EXCLUDED','APPLIED'))
);
CREATE TABLE tc2_roster.household (
 id uuid PRIMARY KEY, hamlet_id bigint NOT NULL REFERENCES public.hamlet(id), code text NOT NULL UNIQUE,
 source_case_number text, case_scope text, representative_name text, phone text, raw_address text NOT NULL,
 street text, alley text, origin text NOT NULL, verification_status text NOT NULL DEFAULT 'UNVERIFIED',
 longitude double precision, latitude double precision, coordinate_method text NOT NULL DEFAULT 'UNLOCATED',
 coordinate_seed text, boundary_hash text, version bigint NOT NULL DEFAULT 0,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,hamlet_id), CHECK(coordinate_method IN ('UNLOCATED','RANDOM_WITHIN_TC2','VERIFIED')),
 CHECK((latitude IS NULL)=(longitude IS NULL)), CHECK(latitude BETWEEN -90 AND 90), CHECK(longitude BETWEEN -180 AND 180)
);
CREATE UNIQUE INDEX ux_tc2_household_case ON tc2_roster.household(hamlet_id,case_scope,source_case_number) WHERE source_case_number IS NOT NULL;
CREATE TABLE tc2_roster.resident (
 id uuid PRIMARY KEY, hamlet_id bigint NOT NULL REFERENCES public.hamlet(id), full_name text NOT NULL CHECK(length(trim(full_name))>0),
 birth_date date, birth_year integer, birth_date_precision text NOT NULL DEFAULT 'UNKNOWN', gender text,
 father_name text, mother_name text, origin text NOT NULL, verification_status text NOT NULL DEFAULT 'UNVERIFIED',
 version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,hamlet_id), CHECK(birth_year BETWEEN 1850 AND 2200),
 CHECK(gender IS NULL OR gender IN ('MALE','FEMALE','OTHER')),
 CHECK((birth_date_precision='DAY' AND birth_date IS NOT NULL AND birth_year=extract(year from birth_date)) OR
 (birth_date_precision='YEAR' AND birth_date IS NULL AND birth_year IS NOT NULL) OR
 (birth_date_precision='UNKNOWN' AND birth_date IS NULL AND birth_year IS NULL))
);
CREATE TABLE tc2_roster.resident_identity (
 id uuid PRIMARY KEY, resident_id uuid NOT NULL REFERENCES tc2_roster.resident(id), document_type text NOT NULL DEFAULT 'SOURCE_UNCONFIRMED',
 number_ciphertext text NOT NULL, number_lookup text NOT NULL, verified boolean NOT NULL DEFAULT false,
 source_row_id uuid REFERENCES tc2_roster.import_row(id), UNIQUE(resident_id,number_lookup)
);
CREATE UNIQUE INDEX ux_tc2_verified_identity ON tc2_roster.resident_identity(document_type,number_lookup) WHERE verified;
CREATE INDEX ix_tc2_identity_lookup ON tc2_roster.resident_identity(number_lookup);
CREATE TABLE tc2_roster.household_membership (
 id uuid PRIMARY KEY, hamlet_id bigint NOT NULL, household_id uuid NOT NULL, resident_id uuid NOT NULL,
 relationship_code text, is_head boolean NOT NULL DEFAULT false, valid_from date, valid_to date,
 source_row_id uuid REFERENCES tc2_roster.import_row(id), version bigint NOT NULL DEFAULT 0,
 FOREIGN KEY(household_id,hamlet_id) REFERENCES tc2_roster.household(id,hamlet_id),
 FOREIGN KEY(resident_id,hamlet_id) REFERENCES tc2_roster.resident(id,hamlet_id),
 CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from)
);
CREATE UNIQUE INDEX ux_tc2_current_member ON tc2_roster.household_membership(household_id,resident_id) WHERE valid_to IS NULL;
CREATE UNIQUE INDEX ux_tc2_current_head ON tc2_roster.household_membership(household_id) WHERE is_head AND valid_to IS NULL;
CREATE TABLE tc2_roster.residence_address (
 id uuid PRIMARY KEY, raw_address text NOT NULL, hamlet_id bigint REFERENCES public.hamlet(id), normalization_status text NOT NULL DEFAULT 'RAW'
);
CREATE TABLE tc2_roster.residence_record (
 id uuid PRIMARY KEY, hamlet_id bigint NOT NULL, resident_id uuid NOT NULL, household_id uuid,
 record_kind text NOT NULL, registration_date date, valid_from date, valid_to date,
 source_status text, source_residence_time_raw text, representative_name_raw text,
 classification_raw text, housing_classification_raw text, registration_form text,
 verification_status text NOT NULL DEFAULT 'UNVERIFIED', source_row_id uuid REFERENCES tc2_roster.import_row(id),
 version bigint NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,resident_id), FOREIGN KEY(resident_id,hamlet_id) REFERENCES tc2_roster.resident(id,hamlet_id),
 FOREIGN KEY(household_id,hamlet_id) REFERENCES tc2_roster.household(id,hamlet_id),
 CHECK(record_kind IN ('PERMANENT','TEMPORARY','NOHT','ARTICLE19')), CHECK(valid_to IS NULL OR valid_from IS NULL OR valid_to>=valid_from)
);
CREATE TABLE tc2_roster.residence_record_address (
 record_id uuid NOT NULL REFERENCES tc2_roster.residence_record(id), address_id uuid NOT NULL REFERENCES tc2_roster.residence_address(id),
 address_role text NOT NULL, PRIMARY KEY(record_id,address_id,address_role)
);
CREATE TABLE tc2_roster.residence_verification (
 id uuid PRIMARY KEY, resident_id uuid NOT NULL REFERENCES tc2_roster.resident(id), record_id uuid,
 presence_status text NOT NULL CHECK(presence_status IN ('PRESENT','ABSENT','UNKNOWN')),
 observed_at date, verified_by text, method text NOT NULL, source_row_id uuid REFERENCES tc2_roster.import_row(id),
 recorded_at timestamptz NOT NULL DEFAULT now(), FOREIGN KEY(record_id,resident_id) REFERENCES tc2_roster.residence_record(id,resident_id)
);
ALTER TABLE tc2_roster.import_row ADD FOREIGN KEY(resident_id) REFERENCES tc2_roster.resident(id),
 ADD FOREIGN KEY(household_id) REFERENCES tc2_roster.household(id), ADD FOREIGN KEY(record_id) REFERENCES tc2_roster.residence_record(id);
CREATE TABLE tc2_roster.source_link (
 source_row_id uuid PRIMARY KEY REFERENCES tc2_roster.import_row(id), resident_id uuid NOT NULL REFERENCES tc2_roster.resident(id),
 household_id uuid REFERENCES tc2_roster.household(id), record_id uuid NOT NULL REFERENCES tc2_roster.residence_record(id)
);
CREATE TABLE tc2_roster.change_event (
 id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, hamlet_id bigint NOT NULL REFERENCES public.hamlet(id),
 entity_type text NOT NULL, entity_id uuid NOT NULL, operation text NOT NULL,
 change_kind text NOT NULL, actor text NOT NULL, reason text NOT NULL, effective_date date,
 collection_id uuid REFERENCES tc2_roster.import_collection(id), recorded_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 before_data jsonb, after_data jsonb
);
CREATE INDEX ix_tc2_event_period ON tc2_roster.change_event(hamlet_id,recorded_at,id);
CREATE INDEX ix_tc2_event_entity ON tc2_roster.change_event(entity_type,entity_id,id);
CREATE INDEX ix_tc2_record_resident ON tc2_roster.residence_record(resident_id);
CREATE INDEX ix_tc2_member_household ON tc2_roster.household_membership(household_id);
CREATE INDEX ix_tc2_row_status ON tc2_roster.import_row(batch_id,status);

CREATE FUNCTION tc2_roster.protect_source() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' OR NEW.raw_ciphertext IS DISTINCT FROM OLD.raw_ciphertext OR NEW.parsed_ciphertext IS DISTINCT FROM OLD.parsed_ciphertext
 OR NEW.batch_id IS DISTINCT FROM OLD.batch_id OR NEW.sheet IS DISTINCT FROM OLD.sheet OR NEW.row_number IS DISTINCT FROM OLD.row_number THEN
 RAISE EXCEPTION 'Original source is immutable'; END IF; RETURN NEW;
END $$;
CREATE TRIGGER immutable_import_source BEFORE UPDATE OR DELETE ON tc2_roster.import_row FOR EACH ROW EXECUTE FUNCTION tc2_roster.protect_source();
CREATE FUNCTION tc2_roster.immutable_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'History is append-only; use a compensating change'; END $$;
CREATE TRIGGER immutable_history BEFORE UPDATE OR DELETE ON tc2_roster.change_event FOR EACH ROW EXECUTE FUNCTION tc2_roster.immutable_event();
CREATE FUNCTION tc2_roster.audit_entity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b jsonb; a jsonb; d jsonb; h bigint; actor_name text;
BEGIN
 actor_name:=nullif(current_setting('tc2.actor',true),'');
 IF actor_name IS NULL THEN RAISE EXCEPTION 'TC2 write requires an audit actor'; END IF;
 IF TG_OP<>'INSERT' THEN b:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN a:=to_jsonb(NEW); END IF;
 d:=coalesce(a,b); h:=(d->>'hamlet_id')::bigint;
 IF h IS NULL AND d ? 'resident_id' THEN SELECT hamlet_id INTO h FROM tc2_roster.resident WHERE id=(d->>'resident_id')::uuid; END IF;
 IF h IS NULL AND d ? 'record_id' THEN SELECT hamlet_id INTO h FROM tc2_roster.residence_record WHERE id=(d->>'record_id')::uuid; END IF;
 INSERT INTO tc2_roster.change_event(hamlet_id,entity_type,entity_id,operation,change_kind,actor,reason,effective_date,collection_id,before_data,after_data)
 VALUES(h,TG_TABLE_NAME,coalesce(d->>'id',d->>'record_id')::uuid,TG_OP,
 coalesce(nullif(current_setting('tc2.change_kind',true),''),'CORRECTION'),actor_name,
 coalesce(current_setting('tc2.reason',true),''),nullif(current_setting('tc2.effective_date',true),'')::date,
 nullif(current_setting('tc2.collection_id',true),'')::uuid,b,a);
 RETURN coalesce(NEW,OLD);
END $$;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['household','resident','resident_identity','household_membership','residence_record','residence_verification','residence_record_address'] LOOP
 EXECUTE format('CREATE TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON tc2_roster.%I FOR EACH ROW EXECUTE FUNCTION tc2_roster.audit_entity()',t);
 END LOOP;
END $$;
