/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['performance'],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 */
const expectations = {
  lhr: {
    requestedUrl: 'http://localhost:10200/perf/unsized-images.html',
    finalDisplayedUrl: 'http://localhost:10200/perf/unsized-images.html',
    audits: {
      'unsized-images': {
        score: 0,
        details: {
          items: [
            {
              node: {
                snippet: '<img src="../launcher-icon-100x100.png" width="100">',
              },
            },
            {
              node: {
                snippet: '<img src="../launcher-icon-100x100.png" height="100">',
              },
            },
            {
              node: {
                snippet: '<img src="../launcher-icon-100x100.png" style="width: 100;">',
              },
            },
            {
              node: {
                snippet: '<img src="../launcher-icon-100x100.png" style="height: 100;">',
              },
            },
            {
              node: {
                snippet: '<img src="../launcher-icon-100x100.png" style="aspect-ratio: 1 / 1;">',
              },
            },
            {
              node: {
                snippet: '<img src="../launcher-icon-100x100.png" style="width: 100; height: auto;">',
              },
            },
          ],
        },
      },
    },
  },
};

export default {
  id: 'perf-diagnostics-unsized-images',
  expectations,
  config,
};
