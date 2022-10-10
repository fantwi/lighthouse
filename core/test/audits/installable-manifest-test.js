/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import InstallableManifestAudit from '../../audits/installable-manifest.js';
import {parseManifest} from '../../lib/manifest-parser.js';
import {readJson} from '../test-utils.js';

const manifest = readJson('../fixtures/manifest.json', import.meta);
const manifestDirtyJpg = readJson('../fixtures/manifest-dirty-jpg.json', import.meta);

const manifestSrc = JSON.stringify(manifest);
const manifestDirtyJpgSrc = JSON.stringify(manifestDirtyJpg);
const EXAMPLE_MANIFEST_URL = 'https://example.com/manifest.json';
const EXAMPLE_DOC_URL = 'https://example.com/index.html';

function generateMockArtifacts(src = manifestSrc) {
  const exampleManifest = parseManifest(src, EXAMPLE_MANIFEST_URL, EXAMPLE_DOC_URL);

  const clonedArtifacts = JSON.parse(JSON.stringify({
    WebAppManifest: exampleManifest,
    InstallabilityErrors: {errors: []},
    URL: {finalDisplayedUrl: 'https://example.com'},
  }));
  return clonedArtifacts;
}
function generateMockAuditContext() {
  return {
    computedCache: new Map(),
  };
}
describe('PWA: webapp install banner audit', () => {
  describe('basics', () => {
    it('fails if page had no manifest', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'no-manifest', errorArguments: []});
      artifacts.WebAppManifest = null;
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        assert.ok(items[0].reason.formattedDefault.includes('no manifest'));
      });
    });

    it('passes when manifest url matches', () => {
      const artifacts = generateMockArtifacts();
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(artifacts.WebAppManifest.url, EXAMPLE_MANIFEST_URL);
        const debugData = result.details.debugData;
        assert.strictEqual(debugData.manifestUrl, EXAMPLE_MANIFEST_URL);
      });
    });

    it('fails with a non-parsable manifest', () => {
      const artifacts = generateMockArtifacts('{,:}');
      artifacts.InstallabilityErrors.errors.push({errorId: 'manifest-empty', errorArguments: []});
      const context = generateMockAuditContext();
      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toBeDisplayString(/could not be parsed/);
      });
    });

    it('fails when an empty manifest is present', () => {
      const artifacts = generateMockArtifacts('{}');
      artifacts.InstallabilityErrors.errors.push({errorId: 'manifest-empty', errorArguments: []});
      const context = generateMockAuditContext();
      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toBeDisplayString(/is empty/);
      });
    });

    it('passes with complete manifest and SW', () => {
      const context = generateMockAuditContext();
      return InstallableManifestAudit.audit(generateMockArtifacts(), context).then(result => {
        assert.strictEqual(result.score, 1, result.explanation);
        assert.strictEqual(result.explanation, undefined, result.explanation);
      });
    });
  });

  describe('one-off-failures', () => {
    it('fails when a manifest contains no start_url', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'no-url-for-service-worker',
        errorArguments: []});
      artifacts.WebAppManifest.value.start_url.value = undefined;
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toBeDisplayString(/without a 'start_url'/);
      });
    });

    it('fails when a manifest contains no name or short_name', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'manifest-missing-name-or-short-name',
        errorArguments: []});
      artifacts.WebAppManifest.value.name.value = undefined;
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toBeDisplayString(/does not contain a 'name'/);
      });
    });

    it('fails if page had no icons in the manifest', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'manifest-missing-suitable-icon',
        errorArguments: [{name: 'minimum-icon-size-in-pixels', value: '144'}]});
      artifacts.WebAppManifest.value.icons.value = [];
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toBeDisplayString(/does not contain a suitable icon/);
      });
    });

    it('fails if page had no fetchable icons in the manifest', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'cannot-download-icon',
        errorArguments: []});
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toBeDisplayString(/Could not download a required icon from/);
      });
    });
  });

  describe('installability error handling', () => {
    it('fails when InstallabilityError doesnt have enough errorArguments', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'manifest-missing-suitable-icon',
        errorArguments: []});
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toMatch(/number of arguments/);
      });
    });

    it('fails when InstallabilityError contains too many errorArguments', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'manifest-missing-suitable-icon',
        errorArguments: [{name: 'argument-1', value: '144'}, {name: 'argument-2', value: '144'}]});
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        expect(items[0].reason).toMatch(/unexpected arguments/);
      });
    });

    it('fails when we receive an unknown InstallabilityError id', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'new-error-id', errorArguments: []});
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 0);
        const items = result.details.items;
        assert.ok(items[0].reason.formattedDefault.includes('is not recognized'));
      });
    });

    it('ignores in-incognito InstallabilityError', () => {
      const artifacts = generateMockArtifacts();
      artifacts.InstallabilityErrors.errors.push({errorId: 'in-incognito', errorArguments: []});
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        assert.strictEqual(result.score, 1);
      });
    });

    it('adds scheme to invalid scheme error message', async () => {
      const artifacts = generateMockArtifacts();
      artifacts.WebAppManifest.url = 'data:application/json;base64,AAAAAAAAAA';
      artifacts.InstallabilityErrors.errors.push({
        errorId: 'scheme-not-supported-for-webapk',
        errorArguments: [],
      });
      const context = generateMockAuditContext();

      const result = await InstallableManifestAudit.audit(artifacts, context);
      expect(result.score).toEqual(0);
      expect(result.details.items[0].reason).toBeDisplayString(
        'The manifest URL scheme (data:) is not supported on Android.'
      );
    });

    it('ignores invalid scheme error if there was no manifest url', async () => {
      const artifacts = generateMockArtifacts();
      artifacts.WebAppManifest = undefined;
      artifacts.InstallabilityErrors.errors.push(
        {errorId: 'no-manifest', errorArguments: []},
        {errorId: 'scheme-not-supported-for-webapk', errorArguments: []}
      );
      const context = generateMockAuditContext();

      const result = await InstallableManifestAudit.audit(artifacts, context);
      expect(result.score).toEqual(0);
      expect(result.details.items).toHaveLength(1);
      expect(result.details.items[0].reason).toBeDisplayString(
        'Page has no manifest <link> URL'
      );
    });
  });

  describe('warnings', () => {
    it('presents a warning if a warn-not-offline-capable if present', () => {
      const artifacts = generateMockArtifacts(manifestDirtyJpgSrc);
      artifacts.InstallabilityErrors.errors.push({errorId: 'warn-not-offline-capable'});
      const context = generateMockAuditContext();

      return InstallableManifestAudit.audit(artifacts, context).then(result => {
        expect(result.warnings).toHaveLength(1);
        expect(result.warnings[0]).toBeDisplayString(/not work offline.*August 2021/);
      });
    });
  });

  it('fails if icons were present, but no valid PNG present', () => {
    const artifacts = generateMockArtifacts(manifestDirtyJpgSrc);
    artifacts.InstallabilityErrors.errors.push({errorId: 'manifest-missing-suitable-icon',
      errorArguments: [{name: 'minimum-icon-size-in-pixels', value: '144'}]});
    const context = generateMockAuditContext();

    return InstallableManifestAudit.audit(artifacts, context).then(result => {
      assert.strictEqual(result.score, 0);
      const items = result.details.items;
      expect(items[0].reason).toBeDisplayString(/PNG/);
    });
  });
});
