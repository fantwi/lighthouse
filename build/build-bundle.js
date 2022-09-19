/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * @fileoverview Script to bundle lighthouse entry points so that they can be run
 * in the browser (as long as they have access to a debugger protocol Connection).
 */

import fs from 'fs';
import path from 'path';
import {execSync} from 'child_process';
import {createRequire} from 'module';

import esMain from 'es-main';
import {rollup} from 'rollup';
// @ts-expect-error: plugin has no types.
import PubAdsPlugin from 'lighthouse-plugin-publisher-ads';

import * as rollupPlugins from './rollup-plugins.js';
import {Runner} from '../core/runner.js';
import {LH_ROOT} from '../root.js';
import {readJson} from '../core/test/test-utils.js';

const require = createRequire(import.meta.url);

/**
 * The git tag for the current HEAD (if HEAD is itself a tag),
 * otherwise a combination of latest tag + #commits since + sha.
 * Note: can't do this in CI because it is a shallow checkout.
 */
const GIT_READABLE_REF =
  execSync(process.env.CI ? 'git rev-parse HEAD' : 'git describe').toString().trim();

// HACK: manually include the lighthouse-plugin-publisher-ads audits.
/** @type {Array<string>} */
// @ts-expect-error
const pubAdsAudits = PubAdsPlugin.audits.map(a => a.path);

/** @param {string} file */
const isDevtools = file =>
  path.basename(file).includes('devtools') || path.basename(file).endsWith('dt-bundle.js');
/** @param {string} file */
const isLightrider = file => path.basename(file).includes('lightrider');

// Set to true for source maps.
const DEBUG = false;

const today = (() => {
  const date = new Date();
  const year = new Intl.DateTimeFormat('en', {year: 'numeric'}).format(date);
  const month = new Intl.DateTimeFormat('en', {month: 'short'}).format(date);
  const day = new Intl.DateTimeFormat('en', {day: '2-digit'}).format(date);
  return `${month} ${day} ${year}`;
})();
const pkg = readJson(`${LH_ROOT}/package.json`);
const banner = `
/**
 * Lighthouse ${GIT_READABLE_REF} (${today})
 *
 * ${pkg.description}
 *
 * @homepage ${pkg.homepage}
 * @author   ${pkg.author}
 * @license  ${pkg.license}
 */
`.trim();

/**
 * Bundle starting at entryPath, writing the minified result to distPath.
 * @param {string} entryPath
 * @param {string} distPath
 * @param {{minify: boolean}=} opts
 * @return {Promise<void>}
 */
