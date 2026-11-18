// PostCSS explicitly disables these modules in its package.json browser field.
// Its inline CSS parser works without filesystem/source-map support. Resolve those
// disabled imports to a real empty CommonJS module, not Vite's Node-external Proxy.
// Other packages' Node imports must still be reported, never globally polyfilled.
const disabledModules = new Set(['path', 'url', 'fs', 'source-map-js']);
const emptyModuleId = '\0postcss-browser-empty.cjs';

export function postcssBrowserCompat() {
  return {
    name: 'postcss-browser-compat',
    resolveId(source: string, importer?: string) {
      if (importer && /[/\\]node_modules[/\\]postcss[/\\]/.test(importer) && disabledModules.has(source)) return emptyModuleId;
      return null;
    },
    load(id: string) {
      return id === emptyModuleId ? 'module.exports = {};' : null;
    },
  };
}
