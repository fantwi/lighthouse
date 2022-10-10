/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import UnusedJavaScript from '../../../audits/byte-efficiency/unused-javascript.js';
import {networkRecordsToDevtoolsLog} from '../../network-records-to-devtools-log.js';
import {createScript, loadSourceMapAndUsageFixture} from '../../test-utils.js';

const scriptUrlToId = new Map();

/**
 * @param {string} url
 */
function getScriptId(url) {
  let id = scriptUrlToId.get(url);
  if (!id) {
    id = String(scriptUrlToId.size + 1);
    scriptUrlToId.set(url, id);
  }
  return id;
}

/**
 * @param {string} url
 * @param {number} transferSize
 * @param {LH.Crdp.Network.ResourceType} resourceType
 */
function generateRecord(url, transferSize, resourceType) {
  return {url, transferSize, resourceType};
}

/**
 * @param {string} url
 * @param {Array<[number, number, number]>} ranges
 * @return {Crdp.Profiler.ScriptCoverage}
 */
function generateUsage(url, ranges) {
  const functions = ranges.map(range => {
    return {
      ranges: [
        {
          startOffset: range[0],
          endOffset: range[1],
          count: range[2] ? 1 : 0,
        },
      ],
    };
  });

  return {scriptId: getScriptId(url), url, functions};
}

function makeJsUsage(...usages) {
  return usages.reduce((acc, cur) => {
    acc[cur.scriptId] = cur;
    return acc;
  }, {});
}

describe('UnusedJavaScript audit', () => {
  const domain = 'https://www.google.com';
  const scriptUnknown = generateUsage(domain, [[0, 3000, false]]);
  const scriptA = generateUsage(`${domain}/scriptA.js`, [[0, 100, true]]);
  const scriptB = generateUsage(`${domain}/scriptB.js`, [[0, 200, true], [0, 50, false]]);
  const inlineA = generateUsage(`${domain}/inline.html`, [[0, 5000, true], [5000, 6000, false]]);
  const inlineB = generateUsage(`${domain}/inline.html`, [[0, 15000, true], [0, 5000, false]]);
  const recordA = generateRecord(`${domain}/scriptA.js`, 35000, 'Script');
  const recordB = generateRecord(`${domain}/scriptB.js`, 50000, 'Script');
  const recordInline = generateRecord(`${domain}/inline.html`, 1000000, 'Document');

  it('should work', async () => {
    const context = {
      computedCache: new Map(),
      options: {
        // Lower the threshold so we don't need huge resources to make a test.
        unusedThreshold: 2000,
      },
    };
    const networkRecords = [recordA, recordB, recordInline];
    const artifacts = {
      Scripts: [scriptA, scriptB, scriptUnknown, inlineA, inlineB]
        .map((usage) => createScript({...usage, functions: undefined})),
      JsUsage: makeJsUsage(scriptA, scriptB, scriptUnknown, inlineA, inlineB),
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog(networkRecords)},
      SourceMaps: [],
    };
    const result = await UnusedJavaScript.audit_(artifacts, networkRecords, context);
    expect(result.items.map(item => item.url)).toEqual([
      'https://www.google.com/scriptB.js',
      'https://www.google.com/inline.html',
    ]);

    // Only two scripts should meet the unused bytes threshold.
    expect(result.items).toHaveLength(2);

    const scriptBWaste = result.items[0];
    assert.equal(scriptBWaste.url, `${domain}/scriptB.js`);
    assert.equal(scriptBWaste.totalBytes, 50000);
    assert.equal(scriptBWaste.wastedBytes, 12500);
    assert.equal(scriptBWaste.wastedPercent, 25);

    const inlineBWaste = result.items[1];
    assert.equal(inlineBWaste.url, `${domain}/inline.html`);
    assert.equal(inlineBWaste.totalBytes, 15000);
    assert.equal(inlineBWaste.wastedBytes, 5000);
    assert.equal(Math.round(inlineBWaste.wastedPercent), 33);
  });

  it('should augment when provided source maps', async () => {
    const context = {
      computedCache: new Map(),
      options: {
        // Lower the threshold so we don't need huge resources to make a test.
        unusedThreshold: 2000,
        // Default threshold is 512, but is lowered here so that squoosh generates more
        // results.
        bundleSourceUnusedThreshold: 100,
      },
    };
    const {map, content, usage} = loadSourceMapAndUsageFixture('squoosh');
    const url = 'https://squoosh.app/main-app.js';
    const networkRecords = [generateRecord(url, content.length, 'Script')];
    const artifacts = {
      JsUsage: makeJsUsage(usage),
      devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog(networkRecords)},
      SourceMaps: [{scriptId: 'squoosh', scriptUrl: url, map}],
      Scripts: [{scriptId: 'squoosh', url, content}].map(createScript),
    };
    const result = await UnusedJavaScript.audit_(artifacts, networkRecords, context);

    expect(result.items).toMatchInlineSnapshot(`
      Array [
        Object {
          "subItems": Object {
            "items": Array [
              Object {
                "source": "(unmapped)",
                "sourceBytes": 10062,
                "sourceWastedBytes": 3760,
              },
              Object {
                "source": "…src/codecs/webp/encoder-meta.ts",
                "sourceBytes": 660,
                "sourceWastedBytes": 660,
              },
              Object {
                "source": "…src/lib/util.ts",
                "sourceBytes": 4043,
                "sourceWastedBytes": 500,
              },
              Object {
                "source": "…src/custom-els/RangeInput/index.ts",
                "sourceBytes": 2138,
                "sourceWastedBytes": 293,
              },
              Object {
                "source": "…node_modules/comlink/comlink.js",
                "sourceBytes": 4117,
                "sourceWastedBytes": 256,
              },
            ],
            "type": "subitems",
          },
          "totalBytes": 83748,
          "url": "https://squoosh.app/main-app.js",
          "wastedBytes": 6961,
          "wastedPercent": 8.312435814764395,
        },
      ]
    `);
  });
});
