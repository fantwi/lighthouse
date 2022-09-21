/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import fs from 'fs';

import {LH_ROOT} from '../../../../root.js';
import WebAppManifest from '../../../gather/gatherers/web-app-manifest.js';
import {createMockSession} from '../mock-driver.js';

describe('WebAppManifest Gatherer', () => {
  let session = createMockSession();

  beforeEach(() => {
    session = createMockSession();
  });

  describe('.getAppManifest', () => {
    it('should return null when no manifest', async () => {
      session.sendCommand.mockResponse('Page.getAppManifest', {data: undefined, url: '/manifest'});
      const result = await WebAppManifest.fetchAppManifest(session.asSession());
      expect(result).toEqual(null);
    });

    it('should return the manifest', async () => {
      const manifest = {name: 'The App'};
      session.sendCommand.mockResponse('Page.getAppManifest', {
        data: JSON.stringify(manifest),
        url: '/manifest',
      });
      const result = await WebAppManifest.fetchAppManifest(session.asSession());
      expect(result).toEqual({data: JSON.stringify(manifest), url: '/manifest'});
    });

    it('should handle BOM-encoded manifest', async () => {
      const manifestWithoutBOM = fs
        .readFileSync(LH_ROOT + '/core/test/fixtures/manifest.json')
        .toString();
      const manifestWithBOM = fs
        .readFileSync(LH_ROOT + '/core/test/fixtures/manifest-bom.json')
        .toString();

      session.sendCommand.mockResponse('Page.getAppManifest', {
        data: manifestWithBOM,
        url: '/manifest',
      });
      const result = await WebAppManifest.fetchAppManifest(session.asSession());
      expect(result).toEqual({data: manifestWithoutBOM, url: '/manifest'});
    });
  });

  describe('.getWebAppManifest', () => {
    const MANIFEST_URL = 'https://example.com/manifest.json';
    const PAGE_URL = 'https://example.com/index.html';

    it('should return null when there is no manifest', async () => {
      session.sendCommand
        .mockResponse('Page.getAppManifest', {})
        .mockResponse('Page.getInstallabilityErrors', {installabilityErrors: []});
      const result = await WebAppManifest.getWebAppManifest(session.asSession(), PAGE_URL);
      expect(result).toEqual(null);
    });

    it('should parse the manifest when found', async () => {
      const manifest = {name: 'App'};
      session.sendCommand
        .mockResponse('Page.getAppManifest', {data: JSON.stringify(manifest), url: MANIFEST_URL})
        .mockResponse('Page.getInstallabilityErrors', {installabilityErrors: []});

      const result = await WebAppManifest.getWebAppManifest(session.asSession(), PAGE_URL);
      expect(result).toHaveProperty('raw', JSON.stringify(manifest));
      expect(result?.value).toMatchObject({
        name: {value: 'App', raw: 'App'},
        start_url: {value: PAGE_URL, raw: undefined},
      });
      expect(result?.url).toMatch(MANIFEST_URL);
    });
  });
});
