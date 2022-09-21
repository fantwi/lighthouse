/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import InstallabilityErrors from '../../../gather/gatherers/installability-errors.js';
import {createMockSession} from '../mock-driver.js';

describe('.getInstallabilityErrors', () => {
  let session = createMockSession();

  beforeEach(() => {
    session = createMockSession();
  });

  it('should return the response from the protocol', async () => {
    session.sendCommand
      .mockResponse('Page.getInstallabilityErrors', {
        installabilityErrors: [{errorId: 'no-icon-available', errorArguments: []}],
      });

    const result = await InstallabilityErrors.getInstallabilityErrors(session.asSession());
    expect(result).toEqual({
      errors: [{errorId: 'no-icon-available', errorArguments: []}],
    });
  });
});
