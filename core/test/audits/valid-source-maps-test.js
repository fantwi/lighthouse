/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {createScript, loadSourceMapFixture} from '../test-utils.js';
import ValidSourceMaps from '../../audits/valid-source-maps.js';

const largeBundle = loadSourceMapFixture('coursehero-bundle-1');
const smallBundle = loadSourceMapFixture('coursehero-bundle-2');
const LARGE_JS_BYTE_THRESHOLD = 500 * 1024;

if (largeBundle.content.length < LARGE_JS_BYTE_THRESHOLD) {
  const error = {message: 'largeBundle is not large enough'};
  throw error;
}

if (smallBundle.content.length >= LARGE_JS_BYTE_THRESHOLD) {
  const error = {message: 'smallBundle is not small enough'};
  throw error;
}

describe('Valid source maps audit', () => {
  it('passes when no script elements or source maps are provided', async () => {
    const artifacts = {
      URL: {finalDisplayedUrl: 'https://example.com'},
      Scripts: [],
      SourceMaps: [],
    };

    const auditResult = await ValidSourceMaps.audit(artifacts);
    expect(auditResult.score).toEqual(1);
  });

  it('passes when all large, first-party JS have corresponding source maps', async () => {
    const artifacts = {
      URL: {finalDisplayedUrl: 'https://example.com'},
      Scripts: [
        {scriptId: '1', url: 'https://example.com/script1.min.js', content: largeBundle.content},
        {scriptId: '2', url: 'https://example.com/script2.min.js', content: largeBundle.content},
      ].map(createScript),
      SourceMaps: [
        {scriptId: '1', scriptUrl: 'https://example.com/script1.min.js', map: largeBundle.map},
        {scriptId: '2', scriptUrl: 'https://example.com/script2.min.js', map: largeBundle.map},
      ],
    };

    const auditResult = await ValidSourceMaps.audit(artifacts);
    expect(auditResult.score).toEqual(1);
  });

  it('fails when any large, first-party JS has no corresponding source map', async () => {
    const artifacts = {
      URL: {finalDisplayedUrl: 'https://example.com'},
      Scripts: [
        {scriptId: '1', url: 'https://example.com/script1.min.js', content: largeBundle.content},
        {scriptId: '2', url: 'https://example.com/script2.min.js', content: largeBundle.content},
      ].map(createScript),
      SourceMaps: [
        {scriptId: '1', scriptUrl: 'https://example.com/script1.min.js', map: largeBundle.map},
        //  Missing corresponding source map for large, first-party JS (script2.min.js)
      ],
    };

    const auditResult = await ValidSourceMaps.audit(artifacts);
    expect(auditResult.details.items[0].subItems.items.length).toEqual(1);
    expect(auditResult.details.items[0].subItems.items[0].error).toBeDisplayString(
      'Large JavaScript file is missing a source map');
    expect(auditResult.score).toEqual(0);
  });

  it('passes when small, first-party JS have no corresponding source maps', async () => {
    const artifacts = {
      URL: {finalDisplayedUrl: 'https://example.com'},
      Scripts: [
        {scriptId: '1', url: 'https://example.com/script1.min.js', content: largeBundle.content},
        {scriptId: '2', url: 'https://example.com/script2.min.js', content: smallBundle.content},
      ].map(createScript),
      SourceMaps: [
        {scriptId: '1', scriptUrl: 'https://example.com/script1.min.js', map: largeBundle.map},
        //  Missing corresponding source map for small, first-party JS (script2.min.js)
      ],
    };

    const auditResult = await ValidSourceMaps.audit(artifacts);
    expect(auditResult.score).toEqual(1);
  });

  it('passes when large, third-party JS have no corresponding source maps', async () => {
    const artifacts = {
      URL: {finalDisplayedUrl: 'https://example.com'},
      Scripts: [
        {scriptId: '1', url: 'https://example.com/script1.min.js', content: largeBundle.content},
        {scriptId: '2', url: 'https://d36mpcpuzc4ztk.cloudfront.net/script2.js', content: largeBundle.content},
      ].map(createScript),
      SourceMaps: [
        {scriptId: '1', scriptUrl: 'https://example.com/script1.min.js', map: largeBundle.map},
      ],
    };

    const auditResult = await ValidSourceMaps.audit(artifacts);
    expect(auditResult.score).toEqual(1);
  });

  it('discovers missing source map contents while passing', async () => {
    const bundleNormal = loadSourceMapFixture('squoosh');
    const bundleWithMissingContent = loadSourceMapFixture('squoosh');
    delete bundleWithMissingContent.map.sourcesContent[0];

    const artifacts = {
      URL: {finalDisplayedUrl: 'https://example.com'},
      Scripts: [
        {scriptId: '1', url: 'https://example.com/script1.min.js', content: bundleNormal.content},
        {scriptId: '2', url: 'https://example.com/script2.min.js', content: bundleWithMissingContent.content},
      ].map(createScript),
      SourceMaps: [
        {scriptId: '1', scriptUrl: 'https://example.com/script1.min.js', map: bundleNormal.map},
        {scriptId: '2', scriptUrl: 'https://example.com/script2.min.js', map: bundleWithMissingContent.map},
      ],
    };

    const auditResult = await ValidSourceMaps.audit(artifacts);

    // The first result should warn there's a missing source map item
    expect(auditResult.details.items[0].subItems.items.length).toEqual(1);
    expect(auditResult.details.items[0].subItems.items[0].error).toBeDisplayString(
      'Warning: missing 1 item in `.sourcesContent`');

    // The second result should have no warnings
    expect(auditResult.details.items[1].subItems.items.length).toEqual(0);

    // The audit should pass because these warnings don't affect your score
    expect(auditResult.score).toEqual(1);
  });

  it('discovers missing source map contents while failing', async () => {
    const bundleWithMissingContent = loadSourceMapFixture('squoosh');
    delete bundleWithMissingContent.map.sourcesContent[0];

    const artifacts = {
      URL: {finalDisplayedUrl: 'https://example.com'},
      Scripts: [
        {scriptId: '1', url: 'https://example.com/script1.min.js', content: bundleWithMissingContent.content},
        {scriptId: '2', url: 'https://example.com/script2.min.js', content: largeBundle.content},
      ].map(createScript),
      SourceMaps: [
        {scriptId: '1', scriptUrl: 'https://example.com/script1.min.js', map: bundleWithMissingContent.map},
      ],
    };

    const auditResult = await ValidSourceMaps.audit(artifacts);

    // The first result should be the one that fails the audit
    expect(auditResult.details.items[0].subItems.items.length).toEqual(1);
    expect(auditResult.details.items[0].subItems.items[0].error).toBeDisplayString(
      'Large JavaScript file is missing a source map');

    // The second result should warn there's a missing source map item
    expect(auditResult.details.items[1].subItems.items.length).toEqual(1);
    expect(auditResult.details.items[1].subItems.items[0].error).toBeDisplayString(
      'Warning: missing 1 item in `.sourcesContent`');

    expect(auditResult.score).toEqual(0);
  });
});
