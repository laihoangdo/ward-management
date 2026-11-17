-- Ấp Trung Chánh 2: rewrite old hamlet names in addresses after the merger.
--   "12/3A Ấp 62, Xã Bà Điểm"  ->  "12/3A Ấp Trung Chánh 2, Xã Bà Điểm"
-- Old names handled: ấp 61, 62, 63, 69 and their earlier numbers ấp 10 (=61), ấp 11 (=62).
-- Exception: a house number that exists in two different old hamlets ("31/5" in ấp 62 and in ấp 63) would become two
-- identical addresses, so those keep the old name: "31/5 Ấp Trung Chánh 2 (ấp 63 cũ)". The duplicate numbers are
-- computed from every in-scope address (10 counted as 61, 11 as 62) plus addresses rewritten by earlier runs, and listed
-- in the report.
--
-- Scope
--   * Household addresses of Trung Chánh 2 (public.household, all of them belong to TC2).
--   * Residence-record addresses (thường trú / tạm trú / nơi ở hiện tại / khai báo) of TC2 records, EXCEPT addresses that
--     name another commune, ward, district, town or province (home towns of temporary residents: "ấp 11, xã Tân Xuân",
--     "ấp 10, tỉnh Long An" ...). Those are listed as skipped and left unchanged.
--   * "ấp 12" (old name of 63) and other numbers are NOT touched.
--
-- Modes (psql variables)
--   default                       dry run: report what would change, then ROLLBACK
--   -v apply=1 -v rehearse=1      do the writes and the checks, then ROLLBACK (safe rehearsal on production)
--   -v apply=1                    apply and COMMIT
--   -v actor='Họ tên người chạy'  required: written to the change log and to the backup table
--
-- Run (production: take a fresh backup first, see docs/data-fix-tc2-old-hamlet-addresses.md)
--   psql -X -v ON_ERROR_STOP=1 -d Monolithic -v actor='Nguyễn Văn A' -f scripts/data-fix/tc2-old-hamlet-addresses.sql
--
-- Safety: one transaction; household rows go through the audit trigger (tc2_roster.change_event, before/after) with the
-- actor and reason; every old/new value is copied to database_repair.tc2_old_hamlet_address_fix (by run_id) for
-- tc2-old-hamlet-addresses-rollback.sql; household version is bumped so an open edit form cannot write the old text
-- back; re-running changes nothing (rewritten text no longer matches).

\set ON_ERROR_STOP on
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

-- 0. Preconditions --------------------------------------------------------------------------------------------------
DO $pre$
BEGIN
  IF lower('ẤP BÀ ĐIỂM') <> 'ấp bà điểm' THEN
    RAISE EXCEPTION 'Collation/ctype của database không chuyển hoa-thường tiếng Việt; dừng để tránh so khớp sai.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.hamlet WHERE code = '27592-TRUNGCHANH-2') THEN
    RAISE EXCEPTION 'Không tìm thấy ấp Trung Chánh 2 (code 27592-TRUNGCHANH-2).';
  END IF;
END
$pre$;
SELECT id AS tc2 FROM public.hamlet WHERE code = '27592-TRUNGCHANH-2' \gset

-- 1. Rules (session-only functions) ---------------------------------------------------------------------------------
-- Old hamlet token: "Ấp 62", "ấp.11", "AP 69", typo "Âp 62"; not inside a word ("Tháp 10"), not followed by more
-- letters/digits ("ấp 610", "ấp 61B"), and not already rewritten ("(ấp 62 cũ)" is preceded by "(").
-- keep_old: house number shared by two old hamlets -> keep "(ấp NN cũ)" so the two addresses stay distinguishable.
-- The bracket names the old hamlet in its current numbering: "(ấp 62 cũ)" also for an address written "ấp 11".
CREATE FUNCTION pg_temp.tc2_rewrite(t text, keep_old boolean) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT replace(replace(regexp_replace(
    normalize(t, NFC),
    '(^|[^[:alnum:](])[ẤấÂâAa][Pp]\.?[[:space:]]*(61|62|63|69|10|11)(?![[:alnum:]])',
    CASE WHEN keep_old THEN '\1Ấp Trung Chánh 2 (ấp \2 cũ)' ELSE '\1Ấp Trung Chánh 2' END,
    'g'), '(ấp 10 cũ)', '(ấp 61 cũ)'), '(ấp 11 cũ)', '(ấp 62 cũ)')
