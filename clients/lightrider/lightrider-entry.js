/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/* global globalThis */

import {Buffer} from 'buffer';

import log from 'lighthouse-logger';
import {CDPBrowser} from 'puppeteer-core/lib/esm/puppeteer/common/Browser.js';
import {Connection as PptrConnection} from 'puppeteer-core/lib/esm/puppeteer/common/Connection.js';

import lighthouse, {legacyNavigation} from '../../core/index.js';
import {LighthouseError} from '../../core/lib/lh-error.js';
import {processForProto} from '../../core/lib/proto-preprocessor.js';
import * as assetSaver from '../../core/lib/asset-saver.js';
import mobileConfig from '../../core/config/lr-mobile-config.js';
import desktopConfig from '../../core/config/lr-desktop-config.js';

/** @type {Record<'mobile'|'desktop', LH.Config.Json>} */
const LR_PRESETS = {
  mobile: mobileConfig,
  desktop: desktopConfig,
};

/** @typedef {import('../../core/legacy/gather/connections/connection.js').Connection} Connection */

// Rollup seems to overlook some references to `Buffer`, so it must be made explicit.
// (`parseSourceMapFromDataUrl` breaks without this)
/** @type {BufferConstructor} */
globalThis.Buffer = Buffer;

/**
 * @param {Connection} connection
 * @return {Promise<LH.Puppeteer.Page>}
 */
async function getPageFromConnection(connection) {
  await connection.connect();
  const {targetInfo: mainTargetInfo} =
    await connection.sendCommand('Target.getTargetInfo', undefined);
  const {frameTree} = await connection.sendCommand('Page.getFrameTree', undefined);

  const pptrConnection = new PptrConnection(
    mainTargetInfo.url,
    // @ts-expect-error Hack to access the WRS transport layer.
    connection.channel_.root_.transport_
  );

  const browser = await CDPBrowser._create(
    'chrome',
    pptrConnection,
    [] /* contextIds */,
    false /* ignoreHTTPSErrors */,
    undefined /* defaultViewport */,
    undefined /* process */,
    undefined /* closeCallback */,
    targetInfo => targetInfo.targetId === mainTargetInfo.targetId
  );

  const pages = await browser.pages();
  const page = pages.find(p => p.mainFrame()._id === frameTree.frame.id);
  if (!page) throw new Error('Could not find relevant puppeteer page');

  // @ts-expect-error Page has a slightly different type when importing the browser module directly.
  return page;
}

/**
 * Run lighthouse for connection and provide similar results as in CLI.
 *
 * If configOverride is provided, lrDevice and categoryIDs are ignored.
 * @param {Connection} connection
 * @param {string} url
 * @param {LH.Flags} flags Lighthouse flags
 * @param {{lrDevice?: 'desktop'|'mobile', categoryIDs?: Array<string>, logAssets: boolean, configOverride?: LH.Config.Json, useFraggleRock?: boolean}} lrOpts Options coming from Lightrider
 * @return {Promise<string>}
 */
async function runLighthouseInLR(connection, url, flags, lrOpts) {
  const {lrDevice, categoryIDs, logAssets, configOverride} = lrOpts;

  // Certain fixes need to kick in under LR, see https://github.com/GoogleChrome/lighthouse/issues/5839
  global.isLightrider = true;

  // disableStorageReset because it causes render server hang
  flags.disableStorageReset = true;
  flags.logLevel = flags.logLevel || 'info';
  flags.channel = 'lr';

  let config;
  if (configOverride) {
    config = configOverride;
  } else {
    config = lrDevice === 'desktop' ? LR_PRESETS.desktop : LR_PRESETS.mobile;
    if (categoryIDs) {
      config.settings = config.settings || {};
      config.settings.onlyCategories = categoryIDs;
    }
  }

  try {
    let runnerResult;
    if (lrOpts.useFraggleRock) {
      const page = await getPageFromConnection(connection);
      runnerResult = await lighthouse(url, flags, config, page);
    } else {
      runnerResult = await legacyNavigation(url, flags, config, connection);
    }

    if (!runnerResult) throw new Error('Lighthouse finished without a runnerResult');

    // pre process the LHR for proto
    const preprocessedLhr = processForProto(runnerResult.lhr);

    // When LR is called with |internal: {keep_raw_response: true, save_lighthouse_assets: true}|,
    // we log artifacts to raw_response.artifacts.
    if (logAssets) {
      // Properly serialize artifact errors.
      const artifactsJson = JSON.stringify(runnerResult.artifacts, assetSaver.stringifyReplacer);

      return JSON.stringify({
        ...preprocessedLhr,
        artifacts: JSON.parse(artifactsJson),
      });
    }

    return JSON.stringify(preprocessedLhr);
  } catch (err) {
    // If an error ruined the entire lighthouse run, attempt to return a meaningful error.
    let runtimeError;
    if (!(err instanceof LighthouseError) || !err.lhrRuntimeError) {
      runtimeError = {
        code: LighthouseError.UNKNOWN_ERROR,
        message: `Unknown error encountered with message '${err.message}'`,
      };
    } else {
      runtimeError = {
        code: err.code,
        message: err.friendlyMessage ?
            `${err.friendlyMessage} (${err.message})` :
            err.message,
      };
    }

    return JSON.stringify({runtimeError}, null, 2);
  }
}

/** @param {(status: [string, string, string]) => void} listenCallback */
function listenForStatus(listenCallback) {
  log.events.addListener('status', listenCallback);
  log.events.addListener('warning', listenCallback);
}

// Expose on window for browser-residing consumers of file.
if (typeof window !== 'undefined') {
  // @ts-expect-error - not worth typing a property on `window`.
  window.runLighthouseInLR = runLighthouseInLR;
  // @ts-expect-error
  self.listenForStatus = listenForStatus;
}

export {
  runLighthouseInLR,
};
