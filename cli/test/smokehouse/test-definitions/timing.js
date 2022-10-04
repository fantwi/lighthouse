/**
 * @license Copyright 2022 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyAudits: ['viewport'],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 */
const expectations = {
  artifacts: {
    Timing: {
      _includes: [
        {
          name: 'lh:runner:gather',
        },
      ],
    },
  },
  lhr: {
    requestedUrl: 'http://localhost:10200/simple-page.html',
    finalDisplayedUrl: 'http://localhost:10200/simple-page.html',
    audits: {},
    timing: {
      entries: {
        _includes: [
          {
            name: 'lh:runner:gather',
          },
          {
            name: 'lh:runner:audit',
          },
        ],
      },
    },
  },
};

export default {
  id: 'timing',
  expectations,
  config,
};
