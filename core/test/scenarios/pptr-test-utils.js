/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {before, beforeEach, after, afterEach} from 'mocha';
import puppeteer from 'puppeteer-core';
import {getChromePath} from 'chrome-launcher';

import {Server} from '../../../cli/test/fixtures/static-server.js';

/** @typedef {InstanceType<typeof import('../../../cli/test/fixtures/static-server.js').Server>} StaticServer */

/**
 * Some audits can be notApplicable based on machine timing information.
 * Exclude these audits from applicability comparisons.
 */
const FLAKY_AUDIT_IDS_APPLICABILITY = new Set([
  'long-tasks', // Depends on whether the longest task takes <50ms.
  'screenshot-thumbnails', // Depends on OS whether frames happen to be generated on non-visual timespan changes.
  'layout-shift-elements', // Depends on if the JS takes too long after input to be ignored for layout shift.
]);

function createTestState() {
  /** @param {string} name @return {any} */
  const any = name => new Proxy({}, {get: () => {
    throw new Error(`${name} used without invoking \`state.before\``);
  }});

  return {
    browser: /** @type {puppeteer.Browser} */ (any('browser')),
    page: /** @type {puppeteer.Page} */ (any('page')),
    server: /** @type {StaticServer} */ (any('server')),
    secondaryServer: /** @type {StaticServer} */ (any('server')),
    serverBaseUrl: '',
    secondaryServerBaseUrl: '',

    /**
     * @param {number=} port
     * @param {number=} secondaryPort
     */
    installServerHooks(port = 0, secondaryPort = 0) {
      before(async () => {
        this.server = new Server(port);
        this.secondaryServer = new Server(secondaryPort);
        await this.server.listen(port, '127.0.0.1');
        await this.secondaryServer.listen(secondaryPort, '127.0.0.1');
        this.serverBaseUrl = `http://localhost:${this.server.getPort()}`;
        this.secondaryServerBaseUrl = `http://localhost:${this.secondaryServer.getPort()}`;
      });

      after(async () => {
        await this.server.close();
        await this.secondaryServer.close();
      });
    },

    installSetupAndTeardownHooks() {
      this.installServerHooks();

      before(async () => {
        this.browser = await puppeteer.launch({
          headless: true,
          executablePath: getChromePath(),
          ignoreDefaultArgs: ['--enable-automation'],
        });
      });

      beforeEach(async () => {
        this.page = await this.browser.newPage();
      });

      afterEach(async () => {
        await this.page.close();
      });

      after(async () => {
        await this.browser.close();
      });
    },
  };
}

/**
 * @param {LH.Result} lhr
 */
function getAuditsBreakdown(lhr) {
  const auditResults = Object.values(lhr.audits);
  const irrelevantDisplayModes = new Set(['notApplicable', 'manual']);
  const applicableAudits = auditResults.filter(
    audit => !irrelevantDisplayModes.has(audit.scoreDisplayMode)
  );

  const notApplicableAudits = auditResults.filter(
    audit => (
      audit.scoreDisplayMode === 'notApplicable' &&
      !FLAKY_AUDIT_IDS_APPLICABILITY.has(audit.id)
    )
  );

  const informativeAudits = applicableAudits.filter(
    audit => audit.scoreDisplayMode === 'informative'
  );

  const erroredAudits = applicableAudits.filter(
    audit => audit.score === null && audit && !informativeAudits.includes(audit)
  );

  const failedAudits = applicableAudits.filter(audit => audit.score !== null && audit.score < 1);

  return {auditResults, erroredAudits, failedAudits, notApplicableAudits};
}

export {
  createTestState,
  getAuditsBreakdown,
};
