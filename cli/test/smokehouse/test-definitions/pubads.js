/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  plugins: ['lighthouse-plugin-publisher-ads'],
};

/**
  * @type {Smokehouse.ExpectedRunnerResult}
  */
const expectations = {
  lhr: {
    requestedUrl: 'http://localhost:10200/online-only.html',
    finalDisplayedUrl: 'http://localhost:10200/online-only.html',
    // We should receive warnings about no ads being on the page.
    runWarnings: {length: '>0'},
    audits: {
      // We just want to ensure the plugin had a chance to run without error.
      'ad-render-blocking-resources': {scoreDisplayMode: 'notApplicable'},
    },
  },
};

export default {
  id: 'pubads',
  expectations,
  config,
};
