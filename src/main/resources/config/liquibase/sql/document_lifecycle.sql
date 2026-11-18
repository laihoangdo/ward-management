-- Additive: legacy dates/names/status remain source text. No matching or date guessing.
ALTER TABLE public.document_record
    ADD household_id bigint REFERENCES public.household(id),
    ADD expiry_on date,
    ADD issued_on date,
    ADD document_number varchar(255),
    ADD issuing_authority varchar(255),
    ADD verified_by text,
    ADD verified_at timestamptz,
    ADD version bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT ck_document_dates CHECK (issued_on IS NULL OR expiry_on IS NULL OR issued_on<=expiry_on),
    ADD CONSTRAINT ck_document_verified CHECK (
        (expiry_on IS NULL AND verified_at IS NULL AND verified_by IS NULL) OR
        (expiry_on IS NOT NULL AND household_id IS NOT NULL AND verified_at IS NOT NULL AND nullif(btrim(verified_by),'') IS NOT NULL)
    );
CREATE INDEX ix_document_household_expiry ON public.document_record(household_id,expiry_on);
CREATE TABLE public.document_record_history (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    document_id bigint NOT NULL REFERENCES public.document_record(id),
    operation text NOT NULL CHECK (operation IN ('REGISTER','CONFIRM','RENEW')),
    actor text NOT NULL CHECK (btrim(actor)<>''),
    reason text NOT NULL CHECK (btrim(reason)<>''),
    request_id uuid NOT NULL UNIQUE,
    request_hash text NOT NULL,
    before_data jsonb,
    after_data jsonb NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX ix_document_history_document ON public.document_record_history(document_id,id DESC);
CREATE TRIGGER immutable_document_history BEFORE UPDATE OR DELETE ON public.document_record_history
    FOR EACH ROW EXECUTE FUNCTION tc2_roster.immutable_event();
CREATE TRIGGER immutable_document_history_truncate BEFORE TRUNCATE ON public.document_record_history
    FOR EACH STATEMENT EXECUTE FUNCTION tc2_roster.immutable_event();

CREATE FUNCTION public.audit_document_lifecycle() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor_name text; why text; op text; snapshot jsonb;
BEGIN
    IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Do not delete document history; use an audited lifecycle workflow'; END IF;
    actor_name:=nullif(btrim(current_setting('documents.actor',true)),'');
    why:=nullif(btrim(current_setting('documents.reason',true)),'');
    op:=current_setting('documents.operation',true);
    IF actor_name IS NULL OR why IS NULL OR op IS NULL OR op NOT IN ('REGISTER','CONFIRM','RENEW')
       OR nullif(current_setting('documents.request_id',true),'') IS NULL
       OR nullif(current_setting('documents.request_hash',true),'') IS NULL THEN
        RAISE EXCEPTION 'Use the audited document workflow with actor, reason and request ID';
    END IF;
    IF NEW.expiry_on IS NULL OR NEW.household_id IS NULL OR NEW.verified_by IS DISTINCT FROM actor_name THEN
        RAISE EXCEPTION 'A confirmed date and explicitly selected household are required';
    END IF;
    IF TG_OP='INSERT' THEN
        IF op<>'REGISTER' OR NEW.version<>0 THEN RAISE EXCEPTION 'Invalid document registration'; END IF;
    ELSE
        snapshot:=to_jsonb(OLD);
        IF NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'Document version must increment once'; END IF;
        IF (to_jsonb(NEW)-ARRAY['household_id','expiry_on','issued_on','document_number','issuing_authority','verified_by','verified_at','version'])
           IS DISTINCT FROM (snapshot-ARRAY['household_id','expiry_on','issued_on','document_number','issuing_authority','verified_by','verified_at','version']) THEN
            RAISE EXCEPTION 'Original document source fields are immutable';
        END IF;
        IF OLD.household_id IS NOT NULL AND NEW.household_id IS DISTINCT FROM OLD.household_id THEN
            RAISE EXCEPTION 'A linked document cannot be reassigned to another household';
        END IF;
        IF OLD.expiry_on IS NULL THEN
            IF op<>'CONFIRM' THEN RAISE EXCEPTION 'Confirm the source document before renewal'; END IF;
        ELSIF op<>'RENEW' OR NEW.expiry_on<=OLD.expiry_on OR NEW.expiry_on<(clock_timestamp() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
            RAISE EXCEPTION 'Renewal must extend expiry and cannot expire before today';
        END IF;
    END IF;
    INSERT INTO public.document_record_history(document_id,operation,actor,reason,request_id,request_hash,before_data,after_data)
    VALUES(NEW.id,op,actor_name,why,current_setting('documents.request_id')::uuid,current_setting('documents.request_hash'),snapshot,to_jsonb(NEW));
    RETURN NEW;
END $$;
CREATE TRIGGER audit_document_lifecycle AFTER INSERT OR UPDATE OR DELETE ON public.document_record
    FOR EACH ROW EXECUTE FUNCTION public.audit_document_lifecycle();
DO $$ BEGIN
    IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='police_runtime') THEN
        GRANT SELECT,INSERT ON public.document_record_history TO police_runtime;
        GRANT USAGE,SELECT ON SEQUENCE public.document_record_history_id_seq TO police_runtime;
    END IF;
END $$;
