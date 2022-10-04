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
    requestedUrl: 'http://localhost:10200/ric-shim.html?long',
    finalDisplayedUrl: 'http://localhost:10200/ric-shim.html?long',
    audits: {
      'total-blocking-time': {
        // With a 4x throttling multiplier in place each 50ms task takes 200ms, which results in 150ms blocking time
        // each. We iterate ~40 times, so the true amount of blocking time we expect is ~6s, but
        // sometimes Chrome's requestIdleCallback won't fire the full 40 if the machine is under load,
        // so be generous with how much slack to give in the expectations.
        numericValue: '>2500',
      },
    },
  },
};

export default {
  id: 'lantern-idle-callback-long',
  expectations,
  config,
};
