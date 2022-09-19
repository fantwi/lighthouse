/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/* global document */

import fs from 'fs';
import assert from 'assert';

import open from 'open';
import waitForExpect from 'wait-for-expect';
import puppeteer from 'puppeteer-core';
import yargs from 'yargs';
import {getChromePath} from 'chrome-launcher';

import {LH_ROOT} from '../../root.js';
import * as api from '../fraggle-rock/api.js';
import * as assetSaver from '../lib/asset-saver.js';

const ARTIFACTS_PATH =
  `${LH_ROOT}/core/test/fixtures/fraggle-rock/artifacts/sample-flow-artifacts.json`;
const FLOW_RESULT_PATH =
  `${LH_ROOT}/core/test/fixtures/fraggle-rock/reports/sample-flow-result.json`;
const FLOW_REPORT_PATH = `${LH_ROOT}/dist/sample-reports/flow-report/index.html`;

const args = yargs(process.argv.slice(2))
  .options({
    'view': {
      type: 'boolean',
      default: false,
    },
    'rebaseline-artifacts': {
      type: 'array',
    },
    'output-path': {
      type: 'string',
      default: FLOW_RESULT_PATH,
    },
  })
  .parseSync();

/** @param {LH.Puppeteer.Page} page */
async function waitForImagesToLoad(page) {
  const TIMEOUT = 30_000;
  const QUIET_WINDOW = 3_000;

  /** @return {Promise<Array<{src: string, complete: boolean}>>} */
  async function getImageLoadingStates() {
    return page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .map(img => ({
          src: img.src,
          complete: img.complete,
        }))
    );
  }

  await waitForExpect(async () => {
    // First check all images that are in the page are complete.
    const firstRunImages = await getImageLoadingStates();
    const completeImages = firstRunImages.filter(image => image.complete);
    assert.deepStrictEqual(completeImages, firstRunImages);

    // Next check we haven't added any new images in the quiet window.
    await page.waitForTimeout(QUIET_WINDOW);
    const secondRunImages = await getImageLoadingStates();
    assert.deepStrictEqual(secondRunImages, firstRunImages);
  }, TIMEOUT);
}

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    skipAudits: ['uses-http2'],
  },
};

/**
 * @param {(string|number)[]} artifactKeys
 */
async function rebaselineArtifacts(artifactKeys) {
  const browser = await puppeteer.launch({
    ignoreDefaultArgs: ['--enable-automation'],
    executablePath: getChromePath(),
    headless: false,
  });

  const page = await browser.newPage();
  const flow = await api.startFlow(page, {config});

  await flow.navigate('https://www.mikescerealshack.co');

  await flow.startTimespan({stepName: 'Search input'});
  await page.type('input', 'call of duty');
  const networkQuietPromise = page.waitForNavigation({waitUntil: ['networkidle0']});
  await page.click('button[type=submit]');
  await networkQuietPromise;
  await waitForImagesToLoad(page);
  await flow.endTimespan();

  await flow.snapshot({stepName: 'Search results'});

  await flow.navigate('https://www.mikescerealshack.co/corrections');

  await browser.close();

  let flowArtifacts = flow.createArtifactsJson();

  // Normalize some data so it doesn't change on every update.
  for (const {artifacts} of flowArtifacts.gatherSteps) {
    assetSaver.normalizeTimingEntries(artifacts.Timing);
  }

  if (artifactKeys.length) {
    const newFlowArtifacts = flowArtifacts;
    flowArtifacts = JSON.parse(fs.readFileSync(ARTIFACTS_PATH, 'utf-8'));
    for (let i = 0; i < flowArtifacts.gatherSteps.length; ++i) {
      const gatherStep = flowArtifacts.gatherSteps[i];
      const newGatherStep = newFlowArtifacts.gatherSteps[i];

      // Always update these three values
      gatherStep.config = newGatherStep.config;
      gatherStep.flags = newGatherStep.flags;
      gatherStep.name = newGatherStep.name;

      for (const key of artifactKeys) {
        // @ts-expect-error
        gatherStep.artifacts[key] = newGatherStep.artifacts[key];
      }
      flowArtifacts.gatherSteps[i] = gatherStep;
    }
  }

  fs.writeFileSync(ARTIFACTS_PATH, JSON.stringify(flowArtifacts, null, 2));
}

async function generateFlowResult() {
  /** @type {LH.UserFlow.FlowArtifacts} */
  const flowArtifacts = JSON.parse(fs.readFileSync(ARTIFACTS_PATH, 'utf-8'));
  const flowResult = await api.auditFlowArtifacts(flowArtifacts, config);

  // Normalize some data so it doesn't change on every update.
  for (const {lhr} of flowResult.steps) {
    assetSaver.normalizeTimingEntries(lhr.timing.entries);
    lhr.timing.total = lhr.timing.entries.length;
  }

  fs.writeFileSync(args.outputPath, JSON.stringify(flowResult, null, 2));

  if (args.view) {
    const htmlReport = await api.generateFlowReport(flowResult);
    fs.writeFileSync(FLOW_REPORT_PATH, htmlReport);
    open(FLOW_REPORT_PATH);
  }
}

if (args.rebaselineArtifacts) {
  await rebaselineArtifacts(args.rebaselineArtifacts);
}
await generateFlowResult();
