import React, { useState } from 'react';
import axios from 'axios';
import { displayDate } from './dateDisplay';
import { qualityLabel } from './linkQuality';

type Visit = { outcome: string; observed_at: string } | null;
type Nearby = {
  id: string;
  code: string;
  raw_address: string;
  distance_m: number;
  position_source: string;
  link_quality: string;
  last_visit: Visit;
  consecutive_absent: number;
};
type Fix = { latitude: number; longitude: number; accuracy: number };

const sourceLabel: Record<string, string> = {
  BUILDING: 'Theo công trình đã liên kết',
  VERIFIED_COORDINATE: 'Toạ độ đã xác minh tại hiện trường',
};

const geoMessage = (error: GeolocationPositionError) =>
  error.code === error.PERMISSION_DENIED
    ? 'Chưa được cấp quyền vị trí. Cho phép vị trí cho trang này trong cài đặt trình duyệt rồi thử lại.'
    : 'Không xác định được vị trí. Ra nơi thoáng hơn và thử lại.';

const apiMessage = (e: unknown) => {
  const status = axios.isAxiosError(e) ? e.response?.status : undefined;
  if (status === 503) return 'Bản đồ không gian (PostGIS) chưa được bật nên chưa tìm được hộ gần nhất.';
  if (status === 403) return 'Bạn không có quyền ở ấp đang chọn.';
  return 'Không tải được danh sách hộ gần nhất.';
};

/** Field patrol: one tap finds households near the officer; one tap records a visit. Position is read only on request. */
export default function RosterPatrol() {
  const [radius, setRadius] = useState(50);
  const [reliableOnly, setReliableOnly] = useState(false);
  const [fix, setFix] = useState<Fix | null>(null);
  const [items, setItems] = useState<Nearby[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = async (position: Fix) => {
    try {
      const { data } = await axios.get('/api/roster/patrol/nearby', {
        params: { latitude: position.latitude, longitude: position.longitude, radius, ...(reliableOnly ? { reliableOnly: true } : {}) },
      });
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setItems(null);
      setError(apiMessage(e));
    }
  };

  const locate = () => {
    setError('');
    setMessage('');
    if (!('geolocation' in navigator)) {
      setError('Thiết bị không hỗ trợ định vị.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async position => {
        const next = { latitude: position.coords.latitude, longitude: position.coords.longitude, accuracy: position.coords.accuracy };
        setFix(next);
        await load(next);
        setBusy(false);
      },
      geoError => {
        setError(geoMessage(geoError));
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const confirmPosition = async (house: Nearby) => {
    setError('');
    setMessage('');
    try {
      await axios.post('/api/roster/patrol/confirm-position', {
        householdId: house.id,
        requestId: crypto.randomUUID(),
        latitude: fix?.latitude,
        longitude: fix?.longitude,
        accuracy: fix?.accuracy,
      });
      setMessage(`${house.code}: đã xác nhận vị trí.`);
      if (fix) await load(fix);
    } catch {
      setError('Chưa ghi được xác nhận vị trí. Dữ liệu chưa được lưu, hãy thử lại.');
    }
  };

  const checkIn = async (house: Nearby, outcome: 'PRESENT' | 'ABSENT') => {
    setError('');
    setMessage('');
    try {
      await axios.post('/api/roster/patrol/check-in', {
        householdId: house.id,
        outcome,
        requestId: crypto.randomUUID(),
        latitude: fix?.latitude,
        longitude: fix?.longitude,
        accuracy: fix?.accuracy,
      });
      setMessage(`${house.code}: đã ghi ${outcome === 'PRESENT' ? 'đã kiểm tra' : 'vắng mặt'}.`);
      if (fix) await load(fix);
    } catch {
      setError('Chưa ghi được lượt kiểm tra. Dữ liệu chưa được lưu, hãy thử lại.');
    }
  };

  return (
    <section className="roster-patrol" aria-label="Tuần tra thực địa">
      <p className="roster-summary">
        Chỉ hiện hộ có vị trí đã ghi nhận (công trình liên kết hoặc toạ độ đã xác minh). Phần lớn liên kết hiện là ước lượng và được ghi rõ
        từng hộ; bật "Chỉ hộ có vị trí đáng tin" để ẩn chúng. Hộ chỉ có vị trí tạm hoặc chưa có vị trí sẽ không xuất hiện.
      </p>
      <div className="roster-actions">
        <label className="roster-filter-select">
          Bán kính
          <select value={radius} onChange={e => setRadius(Number(e.target.value))}>
            {[30, 50, 100, 200].map(m => (
              <option key={m} value={m}>
                {m} m
              </option>
            ))}
          </select>
        </label>
        <label className="roster-check">
          <input type="checkbox" checked={reliableOnly} onChange={e => setReliableOnly(e.target.checked)} /> Chỉ hộ có vị trí đáng tin
        </label>
        <button type="button" className="roster-primary" onClick={locate} disabled={busy}>
          {items === null ? 'Bắt đầu tuần tra' : 'Cập nhật vị trí'}
        </button>
      </div>
      {fix && (
        <p className="roster-subline">
          Vị trí của bạn: sai số khoảng {Math.round(fix.accuracy)} m.
          {fix.accuracy > radius && ' Sai số lớn hơn bán kính, kết quả có thể lệch.'}
        </p>
      )}
      {error && (
        <div role="alert" className="roster-error">
          {error}
        </div>
      )}
      {message && (
        <p role="status" className="roster-success">
          {message}
        </p>
      )}
      {items !== null && items.length === 0 && <p>Không có hộ nào có vị trí ghi nhận trong bán kính {radius} m.</p>}
      {(items ?? []).map(house => (
        <div className="roster-member-card" key={house.id}>
          <div className="roster-member-info">
            <strong>
              {house.code} · {Math.round(house.distance_m)} m
            </strong>
            <span className="roster-member-meta">{house.raw_address}</span>
            <span className="roster-subline" data-quality={house.link_quality}>
              {qualityLabel[house.link_quality] ?? sourceLabel[house.position_source] ?? house.position_source}
            </span>
            <span className="roster-subline">
              {house.last_visit
                ? `Lần kiểm tra gần nhất: ${house.last_visit.outcome === 'PRESENT' ? 'đã kiểm tra' : 'vắng mặt'} ngày ${displayDate(house.last_visit.observed_at)}`
                : 'Chưa có lượt kiểm tra thực địa'}
              {house.consecutive_absent > 0 && ` · vắng ${house.consecutive_absent} lần liên tiếp`}
            </span>
          </div>
          <div className="roster-actions">
            <button type="button" className="roster-primary" onClick={() => void checkIn(house, 'PRESENT')}>
              Đã kiểm tra
            </button>
            <button type="button" onClick={() => void checkIn(house, 'ABSENT')}>
              Vắng mặt
            </button>
            {house.position_source === 'BUILDING' && house.link_quality !== 'CONFIRMED' && (
              <button type="button" onClick={() => void confirmPosition(house)}>
                Xác nhận vị trí
              </button>
            )}
          </div>
        </div>
      ))}
    </section>
  );
}
