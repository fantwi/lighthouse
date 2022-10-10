/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import Audit from '../../audits/content-width.js';
import * as constants from '../../config/constants.js';

/** @param {LH.SharedFlagsSettings['formFactor']} formFactor */
const getFakeContext = (formFactor = 'mobile') => ({
  computedCache: new Map(),
  settings: {
    formFactor: formFactor,
    screenEmulation: constants.screenEmulationMetrics[formFactor],
  },
});

describe('Mobile-friendly: content-width audit', () => {
  it('fails when scroll width differs from viewport width', () => {
    const product = Audit.audit({
      ViewportDimensions: {
        innerWidth: 100,
        outerWidth: 300,
      },
    }, getFakeContext());

    assert.equal(product.score, 0);
    assert.ok(product.explanation);
  });

  it('passes when widths match', () => {
    return assert.equal(Audit.audit({
      HostUserAgent: '',
      ViewportDimensions: {
        innerWidth: 300,
        outerWidth: 300,
      },
    }, getFakeContext()).score, 1);
  });

  it('not applicable when run on desktop', () => {
    const product = Audit.audit({
      ViewportDimensions: {
        innerWidth: 300,
        outerWidth: 450,
      },
    }, getFakeContext('desktop'));

    assert.equal(product.notApplicable, true);
  });
});
