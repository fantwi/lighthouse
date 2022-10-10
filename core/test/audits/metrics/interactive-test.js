/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import Interactive from '../../../audits/metrics/interactive.js';
import * as constants from '../../../config/constants.js';
import {readJson} from '../../test-utils.js';

const acceptableTrace = readJson('../../fixtures/traces/progressive-app-m60.json', import.meta);
const acceptableDevToolsLog = readJson('../../fixtures/traces/progressive-app-m60.devtools.log.json', import.meta);
const redirectTrace = readJson('../../fixtures/traces/site-with-redirect.json', import.meta);
const redirectDevToolsLog = readJson('../../fixtures/traces/site-with-redirect.devtools.log.json', import.meta);

const options = Interactive.defaultOptions;

/**
 * @param {{
 * {LH.SharedFlagsSettings['formFactor']} formFactor
 * {LH.SharedFlagsSettings['throttlingMethod']} throttlingMethod
 * }} param0
 */
const getFakeContext = ({formFactor, throttlingMethod}) => ({
  options: options,
  computedCache: new Map(),
  settings: {
    formFactor: formFactor,
    throttlingMethod,
    screenEmulation: constants.screenEmulationMetrics[formFactor],
  },
});
describe('Performance: interactive audit', () => {
  it('should compute interactive', () => {
    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      traces: {
        [Interactive.DEFAULT_PASS]: acceptableTrace,
      },
      devtoolsLogs: {
        [Interactive.DEFAULT_PASS]: acceptableDevToolsLog,
      },
    };

    const context = getFakeContext({formFactor: 'mobile', throttlingMethod: 'provided'});
    return Interactive.audit(artifacts, context).then(output => {
      assert.equal(output.score, 1);
      assert.equal(Math.round(output.numericValue), 1582);
      expect(output.displayValue).toBeDisplayString('1.6\xa0s');
    });
  });

  it('should compute interactive on pages with redirect', () => {
    const artifacts = {
      GatherContext: {gatherMode: 'navigation'},
      traces: {
        [Interactive.DEFAULT_PASS]: redirectTrace,
      },
      devtoolsLogs: {
        [Interactive.DEFAULT_PASS]: redirectDevToolsLog,
      },
    };

    const context = getFakeContext({formFactor: 'mobile', throttlingMethod: 'provided'});
    return Interactive.audit(artifacts, context).then(output => {
      assert.equal(output.score, 0.97);
      assert.equal(Math.round(output.numericValue), 2712);
      expect(output.displayValue).toBeDisplayString('2.7\xa0s');
    });
  });
});
