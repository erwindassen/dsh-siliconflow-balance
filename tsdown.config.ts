import { defineConfig } from 'tsdown';

/**
 * The browser half is a single CJS bundle wrapped by `scripts/wrap-client-bundle.mjs`
 * into the `window.__ModuleLoader__.load({ id, factory })` contract described in
 * `docs/design.md` §2.2. React is a platform module and must stay external.
 */
export default defineConfig({
  entry: { client: 'src/client.tsx' },
  outDir: 'lib',
  format: 'cjs',
  target: 'es2022',
  dts: false,
  sourcemap: false,
  clean: false,
  // `type: module` makes tsdown default CJS output to `.cjs`; the module loader
  // and the package `exports` expect `lib/client.js`.
  outExtensions: () => ({ js: '.js' }),
  deps: {
    neverBundle: ['react', 'react/jsx-runtime'],
  },
  // CJS normally targets Node; the loader runs this bundle in the browser.
  inputOptions: { platform: 'browser' },
});
