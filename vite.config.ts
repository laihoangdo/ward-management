import path from 'node:path';
import { URL, fileURLToPath } from 'node:url';

import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig, normalizePath, type ProxyOptions, type Plugin } from 'vite';
import { proxyOrigin } from './src/main/webapp/app/config/proxy-origin.ts';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { postcssBrowserCompat } from './scripts/postcss-browser-compat.ts';
import { compatibleOcrLanguageAsset } from './scripts/ocr-language-compat.ts';

const { getAbsoluteFSPath } = await import('swagger-ui-dist');
const swaggerUiPath = getAbsoluteFSPath();
const webappDir = fileURLToPath(new URL('./src/main/webapp/', import.meta.url));

const development = process.env.NODE_ENV !== 'production';
// Explicit synthetic VPS build only; operational assets remain untouched for normal builds.
const syntheticStage = process.env.POLICE_STAGING_SYNTHETIC === 'true';

const config = defineConfig({
  plugins: [
    ...(syntheticStage
      ? [
          {
            name: 'synthetic-staging-marker',
            generateBundle() {
              const excluded = ['apTc2Schematic.json', 'apTc2DxfLinework.json', 'baDiemBoundaryGis.json', 'baDiemBuildingsGis.backup.json'];
              const unsafe = [...this.getModuleIds()]
                .map(id => id.replace(/\\/g, '/').split('?')[0])
                .filter(id => id.includes('/src/main/webapp/app/gis/data/') && excluded.some(name => id.endsWith('/' + name)));
              if (unsafe.length) this.error('Synthetic staging attempted to bundle excluded operational/legacy GIS datasets.');
              this.emitFile({
                type: 'asset' as const,
                fileName: 'staging-manifest.json',
                source: JSON.stringify({ syntheticOnly: true, excludedDatasets: ['apTc2Schematic', 'apTc2DxfLinework'] }),
              });
            },
          } satisfies Plugin,
        ]
      : []),
    { ...postcssBrowserCompat(), enforce: 'pre' },
    tailwindcss(),
    react(),
    // Keep dev ?raw imports in Vite's transform pipeline; copy this file only for production.
    ...viteStaticCopy({
      targets: [
        {
          src: normalizePath(fileURLToPath(new URL('./src/main/webapp/content/assets/xa_ba_diem.geojson', import.meta.url))),
          dest: '.',
        },
      ],
    }).filter(plugin => plugin.apply === 'build'),
    viteStaticCopy({
      targets: [
        {
          src: normalizePath(fileURLToPath(new URL('./src/main/webapp/content/data/badiem-houses.geojson', import.meta.url))),
          dest: '.',
        },
        {
          src: normalizePath(fileURLToPath(new URL('./src/main/webapp/content/assets/badiem_satellite', import.meta.url))),
          dest: '.',
        },
        {
          src: normalizePath(fileURLToPath(new URL('./src/main/webapp/content/assets/badiem_map', import.meta.url))),
          dest: '.',
        },
        {
          src: normalizePath(fileURLToPath(new URL('./node_modules/tesseract.js/dist/worker.min.js', import.meta.url))),
          dest: 'ocr',
          rename: { stripBase: true },
        },
        {
          src: normalizePath(fileURLToPath(new URL('./node_modules/tesseract.js-core/tesseract-core*', import.meta.url))),
          dest: 'ocr/core',
          rename: { stripBase: true },
        },
        {
          src: ['eng', 'vie'].map(lang =>
            normalizePath(
              fileURLToPath(new URL(`./node_modules/@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, import.meta.url)),
            ),
          ),
          dest: 'ocr/lang',
          rename: { stripBase: true },
          transform: { encoding: 'buffer', handler: compatibleOcrLanguageAsset },
        },
        {
          src: [
            `${normalizePath(swaggerUiPath)}/*.{js,css,html,png}`,
            `!${normalizePath(swaggerUiPath)}/**/index.html`,
            normalizePath(fileURLToPath(new URL('./dist/axios.min.js', import.meta.resolve('axios/package.json')))),
            normalizePath(fileURLToPath(new URL('./src/main/webapp/swagger-ui/index.html', import.meta.url))),
          ],
          dest: 'swagger-ui',
          rename: (name, ext, srcPath) => {
            const rel = path.relative(webappDir, path.dirname(srcPath)).replace(/^(\.\.\/)+/, '');
            return `${'../'.repeat(rel === '.' ? 0 : rel.split('/').length)}${name}.${ext}`;
          },
        },
      ],
    }),
  ],
  root: fileURLToPath(new URL('./src/main/webapp/', import.meta.url)),
  publicDir: false,
  cacheDir: fileURLToPath(new URL('./target/.vite-cache', import.meta.url)),
  build: {
    emptyOutDir: true,
    outDir: fileURLToPath(new URL('./target/classes/static/', import.meta.url)),
    rolldownOptions: {
      input: {
        app: fileURLToPath(new URL('./src/main/webapp/index.html', import.meta.url)),
      },
      output: {
        // Split the vendor code into cacheable chunks instead of one oversized bundle.
        codeSplitting: {
          groups: [
            { name: 'vendor-maplibre', test: /node_modules[\\/](@maplibre|maplibre-gl|gl-matrix|@mapbox)[\\/]/, priority: 50 },
            { name: 'vendor-three', test: /node_modules[\\/](three|@types[\\/]three)[\\/]/, priority: 45 },
            { name: 'vendor-react', test: /node_modules[\\/](react|react-dom|scheduler|react-router)[\\/]/, priority: 40 },
            { name: 'vendor-redux', test: /node_modules[\\/](@reduxjs[\\/]toolkit|react-redux|redux|immer|reselect)[\\/]/, priority: 30 },
            { name: 'vendor-bootstrap', test: /node_modules[\\/](react-bootstrap|@restart|bootstrap)[\\/]/, priority: 20 },
            { name: 'vendor-fontawesome', test: /node_modules[\\/]@fortawesome[\\/]/, priority: 10 },
            { name: 'vendor', test: /node_modules[\\/]/, priority: 1 },
          ],
        },
      },
    },
  },
  resolve: {
    tsconfigPaths: true,
    alias: syntheticStage
      ? [
          {
            find: /^.*\/apTc2Schematic\.json$/,
            replacement: fileURLToPath(new URL('./infra/vps/staging/assets/apTc2Schematic.json', import.meta.url)),
          },
          {
            find: /^.*\/apTc2DxfLinework\.json$/,
            replacement: fileURLToPath(new URL('./infra/vps/staging/assets/apTc2DxfLinework.json', import.meta.url)),
          },
        ]
      : [],
  },
  optimizeDeps: {
    rolldownOptions: {
      plugins: [postcssBrowserCompat()],
    },
  },
  define: {
    DEVELOPMENT: JSON.stringify(development),
    // APP_VERSION is passed as an environment variable from the Gradle / Maven build tasks.
    VERSION: JSON.stringify(process.env.APP_VERSION || 'DEV'),
    // If this URL is left empty (""), then it will be relative to the current context.
    // If you use an API server, in `prod` mode, you will need to enable CORS
    // (see the `jhipster.cors` common JHipster property in the `application-*.yml` configurations)
    SERVER_API_URL: '""',
    // react-jhipster requires LOG_LEVEL config.
    'process.env.LOG_LEVEL': JSON.stringify(development ? 'info' : 'error'),
  },
  server: {
    host: process.env.VITE_DEV_HOST || 'localhost',
    port: 9000,
    allowedHosts: (process.env.VITE_ALLOWED_HOSTS || '')
      .split(',')
      .map(host => host.trim())
      .filter(Boolean),
    proxy: Object.fromEntries(
      ['/realms', '/resources', '/api', '/services', '/management', '/v3/api-docs', '/oauth2', '/login'].map(route => [
        route,
        {
          target: ['/realms', '/resources'].includes(route) ? 'http://localhost:9080' : 'http://localhost:8080',
          configure(proxy) {
            proxy.on('proxyReq', (outgoing, request) => {
              const origin = proxyOrigin(request);
              outgoing.setHeader('X-Forwarded-Proto', origin.protocol);
              outgoing.setHeader('X-Forwarded-Host', origin.host);
              outgoing.setHeader('X-Forwarded-Port', origin.port);
            });
          },
        } satisfies ProxyOptions,
      ]),
    ),
  },
});

// jhipster-needle-add-vite-config - JHipster will add custom config

export default config;