async function buildBundle(entryPath, distPath, opts = {minify: true}) {
  if (fs.existsSync(LH_ROOT + '/lighthouse-logger/node_modules')) {
    throw new Error('delete `lighthouse-logger/node_modules` because it messes up rollup bundle');
  }

  // List of paths (absolute / relative to config-helpers.js) to include
  // in bundle and make accessible via config-helpers.js `requireWrapper`.
  const dynamicModulePaths = [
    ...Runner.getGathererList().map(gatherer => `../gather/gatherers/${gatherer}`),
    ...Runner.getAuditList().map(gatherer => `../audits/${gatherer}`),
  ];

  // Include lighthouse-plugin-publisher-ads.
  if (isDevtools(entryPath) || isLightrider(entryPath)) {
    dynamicModulePaths.push('lighthouse-plugin-publisher-ads');
    pubAdsAudits.forEach(pubAdAudit => {
      dynamicModulePaths.push(pubAdAudit);
    });
  }

  const bundledMapEntriesCode = dynamicModulePaths.map(modulePath => {
    const pathNoExt = modulePath.replace('.js', '');
    return `['${pathNoExt}', import('${modulePath}')]`;
  }).join(',\n');

  /** @type {Record<string, string>} */
  const shimsObj = {
    [require.resolve('../core/legacy/gather/connections/cri.js')]:
      'export const CriConnection = {}',
    [require.resolve('../package.json')]: `export const version = '${pkg.version}';`,
  };

  const modulesToIgnore = [
    'puppeteer-core',
    'intl-pluralrules',
    'intl',
    'pako/lib/zlib/inflate.js',
    '@sentry/node',
    'source-map',
    'ws',
  ];

  // Don't include the stringified report in DevTools - see devtools-report-assets.js
  // Don't include in Lightrider - HTML generation isn't supported, so report assets aren't needed.
  if (isDevtools(entryPath) || isLightrider(entryPath)) {
    shimsObj[require.resolve('../report/generator/report-assets.js')] =
      'export const reportAssets = {}';
  }

  // Don't include locales in DevTools.
  if (isDevtools(entryPath)) {
    shimsObj['./locales.js'] = 'export const locales = {};';
  }

  for (const modulePath of modulesToIgnore) {
    shimsObj[modulePath] = 'export default {}';
  }

  const bundle = await rollup({
    input: entryPath,
    context: 'globalThis',
    plugins: [
      rollupPlugins.replace({
        delimiters: ['', ''],
        values: {
          '/* BUILD_REPLACE_BUNDLED_MODULES */': `[\n${bundledMapEntriesCode},\n]`,
          // This package exports to default in a way that causes Rollup to get confused,
          // resulting in MessageFormat being undefined.
          'require(\'intl-messageformat\').default': 'require(\'intl-messageformat\')',
          // Below we replace lighthouse-logger with a local copy, which is ES modules. Need
          // to change every require of the package to reflect this.
          'require(\'lighthouse-logger\');': 'require(\'lighthouse-logger\').default;',
          // Rollup doesn't replace this, so let's manually change it to false.
          'require.main === module': 'false',
          // TODO: Use globalThis directly.
          'global.isLightrider': 'globalThis.isLightrider',
          'global.isDevtools': 'globalThis.isDevtools',
          // For some reason, `shim` doesn't work to force this module to return false, so instead
          // just replace usages of it with false.
          'esMain(import.meta)': 'false',
          'import esMain from \'es-main\'': '',
          // By default Rollup converts `import.meta` to a big mess of `document.currentScript && ...`,
          // and uses the output name as the url. Instead, do a simpler conversion and use the
          // module path.
          'import.meta': (id) => `{url: '${path.relative(LH_ROOT, id)}'}`,
        },
      }),
      rollupPlugins.alias({
        entries: {
          'debug': require.resolve('debug/src/browser.js'),
          'lighthouse-logger': require.resolve('../lighthouse-logger/index.js'),
        },
      }),
      rollupPlugins.shim({
        ...shimsObj,
        // Allows for plugins to import lighthouse.
        'lighthouse': `
          import {Audit} from '${require.resolve('../core/audits/audit.js')}';
          export {Audit};
        `,
        'url': `
          export const URL = globalThis.URL;
          export const fileURLToPath = url => url;
          export default {URL, fileURLToPath};
        `,
        'module': `
          export const createRequire = () => {
            return {
              resolve() {
                throw new Error('createRequire.resolve is not supported in bundled Lighthouse');
              },
            };
          };
        `,
      }),
      rollupPlugins.json(),
      rollupPlugins.removeModuleDirCalls(),
      rollupPlugins.inlineFs({verbose: false}),
      rollupPlugins.commonjs({
        // https://github.com/rollup/plugins/issues/922
        ignoreGlobal: true,
      }),
      rollupPlugins.nodePolyfills(),
      rollupPlugins.nodeResolve({preferBuiltins: true}),
      // Rollup sees the usages of these functions in page functions (ex: see AnchorElements)
      // and treats them as globals. Because the names are "taken" by the global, Rollup renames
      // the actual functions (getNodeDetails$1). The page functions expect a certain name, so
      // here we undo what Rollup did.
      rollupPlugins.postprocess([
        [/getBoundingClientRect\$1/, 'getBoundingClientRect'],
        [/getElementsInDocument\$1/, 'getElementsInDocument'],
        [/getNodeDetails\$1/, 'getNodeDetails'],
        [/getRectCenterPoint\$1/, 'getRectCenterPoint'],
        [/isPositionFixed\$1/, 'isPositionFixed'],
      ]),
      opts.minify && rollupPlugins.terser({
        ecma: 2019,
        output: {
          comments: (node, comment) => {
            const text = comment.value;
            if (text.includes('The Lighthouse Authors') && comment.line > 1) return false;
            return /@ts-nocheck - Prevent tsc|@preserve|@license|@cc_on|^!/i.test(text);
          },
          max_line_len: 1000,
        },
        // The config relies on class names for gatherers.
        keep_classnames: true,
        // Runtime.evaluate errors if function names are elided.
        keep_fnames: true,
      }),
    ],
  });

  await bundle.write({
    file: distPath,
    banner,
    format: 'iife',
    sourcemap: DEBUG,
    // Suppress code splitting.
    inlineDynamicImports: true,
  });
  await bundle.close();
}

/**
 * @param {Array<string>} argv
 */
async function cli(argv) {
  // Take paths relative to cwd and build.
  const [entryPath, distPath] = argv.slice(2)
    .map(filePath => path.resolve(process.cwd(), filePath));
  await buildBundle(entryPath, distPath, {minify: !process.env.DEBUG});
}

// Test if called from the CLI or as a module.
if (esMain(import.meta)) {
  await cli(process.argv);
}

export {
  buildBundle,
};
