/**
 * @license Copyright 2022 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 */
const expectations = {
  artifacts: {
    MainDocumentContent: /Redirect to myself/,
    URL: {
      requestedUrl: 'http://localhost:10200/redirects-self.html',
      mainDocumentUrl: 'http://localhost:10200/redirects-self.html?done=',
      finalDisplayedUrl: 'http://localhost:10200/redirects-self.html',
    },
  },
  lhr: {
    requestedUrl: 'http://localhost:10200/redirects-self.html',
    finalDisplayedUrl: 'http://localhost:10200/redirects-self.html',
    audits: {
    },
    runWarnings: [
      'The page may not be loading as expected because your test URL (http://localhost:10200/redirects-self.html) was redirected to http://localhost:10200/redirects-self.html?done=. Try testing the second URL directly.',
    ],
  },
};

export default {
  id: 'redirects-self',
  expectations,
};

