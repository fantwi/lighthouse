/**
 * @license Copyright 2022 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import * as lighthouse from '../../api.js';
import {createTestState, getAuditsBreakdown} from './pptr-test-utils.js';
import {LH_ROOT} from '../../../root.js';

/* eslint-env browser */

describe('Start/End navigation', function() {
  // eslint-disable-next-line no-invalid-this
  this.timeout(120_000);

  const state = createTestState();

  state.installSetupAndTeardownHooks();

  before(() => {
    state.server.baseDir = `${LH_ROOT}/core/test/fixtures/fraggle-rock/navigation-basic`;
  });

  it('should capture a navigation via user interaction', async () => {
    const pageUrl = `${state.serverBaseUrl}/links-to-index.html`;
    await state.page.goto(pageUrl, {waitUntil: ['networkidle0']});

    const flow = await lighthouse.startFlow(state.page);

    await flow.startNavigation();
    await state.page.click('a');
    await flow.endNavigation();

    const flowResult = await flow.createFlowResult();
    const flowArtifacts = await flow.createArtifactsJson();
    const lhr = flowResult.steps[0].lhr;
    const artifacts = flowArtifacts.gatherSteps[0].artifacts;

    expect(artifacts.URL).toEqual({
      requestedUrl: `${state.serverBaseUrl}/?redirect=/index.html`,
      mainDocumentUrl: `${state.serverBaseUrl}/index.html`,
      finalDisplayedUrl: `${state.serverBaseUrl}/index.html`,
    });

    expect(lhr.requestedUrl).toEqual(`${state.serverBaseUrl}/?redirect=/index.html`);
    expect(lhr.finalDisplayedUrl).toEqual(`${state.serverBaseUrl}/index.html`);

    const {erroredAudits} = getAuditsBreakdown(lhr);
    expect(erroredAudits).toHaveLength(0);
  });
});
