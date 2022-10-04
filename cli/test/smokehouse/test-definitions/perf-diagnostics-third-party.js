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
    requestedUrl: 'http://localhost:10200/perf/third-party.html',
    finalDisplayedUrl: 'http://localhost:10200/perf/third-party.html',
    audits: {
      'third-party-facades': {
        score: 0,
        displayValue: '1 facade alternative available',
        details: {
          items: [
            {
              product: 'YouTube Embedded Player (Video)',
              blockingTime: 0, // Note: Only 0 if the iframe was out-of-process
              subItems: {
                type: 'subitems',
                items: {
                  // Multiple session attach handling fixed in M105
                  // https://chromiumdash.appspot.com/commit/f42337f1d623ec913397610ccf01b5526e9e919d
                  _minChromiumVersion: '105',
                  length: '>5', // We don't care exactly how many it has, just ensure we surface the subresources.
                },
              },
            },
          ],
        },
      },
    },
  },
};

export default {
  id: 'perf-diagnostics-third-party',
  expectations,
  config,
};
