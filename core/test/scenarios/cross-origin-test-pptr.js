/**
 * @license Copyright 2022 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import * as lighthouse from '../../api.js';
import {createTestState} from './pptr-test-utils.js';
import {LH_ROOT} from '../../../root.js';

/* eslint-env browser */

describe('Cross origin timespan', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120_000);

  const state = createTestState();

  state.installSetupAndTeardownHooks();

  before(() => {
    state.server.baseDir = state.secondaryServer.baseDir =
      `${LH_ROOT}/core/test/fixtures/fraggle-rock/css-change`;
  });

  it('should resolve all stylesheets', async () => {
    await state.page.goto(`${state.serverBaseUrl}/start.html`, {waitUntil: ['networkidle0']});

    const timespan = await lighthouse.startTimespan(state.page);
    await state.page.goto(`${state.secondaryServerBaseUrl}/end.html`);
    const result = await timespan.endTimespan();
    if (!result) throw new Error('Lighthouse did not return a result');

    // Ensure CSS usage didn't error.
    expect(result.artifacts.CSSUsage.stylesheets).toHaveLength(4);
    expect(result.lhr.audits['unused-css-rules'].score).not.toBeNull();
  });
});
