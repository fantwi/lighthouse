/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {createMockSession} from '../mock-driver.js';
import * as storage from '../../../gather/driver/storage.js';

let sessionMock = createMockSession();

beforeEach(() => {
  sessionMock = createMockSession();
});

describe('.clearDataForOrigin', () => {
  it('only clears data from certain locations', async () => {
    let foundStorageTypes;
    sessionMock.sendCommand.mockResponse('Storage.clearDataForOrigin', ({storageTypes}) => {
      foundStorageTypes = storageTypes;
    });
    await storage.clearDataForOrigin(sessionMock.asSession(), 'https://example.com');
    // Should not see cookies, websql, indexeddb, or local_storage.
    // Cookies are not cleared to preserve login.
    // websql, indexeddb, and local_storage are not cleared to preserve important user data.
    expect(foundStorageTypes).toMatchInlineSnapshot(
      `"file_systems,shader_cache,service_workers,cache_storage"`
    );
  });
});

describe('.getImportantDataWarning', () => {
  it('properly returns warning', async () => {
    sessionMock.sendCommand.mockResponse('Storage.getUsageAndQuota', {
      usageBreakdown: [
        {storageType: 'local_storage', usage: 5},
        {storageType: 'indexeddb', usage: 5},
        {storageType: 'websql', usage: 0},
        {storageType: 'cookies', usage: 5},
        {storageType: 'file_systems', usage: 5},
        {storageType: 'shader_cache', usage: 5},
        {storageType: 'service_workers', usage: 5},
        {storageType: 'cache_storage', usage: 0},
      ],
    });
    const warning = await storage.getImportantStorageWarning(
      sessionMock.asSession(),
      'https://example.com'
    );
    expect(warning).toBeDisplayString(
      'There may be stored data affecting loading performance in ' +
        'these locations: Local Storage, IndexedDB. ' +
        'Audit this page in an incognito window to prevent those resources ' +
        'from affecting your scores.'
    );
  });

  it('only warn for certain locations', async () => {
    sessionMock.sendCommand.mockResponse('Storage.getUsageAndQuota', {
      usageBreakdown: [
        {storageType: 'local_storage', usage: 0},
        {storageType: 'indexeddb', usage: 0},
        {storageType: 'websql', usage: 0},
        {storageType: 'cookies', usage: 5},
        {storageType: 'file_systems', usage: 5},
        {storageType: 'shader_cache', usage: 5},
        {storageType: 'service_workers', usage: 5},
        {storageType: 'cache_storage', usage: 5},
      ],
    });
    const warning = await storage.getImportantStorageWarning(
      sessionMock.asSession(),
      'https://example.com'
    );
    expect(warning).toBeUndefined();
  });
});
