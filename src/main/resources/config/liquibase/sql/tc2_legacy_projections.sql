CREATE OR REPLACE FUNCTION tc2_roster.audit_core_entity() RETURNS trigger LANGUAGE plpgsql AS $$
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
 IF b IS NOT DISTINCT FROM a THEN RETURN NEW; END IF;
 INSERT INTO tc2_roster.change_event(hamlet_id,entity_type,entity_id,operation,change_kind,actor,reason,effective_date,collection_id,before_data,after_data)
 VALUES(NEW.hamlet_id,TG_TABLE_NAME,NEW.roster_id,TG_OP,coalesce(nullif(current_setting('tc2.change_kind',true),''),'CORRECTION'),
 actor_name,coalesce(current_setting('tc2.reason',true),''),nullif(current_setting('tc2.effective_date',true),'')::date,
 nullif(current_setting('tc2.collection_id',true),'')::uuid,b,a);
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION tc2_roster.refresh_legacy_person(person uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE public.resident r SET household_id=(SELECT CASE WHEN count(*)=1 THEN min(h.id) END
 FROM tc2_roster.household_membership m JOIN public.household h ON h.roster_id=m.household_id
 WHERE m.resident_id=person AND m.valid_to IS NULL),
 relationship=(SELECT CASE WHEN count(*)=1 THEN min(m.relationship_code) END
 FROM tc2_roster.household_membership m WHERE m.resident_id=person AND m.valid_to IS NULL),
 residence_type=(SELECT CASE WHEN count(DISTINCT record_kind)=1 AND min(record_kind) IN ('PERMANENT','TEMPORARY')
 THEN min(record_kind) ELSE 'UNVERIFIED' END FROM tc2_roster.residence_record rr
 WHERE rr.resident_id=person AND (rr.valid_to IS NULL OR rr.valid_to>=current_date))
 WHERE r.roster_id=person;
END $$;
CREATE OR REPLACE FUNCTION tc2_roster.refresh_legacy_household(house uuid) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 UPDATE public.household h SET residents_count=c.total,male_count=c.males,female_count=c.females,
 under_18_count=NULL,above_18_count=NULL FROM (
 SELECT count(*)::integer total,count(*) FILTER(WHERE r.gender='MALE')::integer males,
 count(*) FILTER(WHERE r.gender='FEMALE')::integer females
 FROM tc2_roster.household_membership m JOIN public.resident r ON r.roster_id=m.resident_id
 WHERE m.household_id=house AND m.valid_to IS NULL) c WHERE h.roster_id=house;
END $$;
CREATE OR REPLACE FUNCTION tc2_roster.refresh_legacy_links() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP<>'INSERT' THEN
  PERFORM tc2_roster.refresh_legacy_person(OLD.resident_id);
  IF TG_TABLE_NAME='household_membership' THEN PERFORM tc2_roster.refresh_legacy_household(OLD.household_id); END IF;
 END IF;
 IF TG_OP<>'DELETE' THEN
  PERFORM tc2_roster.refresh_legacy_person(NEW.resident_id);
  IF TG_TABLE_NAME='household_membership' THEN PERFORM tc2_roster.refresh_legacy_household(NEW.household_id); END IF;
 END IF;
 RETURN coalesce(NEW,OLD);
END $$;
CREATE OR REPLACE TRIGGER refresh_legacy AFTER INSERT OR UPDATE OR DELETE ON tc2_roster.household_membership
 FOR EACH ROW EXECUTE FUNCTION tc2_roster.refresh_legacy_links();
CREATE OR REPLACE TRIGGER refresh_legacy AFTER INSERT OR UPDATE OR DELETE ON tc2_roster.residence_record
 FOR EACH ROW EXECUTE FUNCTION tc2_roster.refresh_legacy_links();
CREATE OR REPLACE FUNCTION tc2_roster.sync_legacy_address() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.legacy_address:=NEW.raw_address;
 SELECT full_name INTO NEW.hamlet FROM public.hamlet WHERE id=NEW.hamlet_id;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER sync_legacy BEFORE INSERT OR UPDATE ON public.household FOR EACH ROW EXECUTE FUNCTION tc2_roster.sync_legacy_address();
CREATE OR REPLACE FUNCTION tc2_roster.refresh_legacy_gender() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE x record; BEGIN
 FOR x IN SELECT household_id FROM tc2_roster.household_membership WHERE resident_id=NEW.roster_id AND valid_to IS NULL
 LOOP PERFORM tc2_roster.refresh_legacy_household(x.household_id); END LOOP;
 RETURN NEW;
END $$;
CREATE OR REPLACE TRIGGER refresh_gender AFTER UPDATE OF gender ON public.resident FOR EACH ROW
 WHEN(OLD.gender IS DISTINCT FROM NEW.gender) EXECUTE FUNCTION tc2_roster.refresh_legacy_gender();
CREATE OR REPLACE TRIGGER preserve_mock_archive BEFORE UPDATE OR DELETE ON legacy_mock_20261027.household FOR EACH ROW EXECUTE FUNCTION tc2_roster.immutable_event();
CREATE OR REPLACE TRIGGER preserve_mock_archive BEFORE UPDATE OR DELETE ON legacy_mock_20261027.resident FOR EACH ROW EXECUTE FUNCTION tc2_roster.immutable_event();
DO $$ DECLARE x record; BEGIN
 PERFORM set_config('tc2.actor','database-migration',true);
 FOR x IN SELECT roster_id FROM public.resident LOOP PERFORM tc2_roster.refresh_legacy_person(x.roster_id); END LOOP;
 FOR x IN SELECT roster_id FROM public.household LOOP PERFORM tc2_roster.refresh_legacy_household(x.roster_id); END LOOP;
END $$;