$f$;

-- Old hamlet named in the address, with the earlier numbers folded in (10 = 61, 11 = 62); NULL when none.
CREATE FUNCTION pg_temp.tc2_old(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT CASE n WHEN '10' THEN '61' WHEN '11' THEN '62' ELSE n END
    FROM (SELECT (regexp_match(normalize(t, NFC),
      '(^|[^[:alnum:](])[ẤấÂâAa][Pp]\.?[[:space:]]*(61|62|63|69|10|11)(?![[:alnum:]])'))[2] AS n) x
$f$;

-- House number used to find duplicates: the leading number ("12/3A", "Số 27") after a leading "(...)" note, otherwise the
-- first slash path anywhere ("P.2, 620/21/8 Ấp 11"); upper-cased.
CREATE FUNCTION pg_temp.tc2_house(t text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT upper(coalesce(
    (regexp_match(regexp_replace(normalize(t, NFC), '^[[:space:]]*\([^)]*\)[[:space:]]*', ''), '^(?:[Ss]ố[[:space:]]*)?([0-9]+[0-9A-Za-zĐđ/]*)'))[1],
    (regexp_match(normalize(t, NFC), '([0-9]+/[0-9A-Za-zĐđ/]+)'))[1]))
$f$;

-- Reason an address is outside Bà Điểm (names another xã/phường/thị trấn, quận/huyện, tỉnh or thành phố), or NULL.
CREATE FUNCTION pg_temp.tc2_outside(t text) RETURNS text LANGUAGE plpgsql IMMUTABLE AS $f$
DECLARE
  m text[];
  name text;
BEGIN
  FOR m IN SELECT regexp_matches(lower(normalize(t, NFC)), '(thị trấn|thị xã|xã|phường|huyện|quận|tỉnh|thành phố|tp\.)[[:space:]]*([^,;()]+)', 'g') LOOP
    name := btrim(m[2], ' .-');
    -- Prefix match: a missing comma glues the next unit on ("Xã Bà Điểm Thành phố Hồ Chí Minh").
    IF m[1] IN ('xã', 'phường', 'thị trấn', 'thị xã')
       AND NOT (name LIKE 'bà điểm%' OR name LIKE 'ba điểm%' OR name LIKE 'ba diem%' OR name LIKE 'trung chánh%') THEN
      RETURN m[1] || ' ' || name;
    ELSIF m[1] IN ('huyện', 'quận') AND name NOT LIKE 'hóc môn%' THEN
      RETURN m[1] || ' ' || name;
    ELSIF m[1] = 'tỉnh' THEN
      RETURN m[1] || ' ' || name;
    ELSIF m[1] IN ('thành phố', 'tp.') AND name NOT LIKE 'hồ chí minh%' AND name NOT IN ('hcm', 'hồ chí minh') THEN
      RETURN m[1] || ' ' || name;
    END IF;
  END LOOP;
  RETURN NULL;
END
$f$;

-- 2. Candidates -----------------------------------------------------------------------------------------------------
-- Backup of every run (created here so earlier runs' old addresses also count for duplicate house numbers).
CREATE TABLE IF NOT EXISTS database_repair.tc2_old_hamlet_address_fix (
  run_id uuid NOT NULL,
  kind text NOT NULL,
  record_id text NOT NULL,
  old_address text NOT NULL,
  new_address text NOT NULL,
  actor text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (run_id, kind, record_id)
);

-- Addresses in scope that still name an old hamlet.
CREATE TEMP TABLE tc2_scope ON COMMIT DROP AS
SELECT 'household'::text AS kind, h.roster_id::text AS record_id, h.raw_address AS old_address
  FROM public.household h
 WHERE h.hamlet_id = :tc2
UNION ALL
SELECT 'residence_address', a.id::text, a.raw_address
  FROM tc2_roster.residence_address a
 WHERE EXISTS (SELECT 1 FROM tc2_roster.residence_record_address l JOIN tc2_roster.residence_record r ON r.id = l.record_id
                WHERE l.address_id = a.id AND r.hamlet_id = :tc2)
   AND NOT EXISTS (SELECT 1 FROM tc2_roster.residence_record_address l JOIN tc2_roster.residence_record r ON r.id = l.record_id
                    WHERE l.address_id = a.id AND r.hamlet_id <> :tc2)
   AND pg_temp.tc2_outside(a.raw_address) IS NULL;
DELETE FROM tc2_scope WHERE pg_temp.tc2_old(old_address) IS NULL;

-- House numbers found under two or more different old hamlets (current addresses and earlier runs' originals).
CREATE TEMP TABLE tc2_dup ON COMMIT DROP AS
SELECT house FROM (
  SELECT pg_temp.tc2_house(old_address) AS house, pg_temp.tc2_old(old_address) AS old FROM tc2_scope
  UNION ALL
  SELECT pg_temp.tc2_house(old_address), pg_temp.tc2_old(old_address) FROM database_repair.tc2_old_hamlet_address_fix
) x
WHERE house IS NOT NULL AND old IS NOT NULL
GROUP BY house HAVING count(DISTINCT old) > 1;

CREATE TEMP TABLE tc2_fix ON COMMIT DROP AS
SELECT s.kind, s.record_id, s.old_address,
       pg_temp.tc2_rewrite(s.old_address, d.house IS NOT NULL) AS new_address,
       d.house IS NOT NULL AS kept_old
  FROM tc2_scope s
  LEFT JOIN tc2_dup d ON d.house = pg_temp.tc2_house(s.old_address);

CREATE TEMP TABLE tc2_skipped ON COMMIT DROP AS
SELECT a.id::text AS record_id, a.raw_address, pg_temp.tc2_outside(a.raw_address) AS reason
  FROM tc2_roster.residence_address a
 WHERE EXISTS (SELECT 1 FROM tc2_roster.residence_record_address l JOIN tc2_roster.residence_record r ON r.id = l.record_id
                WHERE l.address_id = a.id AND r.hamlet_id = :tc2)
   AND pg_temp.tc2_outside(a.raw_address) IS NOT NULL
   AND pg_temp.tc2_old(a.raw_address) IS NOT NULL;

-- 3. Report ---------------------------------------------------------------------------------------------------------
\echo
\echo '=== Sẽ đổi (theo loại) ==='
SELECT kind AS "loại", count(*) AS "số bản ghi" FROM tc2_fix GROUP BY kind ORDER BY kind;
\echo '=== Theo ấp cũ ==='
SELECT kind AS "loại", pg_temp.tc2_old(old_address) AS "ấp cũ (10→61, 11→62)", count(*) AS "số bản ghi",
       count(*) FILTER (WHERE kept_old) AS "giữ (ấp cũ) vì số nhà trùng"
  FROM tc2_fix GROUP BY 1, 2 ORDER BY 1, 2;
\echo '=== Số nhà trùng giữa hai ấp cũ: các địa chỉ này giữ tên ấp cũ trong ngoặc ==='
SELECT d.house AS "số nhà", string_agg(DISTINCT pg_temp.tc2_old(f.old_address), ', ') AS "ấp cũ",
       count(*) FILTER (WHERE f.kind = 'household') AS "hộ", count(*) FILTER (WHERE f.kind = 'residence_address') AS "địa chỉ cư trú"
  FROM tc2_dup d LEFT JOIN tc2_fix f ON pg_temp.tc2_house(f.old_address) = d.house
 GROUP BY d.house ORDER BY d.house;
\echo '=== Ví dụ trước -> sau ==='
(SELECT kind AS "loại", old_address AS "trước", new_address AS "sau" FROM tc2_fix WHERE kind = 'household' AND NOT kept_old ORDER BY random() LIMIT 5)
UNION ALL
(SELECT kind, old_address, new_address FROM tc2_fix WHERE kind = 'household' AND kept_old ORDER BY random() LIMIT 3)
UNION ALL
(SELECT kind, old_address, new_address FROM tc2_fix WHERE kind = 'residence_address' ORDER BY random() LIMIT 5);
\echo '=== Bỏ qua: địa chỉ cư trú có ấp cũ nhưng ở xã/huyện/tỉnh khác (giữ nguyên) ==='
SELECT count(*) AS "số địa chỉ bỏ qua" FROM tc2_skipped;
SELECT reason AS "lý do (đơn vị khác)", count(*) AS "số địa chỉ" FROM tc2_skipped GROUP BY 1 ORDER BY 2 DESC LIMIT 25;

-- 4. Apply ----------------------------------------------------------------------------------------------------------
\if :apply
  SELECT gen_random_uuid() AS run_id \gset
  INSERT INTO database_repair.tc2_old_hamlet_address_fix (run_id, kind, record_id, old_address, new_address, actor)
  SELECT :'run_id', kind, record_id, old_address, new_address, :'actor' FROM tc2_fix;

  -- Audit context read by the household trigger (same keys as the application's roster writes).
  SELECT set_config('tc2.actor', :'actor', true),
         set_config('tc2.change_kind', 'CORRECTION', true),
         set_config('tc2.reason', 'Cập nhật tên ấp sau sáp nhập: ấp 61/62/63/69 (ấp 10/11 cũ) -> Ấp Trung Chánh 2 (số nhà trùng giữa hai ấp cũ giữ tên ấp cũ trong ngoặc). run_id ' || :'run_id', true),
         set_config('tc2.effective_date', '', true),
         set_config('tc2.collection_id', '', true);

  -- Only rows still holding the text read above (a concurrent edit makes the check below fail and nothing is written).
  UPDATE public.household h
     SET raw_address = f.new_address, version = h.version + 1, updated_at = now()
    FROM tc2_fix f
   WHERE f.kind = 'household' AND h.roster_id::text = f.record_id AND h.raw_address = f.old_address;
  UPDATE tc2_roster.residence_address a
     SET raw_address = f.new_address
    FROM tc2_fix f
   WHERE f.kind = 'residence_address' AND a.id::text = f.record_id AND a.raw_address = f.old_address;

  DO $chk$
  DECLARE missing bigint;
  BEGIN
    SELECT count(*) INTO missing FROM tc2_fix f
      LEFT JOIN public.household h ON f.kind = 'household' AND h.roster_id::text = f.record_id
      LEFT JOIN tc2_roster.residence_address a ON f.kind = 'residence_address' AND a.id::text = f.record_id
     WHERE coalesce(h.raw_address, a.raw_address) IS DISTINCT FROM f.new_address;
    IF missing > 0 THEN
      RAISE EXCEPTION '% bản ghi không được cập nhật như dự kiến (có thể vừa bị sửa đồng thời); huỷ toàn bộ.', missing;
    END IF;
    IF EXISTS (SELECT 1 FROM public.household h WHERE h.hamlet_id = (SELECT id FROM public.hamlet WHERE code = '27592-TRUNGCHANH-2')
                  AND pg_temp.tc2_old(h.raw_address) IS NOT NULL) THEN
      RAISE EXCEPTION 'Còn địa chỉ hộ TC2 ghi ấp cũ sau khi cập nhật; huỷ toàn bộ.';
    END IF;
    -- Every household change must be in the audit log (the trigger writes one before/after event per row).
    IF (SELECT count(*) FROM tc2_roster.change_event WHERE entity_type = 'household' AND reason = current_setting('tc2.reason'))
       <> (SELECT count(*) FROM tc2_fix WHERE kind = 'household') THEN
      RAISE EXCEPTION 'Số sự kiện kiểm toán không khớp số hộ đã đổi; huỷ toàn bộ.';
    END IF;
  END
  $chk$;
  \echo '=== Đã cập nhật (run_id) ==='
  SELECT :'run_id' AS run_id, count(*) FILTER (WHERE kind = 'household') AS "hộ",
         count(*) FILTER (WHERE kind = 'residence_address') AS "địa chỉ cư trú"
    FROM tc2_fix;
  \if :rehearse
    \echo 'DIỄN TẬP: đã ghi và kiểm tra xong, ROLLBACK — không có gì thay đổi.'
    ROLLBACK;
  \else
    COMMIT;
    \echo 'ĐÃ ÁP DỤNG. Giữ run_id ở trên để hoàn tác nếu cần (tc2-old-hamlet-addresses-rollback.sql).'
  \endif
\else
  \echo 'CHẠY THỬ: chưa ghi gì (ROLLBACK). Thêm -v apply=1 -v rehearse=1 để diễn tập, -v apply=1 để áp dụng.'
  ROLLBACK;
\endif
