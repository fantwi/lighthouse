/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {createMockSession} from '../mock-driver.js';
import * as dom from '../../../gather/driver/dom.js';

let sessionMock = createMockSession();

beforeEach(() => {
  sessionMock = createMockSession();
});

describe('.resolveNodeIdToObjectId', () => {
  it('resolves to the object id', async () => {
    sessionMock.sendCommand.mockResponse('DOM.resolveNode', {object: {objectId: 'one'}});
    const objectId = await dom.resolveNodeIdToObjectId(sessionMock.asSession(), 1);
    expect(objectId).toEqual('one');
  });

  it('handle missing nodes', async () => {
    sessionMock.sendCommand.mockRejectedValue(new Error('No node 1 found'));
    const objectId = await dom.resolveNodeIdToObjectId(sessionMock.asSession(), 1);
    expect(objectId).toEqual(undefined);
  });

  it('handle nodes in other documents', async () => {
    sessionMock.sendCommand.mockRejectedValue(new Error('Node 1 does not belong to the document'));
    const objectId = await dom.resolveNodeIdToObjectId(sessionMock.asSession(), 1);
    expect(objectId).toEqual(undefined);
  });

  it('raise other exceptions', async () => {
    const error = new Error('PROTOCOL_TIMEOUT');
    sessionMock.sendCommand.mockRejectedValue(error);
    await expect(dom.resolveNodeIdToObjectId(sessionMock.asSession(), 1)).rejects.toEqual(error);
  });
});

describe('.resolveDevtoolsNodePathToObjectId', () => {
  it('resolves to the object id', async () => {
    sessionMock.sendCommand
      .mockResponse('DOM.pushNodeByPathToFrontend', {nodeId: 1})
      .mockResponse('DOM.resolveNode', {object: {objectId: 'one'}});
    const objectId = await dom.resolveDevtoolsNodePathToObjectId(sessionMock.asSession(), 'div');
    expect(objectId).toEqual('one');
  });

  it('handle missing nodes', async () => {
    sessionMock.sendCommand.mockRejectedValue(new Error('No node 1 found'));
    const objectId = await dom.resolveDevtoolsNodePathToObjectId(sessionMock.asSession(), 'div');
    expect(objectId).toEqual(undefined);
  });

  it('handle nodes in other documents', async () => {
    sessionMock.sendCommand.mockRejectedValue(new Error('Node 1 does not belong to the document'));
    const objectId = await dom.resolveDevtoolsNodePathToObjectId(sessionMock.asSession(), 'div');
    expect(objectId).toEqual(undefined);
  });

  it('raise other exceptions', async () => {
    const error = new Error('PROTOCOL_TIMEOUT');
    sessionMock.sendCommand.mockRejectedValue(error);
    await expect(
      dom.resolveDevtoolsNodePathToObjectId(sessionMock.asSession(), 'div')
    ).rejects.toEqual(error);
  });
});
