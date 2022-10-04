/**
 * @license Copyright 2019 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import fs from 'fs';

import {LH_ROOT} from '../../../../root.js';

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyAudits: ['unused-javascript'],
  },
};

const mapJson =
  fs.readFileSync(`${LH_ROOT}/cli/test/fixtures/source-map/script.js.map`, 'utf-8');
const map = JSON.parse(mapJson);

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse values for source map artifacts.
 *
 * We have experienced timeouts in the past when fetching source maps.
 * We should verify the timing issue in Chromium if this gets flaky.
 */
const expectations = {
  artifacts: {
    SourceMaps: [
      {
        scriptUrl: 'http://localhost:10200/source-map/source-map-tester.html',
        sourceMapUrl: 'http://localhost:10200/source-map/script.js.map',
        map,
      },
      {
        scriptUrl: 'http://localhost:10200/source-map/source-map-tester.html',
        sourceMapUrl: 'http://localhost:10503/source-map/script.js.map',
        map,
      },
    ],
  },
  lhr: {
    requestedUrl: 'http://localhost:10200/source-map/source-map-tester.html',
    finalDisplayedUrl: 'http://localhost:10200/source-map/source-map-tester.html',
    audits: {},
  },
};

export default {
  id: 'source-maps',
  expectations,
  config,
};
