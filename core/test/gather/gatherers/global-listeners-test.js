/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import GlobalListenerGatherer from '../../../gather/gatherers/global-listeners.js';
import {createMockSendCommandFn} from '../mock-commands.js';
import {Connection} from '../../../legacy/gather/connections/connection.js';
import {Driver} from '../../../legacy/gather/driver.js';

describe('Global Listener Gatherer', () => {
  it('remove duplicate listeners from artifacts', async () => {
    const globalListenerGatherer = new GlobalListenerGatherer();
    const mockListeners = [
      {
        type: 'unload',
        scriptId: 4,
        lineNumber: 10,
        columnNumber: 15,
      },
      {
        type: 'unload',
        scriptId: 4,
        lineNumber: 10,
        columnNumber: 15,
      },
      {
        type: 'unload',
        scriptId: 4,
        lineNumber: 10,
        columnNumber: 13,
      },
      {
        type: 'unload',
        scriptId: 5,
        lineNumber: 10,
        columnNumber: 13,
      },
    ];

    const sendCommandMock = createMockSendCommandFn()
        .mockResponse('Runtime.evaluate', {result: {objectId: 10}})
        .mockResponse('DOMDebugger.getEventListeners', {listeners: mockListeners.slice(0)});

    const expectedOutput = [
      mockListeners[0],
      mockListeners[2],
      mockListeners[3],
    ];

    const connectionStub = new Connection();
    connectionStub.sendCommand = sendCommandMock;
    const driver = new Driver(connectionStub);

    const globalListeners = await globalListenerGatherer.afterPass({driver});
    return expect(globalListeners).toMatchObject(expectedOutput);
  });
});
