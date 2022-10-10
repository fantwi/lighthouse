/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import lighthouse, {getAuditList, legacyNavigation, traceCategories} from '../index.js';
import {LH_ROOT} from '../../root.js';
import {readJson} from './test-utils.js';

const pkg = readJson('package.json');

const TEST_DIR = `${LH_ROOT}/core/test`;

describe('Module Tests', function() {
  it('should have a main attribute defined in the package.json', function() {
    assert.ok(pkg.main);
  });

  it('should be able to require in the package.json\'s main file', function() {
    assert.ok(lighthouse);
  });

  it('should require lighthouse as a function', function() {
    assert.ok(typeof lighthouse === 'function');
  });

  it('should return a list of audits', function() {
    assert.ok(Array.isArray(getAuditList()));
  });

  it('should return a list of trace categories required by the driver', function() {
    const lighthouseTraceCategories = traceCategories;
    assert.ok(Array.isArray(lighthouseTraceCategories));
    assert.notEqual(lighthouseTraceCategories.length, 0);
  });

  describe('lighthouse', () => {
    it('should throw an error when the first parameter is not defined', async () => {
      const resultPromise = lighthouse();
      await expect(resultPromise).rejects.toThrow();
    });

    it('should throw an error when the first parameter is an empty string', async () => {
      const resultPromise = lighthouse('');
      await expect(resultPromise).rejects.toThrow();
    });

    it('should throw an error when the first parameter is not a string', async () => {
      const resultPromise = lighthouse({});
      await expect(resultPromise).rejects.toThrow();
    });

    it('should throw an error when the second parameter is not an object', async () => {
      const resultPromise = lighthouse('chrome://version', 'flags');
      await expect(resultPromise).rejects.toThrow();
    });

    it('should throw an error when the config is invalid', async () => {
      const resultPromise = lighthouse('chrome://version', {}, {});
      await expect(resultPromise).rejects.toThrow();
    });

    it('should throw an error when the config contains incorrect audits', async () => {
      const resultPromise = lighthouse('chrome://version', {}, {
        passes: [{
          gatherers: [
            'script-elements',
          ],
        }],
        audits: [
          'fluff',
        ],
      });
      await expect(resultPromise).rejects.toThrow();
    });

    it('should throw an error when the url is invalid', async () => {
      const resultPromise = lighthouse('i-am-not-valid', {}, {});
      await expect(resultPromise).rejects.toThrow('INVALID_URL');
    });

    it('should throw an error when the url is invalid protocol (file:///)', async () => {
      const resultPromise = lighthouse('file:///a/fake/index.html', {}, {});
      await expect(resultPromise).rejects.toThrow('INVALID_URL');
    });

    it('should return formatted LHR when given no categories', async () => {
      const exampleUrl = 'https://www.reddit.com/r/nba';
      const result = await lighthouse(exampleUrl, {
        output: 'html',
      }, {
        settings: {
          auditMode: TEST_DIR + '/fixtures/artifacts/perflog/',
          formFactor: 'mobile',
        },
        artifacts: [
          {id: 'MetaElements', gatherer: 'meta-elements'},
        ],
        audits: [
          'viewport',
        ],
      });

      assert.ok(/<html/.test(result.report), 'did not create html report');
      assert.ok(result.artifacts.ViewportDimensions, 'did not set artifacts');
      assert.ok(result.lhr.lighthouseVersion);
      assert.ok(result.lhr.fetchTime);
      assert.equal(result.lhr.finalDisplayedUrl, exampleUrl);
      assert.equal(result.lhr.requestedUrl, exampleUrl);
      assert.equal(Object.values(result.lhr.categories).length, 0);
      assert.ok(result.lhr.audits.viewport);
      assert.strictEqual(result.lhr.audits.viewport.score, 0);
      assert.ok(result.lhr.audits.viewport.explanation);
      assert.ok(result.lhr.timing);
      assert.ok(result.lhr.timing.entries.length > 3, 'timing entries not populated');
    });

    it('should specify the channel as node by default', async () => {
      const exampleUrl = 'https://www.reddit.com/r/nba';
      const result = await lighthouse(exampleUrl, {}, {
        settings: {
          auditMode: TEST_DIR + '/fixtures/artifacts/perflog/',
          formFactor: 'mobile',
        },
        audits: [],
      });
      assert.equal(result.lhr.configSettings.channel, 'node');
    });

    it('lets consumers pass in a custom channel', async () => {
      const exampleUrl = 'https://www.reddit.com/r/nba';
      const result = await lighthouse(exampleUrl, {}, {
        settings: {
          auditMode: TEST_DIR + '/fixtures/artifacts/perflog/',
          formFactor: 'mobile',
          channel: 'custom',
        },
        audits: [],
      });
      assert.equal(result.lhr.configSettings.channel, 'custom');
    });
  });

  describe('legacyNavigation', () => {
    it('should throw an error when the first parameter is not defined', function() {
      return legacyNavigation()
        .then(() => {
          throw new Error('Should not have resolved when first arg is not a string');
        }, err => {
          assert.ok(err);
        });
    });

    it('should throw an error when the first parameter is an empty string', function() {
      return legacyNavigation('')
        .then(() => {
          throw new Error('Should not have resolved when first arg is an empty string');
        }, err => {
          assert.ok(err);
        });
    });

    it('should throw an error when the first parameter is not a string', function() {
      return legacyNavigation({})
        .then(() => {
          throw new Error('Should not have resolved when first arg is not a string');
        }, err => {
          assert.ok(err);
        });
    });

    it('should throw an error when the second parameter is not an object', function() {
      return legacyNavigation('chrome://version', 'flags')
        .then(() => {
          throw new Error('Should not have resolved when second arg is not an object');
        }, err => {
          assert.ok(err);
        });
    });

    it('should throw an error when the config is invalid', function() {
      return legacyNavigation('chrome://version', {}, {})
        .then(() => {
          throw new Error('Should not have resolved when second arg is not an object');
        }, err => {
          assert.ok(err);
        });
    });

    it('should throw an error when the config contains incorrect audits', function() {
      return legacyNavigation('chrome://version', {}, {
        passes: [{
          gatherers: [
            'script-elements',
          ],
        }],
        audits: [
          'fluff',
        ],
      })
        .then(() => {
          throw new Error('Should not have resolved');
        }, err => {
          assert.ok(err.message.includes('fluff'));
        });
    });

    it('should throw an error when the url is invalid', async () => {
      expect.hasAssertions();
      try {
        await legacyNavigation('i-am-not-valid', {}, {});
      } catch (err) {
        expect(err.friendlyMessage).toBe('The URL you have provided appears to be invalid.');
        expect(err.code).toEqual('INVALID_URL');
      }
    });

    it('should throw an error when the url is invalid protocol (file:///)', async () => {
      expect.hasAssertions();
      try {
        await legacyNavigation('file:///a/fake/index.html', {}, {});
      } catch (err) {
        expect(err.friendlyMessage).toBe('The URL you have provided appears to be invalid.');
        expect(err.code).toEqual('INVALID_URL');
      }
    });

    it('should return formatted LHR when given no categories', function() {
      const exampleUrl = 'https://www.reddit.com/r/nba';
      return legacyNavigation(exampleUrl, {
        output: 'html',
      }, {
        settings: {
          auditMode: TEST_DIR + '/fixtures/artifacts/perflog/',
          formFactor: 'mobile',
        },
        audits: [
          'viewport',
        ],
      }).then(results => {
        assert.ok(/<html/.test(results.report), 'did not create html report');
        assert.ok(results.artifacts.ViewportDimensions, 'did not set artifacts');
        assert.ok(results.lhr.lighthouseVersion);
        assert.ok(results.lhr.fetchTime);
        assert.equal(results.lhr.finalDisplayedUrl, exampleUrl);
        assert.equal(results.lhr.requestedUrl, exampleUrl);
        assert.equal(Object.values(results.lhr.categories).length, 0);
        assert.ok(results.lhr.audits.viewport);
        assert.strictEqual(results.lhr.audits.viewport.score, 0);
        assert.ok(results.lhr.audits.viewport.explanation);
        assert.ok(results.lhr.timing);
        assert.ok(results.lhr.timing.entries.length > 3, 'timing entries not populated');
      });
    });

    it('should specify the channel as node by default', async function() {
      const exampleUrl = 'https://www.reddit.com/r/nba';
      const results = await legacyNavigation(exampleUrl, {}, {
        settings: {
          auditMode: TEST_DIR + '/fixtures/artifacts/perflog/',
          formFactor: 'mobile',
        },
        audits: [],
      });
      assert.equal(results.lhr.configSettings.channel, 'node');
    });

    it('lets consumers pass in a custom channel', async function() {
      const exampleUrl = 'https://www.reddit.com/r/nba';
      const results = await legacyNavigation(exampleUrl, {}, {
        settings: {
          auditMode: TEST_DIR + '/fixtures/artifacts/perflog/',
          formFactor: 'mobile',
          channel: 'custom',
        },
        audits: [],
      });
      assert.equal(results.lhr.configSettings.channel, 'custom');
    });
  });
});
