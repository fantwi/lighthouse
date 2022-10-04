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
    precomputedLanternData: {
      additionalRttByOrigin: {
        'http://localhost:10200': 500,
      },
      serverResponseTimeByOrigin: {
        'http://localhost:10200': 1000,
      },
    },
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 */
const expectations = {
  lhr: {
    requestedUrl: 'http://localhost:10200/ric-shim.html?short',
    finalDisplayedUrl: 'http://localhost:10200/ric-shim.html?short',
    audits: {
      'total-blocking-time': {
        // With the requestIdleCallback shim in place 1ms tasks should not block at all and should max add up to
        // 12.5 ms each, which would result in 50ms under a 4x simulated throttling multiplier and therefore in 0 tbt
        numericValue: '<=100',
      },
    },
  },
};

export default {
  id: 'lantern-idle-callback-short',
  expectations,
  config,
};
