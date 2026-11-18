-- Undo one run of tc2-old-hamlet-addresses.sql, from database_repair.tc2_old_hamlet_address_fix.
-- Restores the old text only where the address still holds the text that run wrote: an address edited by an officer
-- afterwards is kept and listed. Household restores go through the audit trigger like the original change.
--
--   psql -X -v ON_ERROR_STOP=1 -d Monolithic -v run_id=<uuid> -v actor='Họ tên' -f scripts/data-fix/tc2-old-hamlet-addresses-rollback.sql
--   default: dry run (ROLLBACK) · -v apply=1 -v rehearse=1: write + check, then ROLLBACK · -v apply=1: COMMIT

\set ON_ERROR_STOP on
\if :{?run_id}
\else
  \echo 'Thiếu tham số: -v run_id=<run_id in ra khi áp dụng>'
  \quit
\endif
\if :{?actor}
\else
  \echo 'Thiếu tham số: -v actor=''Họ tên người chạy'''
  \quit
\endif
\if :{?apply}
\else
  \set apply 0
\endif
\if :{?rehearse}
\else
  \set rehearse 0
\endif

BEGIN;
SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '10min';

CREATE TEMP TABLE tc2_undo ON COMMIT DROP AS
SELECT b.kind, b.record_id, b.old_address, b.new_address,
       coalesce(h.raw_address, a.raw_address) AS current_address
  FROM database_repair.tc2_old_hamlet_address_fix b
  LEFT JOIN public.household h ON b.kind = 'household' AND h.roster_id::text = b.record_id
  LEFT JOIN tc2_roster.residence_address a ON b.kind = 'residence_address' AND a.id::text = b.record_id
 WHERE b.run_id = :'run_id';

\echo '=== Lần chạy cần hoàn tác ==='
SELECT kind AS "loại", count(*) AS "tổng",
       count(*) FILTER (WHERE current_address = new_address) AS "sẽ khôi phục",
       count(*) FILTER (WHERE current_address IS DISTINCT FROM new_address) AS "đã bị sửa sau đó, giữ nguyên"
  FROM tc2_undo GROUP BY kind ORDER BY kind;
DO $chk$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tc2_undo) THEN RAISE EXCEPTION 'Không có bản ghi nào cho run_id này.'; END IF;
END
$chk$;

\if :apply
  SELECT set_config('tc2.actor', :'actor', true),
         set_config('tc2.change_kind', 'CORRECTION', true),
         set_config('tc2.reason', 'Hoàn tác cập nhật tên ấp Trung Chánh 2, run_id ' || :'run_id', true),
         set_config('tc2.effective_date', '', true),
         set_config('tc2.collection_id', '', true);
  UPDATE public.household h
     SET raw_address = u.old_address, version = h.version + 1, updated_at = now()
    FROM tc2_undo u
   WHERE u.kind = 'household' AND h.roster_id::text = u.record_id AND h.raw_address = u.new_address;
  UPDATE tc2_roster.residence_address a
     SET raw_address = u.old_address
    FROM tc2_undo u
   WHERE u.kind = 'residence_address' AND a.id::text = u.record_id AND a.raw_address = u.new_address;
  -- Mark the run as undone so it cannot be restored twice by mistake.
  DELETE FROM database_repair.tc2_old_hamlet_address_fix b
   USING tc2_undo u
   WHERE b.run_id = :'run_id' AND b.kind = u.kind AND b.record_id = u.record_id AND u.current_address = u.new_address;
  \if :rehearse
    \echo 'DIỄN TẬP: đã khôi phục và ROLLBACK — không có gì thay đổi.'
    ROLLBACK;
  \else
    COMMIT;
    \echo 'ĐÃ HOÀN TÁC.'
  \endif
\else
  \echo 'CHẠY THỬ: chưa ghi gì (ROLLBACK). Thêm -v apply=1 để hoàn tác.'
  ROLLBACK;
\endif
