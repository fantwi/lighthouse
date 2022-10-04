/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    formFactor: 'desktop',
    screenEmulation: {
      width: 1024,
      height: 768,
      deviceScaleFactor: 1,
      mobile: false,
      disabled: false,
    },
  },
};

const elements = {
  body: {
    top: 8,
    bottom: 1008,
    left: 8,
    right: 1008,
    width: 1000,
    height: 1000,
  },
  p: {
    top: 8,
    left: 8,
    height: '>40',
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 */
const expectations = {
  artifacts: {
    FullPageScreenshot: {
      screenshot: {
        width: '>1000',
        height: '>1000',
        data: /data:image\/webp;base64,.{10000,}$/,
      },
      nodes: {
        _includes: [
          ['page-0-P', elements.p],
          [/[0-9]-[0-9]-BODY/, elements.body],
          [/[0-9]-[0-9]-P/, elements.p],
          [/[0-9]-[0-9]-HTML/, {}],
        ],
      },
    },
  },
  lhr: {
    requestedUrl: 'http://localhost:10200/screenshot.html?width=1000px&height=1000px',
    finalDisplayedUrl: 'http://localhost:10200/screenshot.html?width=1000px&height=1000px',
    audits: {},
  },
};

export default {
  id: 'screenshot',
  expectations,
  config,
};
