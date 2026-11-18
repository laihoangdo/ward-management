import { useEffect, useRef, useState } from 'react';
import { bearing, distance, LngLat } from './geo';

export interface LocationFix {
  position: LngLat;
  /** Metres (68% confidence) as reported by the device. */
  accuracy: number;
  /** Compass heading in degrees, from the device or from the last movement; null while standing still. */
  heading: number | null;
  time: number;
}

/** GPS readings worse than this are shown but flagged as unreliable. */
export const POOR_ACCURACY_METRES = 50;

export function locationErrorMessage(error: Pick<GeolocationPositionError, 'code'>): string {
  if (error.code === 1) return 'Chưa được cấp quyền vị trí. Cho phép truy cập vị trí trong cài đặt trình duyệt rồi thử lại.';
  if (error.code === 3) return 'Lấy vị trí quá lâu. Ra chỗ thoáng hoặc bật GPS rồi thử lại.';
  return 'Không xác định được vị trí. Kiểm tra GPS và kết nối của thiết bị.';
}

/**
 * Follows the device position while active. The position stays on this device: nothing here sends it anywhere.
 */
export function useLiveLocation(active: boolean) {
  const [fix, setFix] = useState<LocationFix | null>(null);
  const [error, setError] = useState('');
  const lastRef = useRef<LocationFix | null>(null);
  useEffect(() => {
    if (!active) {
      lastRef.current = null;
      setFix(null);
      setError('');
      return undefined;
    }
    if (typeof window !== 'undefined' && window.isSecureContext === false) {
      setError('Định vị chỉ hoạt động khi mở ứng dụng qua HTTPS.');
      return undefined;
    }
    if (!navigator.geolocation) {
      setError('Thiết bị hoặc trình duyệt không hỗ trợ định vị.');
      return undefined;
    }
    const id = navigator.geolocation.watchPosition(
      ({ coords, timestamp }) => {
        const position: LngLat = [coords.longitude, coords.latitude];
        const last = lastRef.current;
        let heading = Number.isFinite(coords.heading) && (coords.speed ?? 0) > 0.5 ? (coords.heading as number) : null;
        // Many phones report no heading: use the direction of the last movement once it clearly exceeds GPS jitter.
        if (heading === null && last) {
          heading = distance(last.position, position) > Math.max(3, coords.accuracy / 3) ? bearing(last.position, position) : last.heading;
        }
        const next = { position, accuracy: coords.accuracy, heading, time: timestamp };
        lastRef.current = next;
        setFix(next);
        setError('');
      },
      geoError => setError(locationErrorMessage(geoError)),
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [active]);
  return { fix, error };
}

/** Keeps the screen on while navigating, where the browser allows it. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active) return undefined;
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    if (!wakeLock) return undefined;
    let sentinel: { release(): Promise<void> } | null = null;
    let cancelled = false;
    const request = () => {
      wakeLock
        .request('screen')
        .then(lock => {
          if (cancelled) void lock.release();
          else sentinel = lock;
        })
        .catch(() => {
          /* refused (battery saver, hidden tab): navigation still works */
        });
    };
    request();
    // The lock is dropped when the tab is hidden; take it again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') request();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}
