/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

const BASE_URL = 'http://localhost:10200/seo/';

/** @type {LH.Config.Json} */
const config = {
  extends: 'lighthouse:default',
  settings: {
    onlyCategories: ['seo'],
  },
};

/**
 * @type {Smokehouse.ExpectedRunnerResult}
 * Expected Lighthouse audit values for a site served with http status 403.
 */
const expectations = {
  lhr: {
    // Note: most scores are null (audit error) because the page 403ed.
    requestedUrl: BASE_URL + 'seo-failure-cases.html?status_code=403',
    finalDisplayedUrl: BASE_URL + 'seo-failure-cases.html?status_code=403',
    userAgent: /Chrom(e|ium)/, // Ensure we still collect base artifacts when page fails to load.
    runtimeError: {
      code: 'ERRORED_DOCUMENT_REQUEST',
      message: /Status code: 403/,
    },
    runWarnings: ['Lighthouse was unable to reliably load the page you requested. Make sure you are testing the correct URL and that the server is properly responding to all requests. (Status code: 403)'],
    audits: {
      'http-status-code': {
        score: null,
      },
      'viewport': {
        score: null,
      },
      'document-title': {
        score: null,
      },
      'meta-description': {
        score: null,
      },
      'font-size': {
        score: null,
      },
      'crawlable-anchors': {
        score: null,
      },
      'link-text': {
        score: null,
      },
      'is-crawlable': {
        score: null,
      },
      'hreflang': {
        score: null,
      },
      'plugins': {
        score: null,
      },
      'canonical': {
        score: null,
      },
    },
  },
};

export default {
  id: 'seo-status-403',
  expectations,
  config,
};
