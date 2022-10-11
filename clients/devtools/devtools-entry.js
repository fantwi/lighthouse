/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/* global globalThis */

import {Buffer} from 'buffer';

import log from 'lighthouse-logger';

import lighthouse, {legacyNavigation} from '../../core/index.js';
import {navigation, startTimespan, snapshot} from '../../core/api.js';
import {RawConnection} from '../../core/legacy/gather/connections/raw.js';
import {lookupLocale} from '../../core/lib/i18n/i18n.js';
import {registerLocaleData, getCanonicalLocales} from '../../shared/localization/format.js';
import * as constants from '../../core/config/constants.js';

/** @typedef {import('../../core/legacy/gather/connections/connection.js')} Connection */

// Rollup seems to overlook some references to `Buffer`, so it must be made explicit.
// (`parseSourceMapFromDataUrl` breaks without this)
/** @type {BufferConstructor} */
globalThis.Buffer = Buffer;

/**
 * Returns a config, which runs only certain categories.
 * Varies the config to use based on device.
 * If `lighthouse-plugin-publisher-ads` is in the list of
 * `categoryIDs` the plugin will also be run.
 * Counterpart to the CDT code that sets flags.
 * @see https://source.chromium.org/chromium/chromium/src/+/main:third_party/devtools-frontend/src/front_end/panels/lighthouse/LighthouseController.ts;l=280
 * @param {Array<string>} categoryIDs
 * @param {string} device
 * @return {LH.Config.Json}
 */
function createConfig(categoryIDs, device) {
  /** @type {LH.SharedFlagsSettings} */
  const settings = {
    onlyCategories: categoryIDs,
    // In DevTools, emulation is applied _before_ Lighthouse starts (to deal with viewport emulation bugs). go/xcnjf
    // As a result, we don't double-apply viewport emulation.
    screenEmulation: {disabled: true},
  };
  if (device === 'desktop') {
    settings.throttling = constants.throttling.desktopDense4G;
    // UA emulation, however, is lost in the protocol handover from devtools frontend to the lighthouse_worker. So it's always applied.
    settings.emulatedUserAgent = constants.userAgents.desktop;
    settings.formFactor = 'desktop';
  }

  return {
    extends: 'lighthouse:default',
    plugins: ['lighthouse-plugin-publisher-ads'],
    settings,
  };
}

/**
 * @param {import('../../core/legacy/gather/connections/raw.js').Port} port
 * @return {RawConnection}
 */
function setUpWorkerConnection(port) {
  return new RawConnection(port);
}

/** @param {(status: [string, string, string]) => void} listenCallback */
function listenForStatus(listenCallback) {
  log.events.addListener('status', listenCallback);
  log.events.addListener('warning', listenCallback);
}

/**
 * Does a locale lookup but limits the result to the *canonical* Lighthouse
 * locales, which are only the locales with a messages locale file that can
 * be downloaded and then used via `registerLocaleData`.
 * @param {string|string[]=} locales
 * @return {LH.Locale}
 */
function lookupCanonicalLocale(locales) {
  return lookupLocale(locales, getCanonicalLocales());
}

/**
 * TODO: Expose api directly when DevTools usage is updated.
 * @param {string} url
 * @param {{page: LH.Puppeteer.Page, config?: LH.Config.Json, flags?: LH.Flags}} args
 */
function runLighthouseNavigation(url, {page, ...options}) {
  return navigation(page, url, options);
}

/**
 * TODO: Expose api directly when DevTools usage is updated.
 * @param {{page: LH.Puppeteer.Page, config?: LH.Config.Json, flags?: LH.Flags}} args
 */
function startLighthouseTimespan({page, ...options}) {
  return startTimespan(page, options);
}

/**
 * TODO: Expose api directly when DevTools usage is updated.
 * @param {{page: LH.Puppeteer.Page, config?: LH.Config.Json, flags?: LH.Flags}} args
 */
function runLighthouseSnapshot({page, ...options}) {
  return snapshot(page, options);
}

// Expose only in DevTools' worker
if (typeof self !== 'undefined') {
  // TODO: refactor and delete `global.isDevtools`.
  global.isDevtools = true;

  // @ts-expect-error
  self.setUpWorkerConnection = setUpWorkerConnection;
  // @ts-expect-error
  self.runLighthouse = legacyNavigation;
  // @ts-expect-error
  self.runLighthouseNavigation = runLighthouseNavigation;
  // @ts-expect-error
  self.navigation = navigation;
  // @ts-expect-error
  self.startLighthouseTimespan = startLighthouseTimespan;
  // @ts-expect-error
  self.startTimespan = startTimespan;
  // @ts-expect-error
  self.runLighthouseSnapshot = runLighthouseSnapshot;
  // @ts-expect-error
  self.snapshot = snapshot;
  // @ts-expect-error
  self.createConfig = createConfig;
  // @ts-expect-error
  self.listenForStatus = listenForStatus;
  // @ts-expect-error
  self.registerLocaleData = registerLocaleData;
  // TODO: expose as lookupCanonicalLocale in LighthouseService.ts?
  // @ts-expect-error
  self.lookupLocale = lookupCanonicalLocale;
} else {
  // For the bundle smoke test.
  // @ts-expect-error
  global.runBundledLighthouse = lighthouse;
  // @ts-expect-error
  global.runBundledLighthouseLegacyNavigation = legacyNavigation;
}
