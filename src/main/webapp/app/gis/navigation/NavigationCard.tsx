import React, { useDeferredValue, useEffect, useState } from 'react';
import { Bike, Crosshair, Footprints, LocateFixed, MapPin, Navigation, X } from 'lucide-react';
import { formatDistance, formatDuration } from './navigationProgress';
import { POOR_ACCURACY_METRES } from './useLiveLocation';
import type { FieldNavigation } from './useFieldNavigation';
import type { Place } from './placeSearch';

/** Start point by search (house number + street, household, building, road or coordinates), on the map, or GPS. */
function OriginPicker({ nav, findPlaces }: { nav: FieldNavigation; findPlaces: (query: string) => Place[] }) {
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const [roadsError, setRoadsError] = useState(false);
  useEffect(() => {
    nav.ensureGraph().catch(() => setRoadsError(true));
  }, []);
  // Recomputed on every render, so road names join the results once the road network (nav.graph) has loaded.
  const results = deferred.trim().length >= 2 ? findPlaces(deferred) : [];
  const choose = (place: Place) => nav.setOrigin({ kind: 'place', point: place.point, label: place.label });
  return (
    <div className="field-nav-picker">
      <input
        type="search"
        aria-label="Tìm điểm xuất phát"
        placeholder="Số nhà + tên đường, hộ, công trình hoặc toạ độ"
        value={query}
        autoComplete="off"
        autoFocus
        onChange={event => setQuery(event.target.value)}
        onKeyDown={event => {
          if (event.key === 'Enter' && results[0]) {
            event.preventDefault();
            choose(results[0]);
          }
        }}
      />
      {results.length > 0 && (
        <ul className="field-nav-results" aria-label="Điểm xuất phát tìm được">
          {results.map(place => (
            <li key={place.id}>
              <button type="button" onClick={() => choose(place)}>
                <strong>{place.label}</strong>
                <span>{place.detail}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {deferred.trim().length >= 2 && results.length === 0 && (
        <p className="field-nav-note" role="status">
          Không tìm thấy trong dữ liệu hộ, công trình và tên đường. Thử bỏ số nhà, hoặc chọn trên bản đồ.
        </p>
      )}
      {roadsError && <p className="field-nav-warning">Chưa tải được dữ liệu đường; chỉ tìm được hộ và công trình.</p>}
      <div className="field-nav-actions">
        <button type="button" onClick={() => nav.setPickingOrigin(true)}>
          <Crosshair aria-hidden="true" /> Chọn trên bản đồ
        </button>
        {nav.origin.kind !== 'gps' && (
          <button type="button" onClick={() => nav.setOrigin({ kind: 'gps' })}>
            <LocateFixed aria-hidden="true" /> Dùng vị trí GPS
          </button>
        )}
      </div>
    </div>
  );
}

/** Route summary and next instruction while guiding the officer to a building. */
export function NavigationCard({ nav, findPlaces }: { nav: FieldNavigation; findPlaces: (query: string) => Place[] }) {
  const { target, status, progress, route, fix } = nav;
  const [choosing, setChoosing] = useState(false);
  // A start outside the road data opens the start-point picker by itself.
  useEffect(() => {
    if (nav.farStart) setChoosing(true);
  }, [nav.farStart]);
  useEffect(() => setChoosing(false), [nav.origin, target]);
  if (!target && !(nav.locating && nav.locationError)) return null;
  const live = nav.origin.kind === 'gps';
  const poorFix = live && fix && fix.accuracy > POOR_ACCURACY_METRES;
  const instruction =
    status === 'loading-roads'
      ? 'Đang tải dữ liệu đường…'
      : status === 'waiting-location'
        ? 'Đang chờ vị trí của bạn…'
        : status === 'arrived'
          ? 'Đã tới khối nhà'
          : status === 'error'
            ? 'Chưa chỉ đường được'
            : route?.straight
              ? 'Đi theo hướng mũi tên tới đích'
              : live
                ? (progress?.nextManeuver?.text ?? 'Đi tiếp tới đích')
                : (route?.maneuvers[0]?.text ?? 'Đi thẳng tới đích');
  return (
    <section className="field-nav-card" aria-label="Chỉ đường">
      {target && (
        <div className="field-nav-head">
          <Navigation aria-hidden="true" className="field-nav-icon" />
          <div className="field-nav-title">
            <span>Đi tới</span>
            <strong>{target.label}</strong>
          </div>
          <button type="button" className="field-nav-close" aria-label="Kết thúc chỉ đường" title="Kết thúc chỉ đường" onClick={nav.stop}>
            <X aria-hidden="true" />
          </button>
        </div>
      )}
      {target && (
        <>
          <div className="field-nav-origin">
            <MapPin aria-hidden="true" className={live ? 'field-nav-origin-icon' : 'field-nav-origin-icon is-place'} />
            <span className="field-nav-origin-text">
              Từ <strong>{nav.origin.kind === 'place' ? nav.origin.label : 'Vị trí của tôi (GPS)'}</strong>
            </span>
            <button
              type="button"
              aria-expanded={choosing || nav.pickingOrigin}
              onClick={() => {
                if (nav.pickingOrigin) nav.setPickingOrigin(false);
                else setChoosing(value => !value);
              }}
            >
              {choosing || nav.pickingOrigin ? 'Đóng' : 'Đổi'}
            </button>
          </div>
          {nav.pickingOrigin && (
            <p className="field-nav-picking" role="status">
              Chạm vào bản đồ tại điểm xuất phát.
            </p>
          )}
          {choosing && !nav.pickingOrigin && <OriginPicker nav={nav} findPlaces={findPlaces} />}
          <p className="field-nav-instruction" aria-live="polite">
            {instruction}
          </p>
          {status === 'navigating' && progress && (
            <p className="field-nav-summary">
              {live && progress.nextManeuver && !route?.straight && <span>sau {formatDistance(progress.nextManeuver.in)} · </span>}
              <span>
                {live ? 'Còn' : 'Quãng đường'} <strong>{formatDistance(progress.remaining)}</strong> · {formatDuration(progress.seconds)}
              </span>
            </p>
          )}
          {!live && status === 'navigating' && (
            <p className="field-nav-note field-nav-hint">
              Lộ trình cố định từ điểm đã chọn. Bấm "Đổi" → "Dùng vị trí GPS" để dẫn đường theo vị trí thật.
            </p>
          )}
          {target.provisional && <p className="field-nav-note">Đích là vị trí tạm của hộ, chưa xác minh trên thực địa.</p>}
          {route?.endConnector && status === 'navigating' && (
            <p className="field-nav-note field-nav-hint">Đoạn nét đứt cuối là lối vào nhà chưa có trong dữ liệu đường.</p>
          )}
          <div className="field-nav-actions">
            <div className="field-nav-modes" role="group" aria-label="Phương tiện">
              <button type="button" aria-pressed={nav.mode === 'motorbike'} onClick={() => nav.setMode('motorbike')}>
                <Bike aria-hidden="true" /> Xe máy
              </button>
              <button type="button" aria-pressed={nav.mode === 'walk'} onClick={() => nav.setMode('walk')}>
                <Footprints aria-hidden="true" /> Đi bộ
              </button>
            </div>
            {live && status === 'navigating' && !nav.follow && (
              <button type="button" className="field-nav-follow" onClick={() => nav.setFollow(true)}>
                <LocateFixed aria-hidden="true" /> Bám theo
              </button>
            )}
            {status === 'arrived' && (
              <button type="button" className="field-nav-follow" onClick={nav.stop}>
                Xong
              </button>
            )}
          </div>
        </>
      )}
      {(nav.message || poorFix) && (
        <p role="status" className="field-nav-warning">
          {nav.message || `GPS đang sai số khoảng ${Math.round(fix!.accuracy)} m; vị trí và lộ trình có thể lệch.`}
        </p>
      )}
      {target && <small className="field-nav-credit">Dữ liệu đường © OpenStreetMap contributors</small>}
    </section>
  );
}
