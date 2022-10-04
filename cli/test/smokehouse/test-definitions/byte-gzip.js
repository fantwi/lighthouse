/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
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
 * Expected Lighthouse results testing gzipped requests.
 */
const expectations = {
  lhr: {
    requestedUrl: 'http://localhost:10200/byte-efficiency/gzip.html',
    finalDisplayedUrl: 'http://localhost:10200/byte-efficiency/gzip.html',
    audits: {
      'network-requests': {
        details: {
          items: [
            {
              url: 'http://localhost:10200/byte-efficiency/gzip.html',
              finished: true,
            },
            {
              url: 'http://localhost:10200/byte-efficiency/script.js?gzip=1',
              transferSize: '1200 +/- 150',
              resourceSize: '53000 +/- 1000',
              finished: true,
            },
            {
              url: 'http://localhost:10200/byte-efficiency/script.js',
              transferSize: '53200 +/- 1000',
              resourceSize: '53000 +/- 1000',
              finished: true,
            },
            {
              url: 'http://localhost:10200/favicon.ico',
              finished: true,
            },
          ],
        },
      },
    },
  },
};

export default {
  id: 'byte-gzip',
  expectations,
  config,
  runSerially: true,
};
