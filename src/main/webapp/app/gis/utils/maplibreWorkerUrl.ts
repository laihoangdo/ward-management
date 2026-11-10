import * as maplibregl from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';

// MapLibre v6 loads its Web Worker from a separate file, resolving the URL at runtime
// through `import.meta.url` — a dynamic URL the bundler cannot rewrite inside a chunk.
// Left alone, the worker request 404s in production and every GeoJSON source silently
// never parses (raster tiles keep rendering, so only buildings/layers disappear).
// The `?url` import makes Vite emit the worker as a hashed asset and hand us its URL.
maplibregl.setWorkerUrl(maplibreWorkerUrl);
