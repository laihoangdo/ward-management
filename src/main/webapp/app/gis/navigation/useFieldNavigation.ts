import { RefObject, useCallback, useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import { distance, LngLat } from './geo';
import { drawNav, removeNavLayers } from './navLayers';
import { formatDistance, Progress, routeProgress, shouldReroute, splitPath } from './navigationProgress';
import { loadRoadGraph } from './roadData';
import type { RoadGraph, TravelMode } from './roadGraph';
import { findRoute, Route } from './route';
import { useLiveLocation, useWakeLock } from './useLiveLocation';

export interface NavTarget {
  point: LngLat;
  label: string;
  buildingId?: string;
  /** Destination is a provisional household point, not a building. */
  provisional?: boolean;
}

/** Where the route starts: the live GPS position, or a place chosen by search or on the map (a fixed route). */
export type NavOrigin = { kind: 'gps' } | { kind: 'place'; point: LngLat; label: string };

export type NavStatus = 'idle' | 'waiting-location' | 'loading-roads' | 'navigating' | 'arrived' | 'error';

/** A start this far from any road (or from the destination with no road between) is treated as outside the road data. */
const FAR_START_METRES = 1000;

/**
 * Map padding that keeps a framed route clear of the panels floating over the map (layers, building, guidance card):
 * panels at a side push that side in, the rest push the top or bottom.
 */
export function overlayPadding(map: maplibregl.Map) {
  const padding = { top: 30, bottom: 30, left: 30, right: 30 };
  const container = map.getContainer?.();
  const body = container?.parentElement;
  if (!container || !body) return padding;
  const c = container.getBoundingClientRect();
  if (!c.width || !c.height) return padding;
  for (const element of body.querySelectorAll<HTMLElement>('.field-layers[open], .field-panel, .field-nav-card, .field-mouse-help')) {
    const r = element.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    const fromLeft = r.left - c.left;
    const fromRight = c.right - r.right;
    if (r.width < c.width * 0.45 && fromLeft < c.width * 0.1) padding.left = Math.max(padding.left, r.right - c.left + 20);
    else if (r.width < c.width * 0.45 && fromRight < c.width * 0.1) padding.right = Math.max(padding.right, c.right - r.left + 20);
    else if (r.top - c.top < c.height / 2) padding.top = Math.max(padding.top, r.bottom - c.top + 20);
    else padding.bottom = Math.max(padding.bottom, c.bottom - r.top + 20);
  }
  // Keep at least a small window for the route; drop the side padding first when the screen is too narrow.
  if (c.width - padding.left - padding.right < 160) padding.left = padding.right = 30;
  if (c.height - padding.top - padding.bottom < 120) padding.top = padding.bottom = 30;
  return padding;
}

function officerElement() {
  const element = document.createElement('div');
  element.className = 'field-nav-me';
  element.setAttribute('role', 'img');
  element.setAttribute('aria-label', 'Vị trí của tôi');
  element.innerHTML = '<span class="field-nav-me-arrow"></span><span class="field-nav-me-dot"></span>';
  return element;
}

/**
 * Officer location and turn-by-turn route to a building on the field map. Routing runs on the device over the road
 * network; the position is never sent to the server.
 */
export function useFieldNavigation(mapRef: RefObject<maplibregl.Map | null>, ready: boolean) {
  const [locating, setLocating] = useState(false);
  const [target, setTarget] = useState<NavTarget | null>(null);
  const [origin, setOriginState] = useState<NavOrigin>({ kind: 'gps' });
  const [pickingOrigin, setPickingOrigin] = useState(false);
  const [mode, setMode] = useState<TravelMode>('motorbike');
  const [follow, setFollow] = useState(true);
  const [route, setRoute] = useState<Route | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [status, setStatus] = useState<NavStatus>('idle');
  const [message, setMessage] = useState('');
  /** The start is outside the road data: the card offers to choose another start. */
  const [farStart, setFarStart] = useState(false);
  const [graph, setGraph] = useState<RoadGraph | null>(null);
  const markerRef = useRef<maplibregl.Marker | null>(null);
  const rerouteRef = useRef({ offCount: 0, lastReroute: 0 });
  const centeredRef = useRef(false);
  const navigating = target !== null && status !== 'arrived';
  const live = origin.kind === 'gps';
  const { fix, error: locationError } = useLiveLocation(locating || (navigating && live));
  useWakeLock(navigating && live);
  const startPoint: LngLat | null = origin.kind === 'place' ? origin.point : (fix?.position ?? null);

  /** Road network, downloaded once; also used by the start-point search. */
  const ensureGraph = useCallback(() => {
    if (graph) return Promise.resolve(graph);
    return loadRoadGraph().then(loaded => {
      setGraph(loaded);
      return loaded;
    });
  }, [graph]);

  useEffect(() => {
    if (!target || graph) return undefined;
    let cancelled = false;
    setStatus('loading-roads');
    ensureGraph().catch(() => {
      if (!cancelled) {
        setStatus('error');
        setMessage('Không tải được dữ liệu đường để chỉ đường. Kiểm tra kết nối rồi thử lại.');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  const computeRoute = useCallback(
    (from: LngLat) => {
      if (!target || !graph) return null;
      const next = findRoute(graph, from, target.point, mode);
      const offRoad = next.startConnector ? distance(next.startConnector[0], next.startConnector[1]) : 0;
      const far = next.straight ? distance(from, target.point) > FAR_START_METRES : offRoad > FAR_START_METRES;
      setRoute(next);
      setFarStart(far);
      setMessage(
        far
          ? `Điểm xuất phát nằm ngoài vùng dữ liệu đường (cách ${formatDistance(next.straight ? distance(from, target.point) : offRoad)}). Chọn điểm xuất phát bằng ô "Từ" hoặc chạm trên bản đồ.`
          : next.straight
            ? 'Không tìm thấy đường nối trong dữ liệu đường; đang chỉ hướng theo đường chim bay.'
            : '',
      );
      return next;
    },
    [target, mode, graph],
  );

  // New target, start, mode, or roads just loaded: route from the start point.
  useEffect(() => {
    if (!target || status === 'arrived' || status === 'error') return;
    if (!graph) return;
    if (!startPoint) {
      setStatus('waiting-location');
      return;
    }
    rerouteRef.current = { offCount: 0, lastReroute: Date.now() };
    const next = computeRoute(startPoint);
    // Show distance and time at once instead of waiting for the next GPS fix.
    if (next) setProgress(routeProgress(next, startPoint));
    setStatus('navigating');
    // A chosen start gives a fixed route: show all of it.
    if (next && origin.kind === 'place') {
      const map = mapRef.current;
      const points = [startPoint, ...next.path, next.destination];
      const lngs = points.map(p => p[0]);
      const lats = points.map(p => p[1]);
      // Measured after the start picker has closed, so the padding matches the card's final size.
      window.setTimeout(() => {
        if (!map || mapRef.current !== map) return;
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: overlayPadding(map), maxZoom: 18, pitch: 30, duration: 800 },
        );
      }, 60);
    }
    // Only these start a new route; later GPS fixes update progress below.
  }, [target, mode, graph, origin, !!startPoint, computeRoute]);

  // Each GPS fix (live start only): progress, arrival, rerouting when off the path.
  useEffect(() => {
    if (!live || !fix || !route || !target || status !== 'navigating') return;
    let current = route;
    let next = routeProgress(current, fix.position);
    if (!next.arrived && shouldReroute(rerouteRef.current, next.offRoute, Date.now())) {
      current = computeRoute(fix.position) ?? current;
      next = routeProgress(current, fix.position);
    }
    setProgress(next);
    if (next.arrived) {
      setStatus('arrived');
      setFollow(false);
    }
  }, [fix]);

  // Officer marker, accuracy ring, chosen start, route drawing.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (!locating && !target) {
      markerRef.current?.remove();
      markerRef.current = null;
      removeNavLayers(map);
      return;
    }
    if (fix) {
      if (!markerRef.current) {
        markerRef.current = new maplibregl.Marker({ element: officerElement(), rotationAlignment: 'map', pitchAlignment: 'map' })
          .setLngLat(fix.position)
          .addTo(map);
      }
      const heading = (live ? progress?.heading : null) ?? fix.heading;
      markerRef.current.setLngLat(fix.position).setRotation(heading ?? 0);
      markerRef.current.getElement().classList.toggle('has-heading', heading !== null);
    } else if (markerRef.current) {
      markerRef.current.remove();
      markerRef.current = null;
    }
    const split = route && progress ? splitPath(route, progress) : { walked: [], ahead: route?.path ?? [] };
    const showRoute = route && status !== 'arrived';
    drawNav(map, {
      accuracy: fix ? { center: fix.position, radius: Math.min(fix.accuracy, 300) } : null,
      walked: showRoute ? split.walked : [],
      ahead: showRoute ? split.ahead : [],
      connectors: showRoute
        ? [
            route.straight && startPoint ? ([startPoint, route.destination] as [LngLat, LngLat]) : route.startConnector,
            route.endConnector,
          ].filter((piece): piece is [LngLat, LngLat] => piece !== null)
        : [],
      origin: target && origin.kind === 'place' ? origin.point : null,
      target: target?.point ?? null,
    });
  }, [ready, fix, route, progress, locating, target, status, origin]);

  // Camera: first fix centres the map; while following, the map tracks the officer and turns with the direction of travel.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fix) {
      centeredRef.current = false;
      return;
    }
    if (!centeredRef.current) {
      centeredRef.current = true;
      if (live || !target) map.flyTo({ center: fix.position, zoom: Math.max(map.getZoom(), 18), duration: 800 });
      return;
    }
    if (!follow || !navigating || !live) return;
    const heading = progress?.heading ?? fix.heading;
    // The officer sits in the lower part of the view, so the road ahead is not under the guidance card.
    const height = map.getContainer?.().clientHeight ?? 0;
    map.easeTo({
      center: fix.position,
      zoom: Math.max(map.getZoom(), 18),
      pitch: 50,
      offset: [0, Math.round(height * 0.22)],
      ...(heading !== null ? { bearing: heading } : {}),
      duration: 900,
    });
  }, [fix]);

  // A drag or rotate by the officer pauses following; "Bám theo" resumes it.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return undefined;
    const pause = (event: { originalEvent?: unknown }) => {
      if (event.originalEvent) setFollow(false);
    };
    map.on('dragstart', pause);
    map.on('rotatestart', pause);
    return () => {
      map.off('dragstart', pause);
      map.off('rotatestart', pause);
    };
  }, [ready]);

  // "Chọn trên bản đồ": the next click on the map becomes the start (the map's own click handler skips it).
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !pickingOrigin) return undefined;
    const canvas = map.getCanvas?.();
    const previousCursor = canvas?.style.cursor ?? '';
    if (canvas) canvas.style.cursor = 'crosshair';
    const pick = (event: { lngLat: { lng: number; lat: number } }) => {
      const point: LngLat = [event.lngLat.lng, event.lngLat.lat];
      setOriginState({ kind: 'place', point, label: `Điểm chọn trên bản đồ (${point[1].toFixed(5)}, ${point[0].toFixed(5)})` });
      setPickingOrigin(false);
    };
    map.on('click', pick);
    return () => {
      map.off('click', pick);
      if (canvas) canvas.style.cursor = previousCursor;
    };
  }, [ready, pickingOrigin]);

  useEffect(
    () => () => {
      markerRef.current?.remove();
    },
    [],
  );

  const resetRoute = () => {
    setRoute(null);
    setProgress(null);
    setMessage('');
    setFarStart(false);
  };
  const start = useCallback((next: NavTarget) => {
    setTarget(next);
    resetRoute();
    setFollow(true);
    setPickingOrigin(false);
    setStatus('loading-roads');
  }, []);
  const stop = useCallback(() => {
    setTarget(null);
    resetRoute();
    setPickingOrigin(false);
    setStatus('idle');
  }, []);
  const setOrigin = useCallback((next: NavOrigin) => {
    setOriginState(next);
    setPickingOrigin(false);
    resetRoute();
    setFollow(next.kind === 'gps');
    setStatus(current => (current === 'arrived' ? 'navigating' : current));
  }, []);

  return {
    locating,
    toggleLocating: () => setLocating(value => !value),
    target,
    start,
    stop,
    origin,
    setOrigin,
    pickingOrigin,
    setPickingOrigin,
    farStart,
    graph,
    ensureGraph,
    mode,
    setMode,
    follow,
    setFollow,
    fix,
    route,
    progress,
    status,
    message: message || (live ? locationError : ''),
    locationError,
  };
}
export type FieldNavigation = ReturnType<typeof useFieldNavigation>;
