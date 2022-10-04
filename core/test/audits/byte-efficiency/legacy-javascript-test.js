/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import LegacyJavascript from '../../../audits/byte-efficiency/legacy-javascript.js';
import {networkRecordsToDevtoolsLog} from '../../network-records-to-devtools-log.js';
import {readJson} from '../../test-utils.js';

/**
 * @param {Array<{url: string, code: string, map?: LH.Artifacts.RawSourceMap}>} scripts
 * @return {Promise<LH.Audits.ByteEfficiencyProduct>}
 */
const getResult = scripts => {
  const mainDocumentUrl = 'https://www.example.com';
  const networkRecords = [
    {url: mainDocumentUrl, resourceType: 'Document'},
    ...scripts.map(({url}, index) => ({
      requestId: String(index),
      url,
    })),
  ];
  const artifacts = {
    GatherContext: {gatherMode: 'navigation'},
    URL: {finalDisplayedUrl: mainDocumentUrl, requestedUrl: mainDocumentUrl},
    devtoolsLogs: {defaultPass: networkRecordsToDevtoolsLog(networkRecords)},
    Scripts: scripts.map(({url, code}, index) => {
      return {
        scriptId: String(index),
        url,
        content: code,
        length: code.length,
      };
    }),
    SourceMaps: scripts.reduce((acc, {url, map}, index) => {
      if (!map) return acc;
      acc.push({
        scriptId: String(index),
        scriptUrl: url,
        map,
      });
      return acc;
    }, []),
  };
  return LegacyJavascript.audit_(artifacts, networkRecords, {computedCache: new Map()});
};

/**
 * @param {string[]} codeSnippets
 * @return {string[]}
 */
const createVariants = codeSnippets => {
  const variants = [];

  for (const codeSnippet of codeSnippets) {
    // Explicitly don't create a variant for just `codeSnippet`,
    // because making the patterns work with a starting anchor (^)
    // complicates the expressions more than its worth.
    variants.push(`;${codeSnippet}`);
    variants.push(` ${codeSnippet}`);
  }

  return variants;
};
describe('LegacyJavaScript audit', () => {
  it('passes code with no polyfills', async () => {
    const result = await getResult([
      {
        code: 'var message = "hello world"; console.log(message);',
        url: 'https://www.example.com/a.js',
      },
      {
        code: 'SomeGlobal = function() {}',
        url: 'https://www.example.com/a.js',
      },
      {
        code: 'SomeClass.prototype.someFn = function() {}',
        url: 'https://www.example.com/a.js',
      },
      {
        code: 'Object.defineProperty(SomeClass.prototype, "someFn", function() {})',
        url: 'https://www.example.com/a.js',
      },
    ]);
    expect(result.items).toHaveLength(0);
    expect(result.wastedBytesByUrl).toMatchInlineSnapshot(`Map {}`);
  });

  it('legacy polyfill in third party resource does not contribute to wasted bytes', async () => {
    const result = await getResult([
      {
        code: 'String.prototype.repeat = function() {}',
        url: 'https://www.googletagmanager.com/a.js',
      },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchInlineSnapshot(`
      Object {
        "subItems": Object {
          "items": Array [
            Object {
              "location": Object {
                "column": 0,
                "line": 0,
                "original": undefined,
                "type": "source-location",
                "url": "https://www.googletagmanager.com/a.js",
                "urlProvider": "network",
              },
              "signal": "String.prototype.repeat",
            },
          ],
          "type": "subitems",
        },
        "totalBytes": 0,
        "url": "https://www.googletagmanager.com/a.js",
        "wastedBytes": 20104,
      }
    `);
    expect(result.wastedBytesByUrl).toMatchInlineSnapshot(`Map {}`);
  });

  it('legacy polyfill in first party resource contributes to wasted bytes', async () => {
    const result = await getResult([
      {
        code: 'String.prototype.repeat = function() {}',
        url: 'https://www.example.com/a.js',
      },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].subItems.items[0].signal).toEqual('String.prototype.repeat');
    expect(result.wastedBytesByUrl).toMatchInlineSnapshot(`
      Map {
        "https://www.example.com/a.js" => 20104,
      }
    `);
  });

  it('fails code with multiple legacy polyfills', async () => {
    const result = await getResult([
      {
        code: 'String.prototype.repeat = function() {}; Array.prototype.includes = function() {}',
        url: 'https://www.example.com/a.js',
      },
    ]);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].subItems.items).toMatchObject([
      {signal: 'String.prototype.repeat'},
      {signal: 'Array.prototype.includes'},
    ]);
  });

  it('counts multiple of the same polyfill from the same script only once', async () => {
    const result = await getResult([
      {
        code: () => {
          // eslint-disable-next-line no-extend-native
          String.prototype.repeat = function() {};
          // eslint-disable-next-line no-extend-native
          Object.defineProperty(String.prototype, 'repeat', function() {});
        },
        url: 'https://www.example.com/a.js',
      },
    ]);
    expect(result.items).toHaveLength(1);
  });

  it('should identify polyfills in multiple patterns', async () => {
    const codeSnippets = [
      'String.prototype.repeat = function() {}',
      'String.prototype["repeat"] = function() {}',
      'String.prototype["repeat"] = function() {}',
      'Object.defineProperty(String.prototype, "repeat", function() {})',
      'Object.defineProperty(String.prototype, "repeat", function() {})',
      '$export($export.S,"Object",{values:function values(t){return i(t)}})',
      'String.raw = function() {}',
      // Currently are no polyfills that declare a class. Maybe in the future.
      // 'Object.defineProperty(window, \'WeakMap\', function() {})',
      // 'WeakMap = function() {}',
      // 'window.WeakMap = function() {}',
      // 'function WeakMap() {}',
    ];
    const variants = createVariants(codeSnippets);
    const scripts = variants.map((code, i) => {
      return {code, url: `https://www.example.com/${i}.js`};
    });
    const getCodeForUrl = url => scripts.find(script => script.url === url).code;
    const result = await getResult(scripts);

    expect(result.items.map(item => getCodeForUrl(item.url))).toEqual(
      scripts.map(script => getCodeForUrl(script.url))
    );
    expect(result.items).toHaveLength(variants.length);
  });

  it('should not misidentify legacy code', async () => {
    const codeSnippets = [
      'i.prototype.toArrayBuffer = blah',
      'this.childListChangeMap=void 0',
      't.toPromise=u,t.makePromise=u,t.fromPromise=function(e){return new o.default',
      'var n=new Error(h.apply(void 0,[d].concat(f)));n.name="Invariant Violation";',
      'var b=typeof Map==="function"?new Map():void 0',
      'd.Promise=s;var y,g,v,b=function(n,o,t){if(function(t){if("function"!=typeof t)th',
    ];
    const variants = createVariants(codeSnippets);
    const scripts = variants.map((code, i) => {
      return {code, url: `https://www.example.com/${i}.js`};
    });
    const getCodeForUrl = url => scripts.find(script => script.url === url).code;
    const result = await getResult(scripts);

    expect(result.items.map(item => getCodeForUrl(item.url))).toEqual([]);
    expect(result.items).toHaveLength(0);
  });

  it('uses source maps to identify polyfills', async () => {
    const map = {
      sources: ['node_modules/blah/blah/es6.string.repeat.js'],
      mappings: 'blah',
    };
    const script = {code: 'blah blah', url: 'https://www.example.com/0.js', map};
    const result = await getResult([script]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].subItems.items).toMatchObject([
      {
        signal: 'String.prototype.repeat',
        location: {line: 0, column: 0},
      },
    ]);
  });

  it('uses location from pattern matching over source map', async () => {
    const map = {
      sources: ['node_modules/blah/blah/es6.string.repeat.js'],
      mappings: 'blah',
    };
    const script = {
      code: 'some code;\nString.prototype.repeat = function() {}',
      url: 'https://www.example.com/0.js',
      map,
    };
    const result = await getResult([script]);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].subItems.items).toMatchObject([
      {
        signal: 'String.prototype.repeat',
        location: {line: 1, column: 0},
      },
    ]);
  });
});

describe('LegacyJavaScript signals', () => {
  it('expect babel-preset-env = true variant to not have any signals', () => {
    for (const summaryFilename of ['summary-signals.json', 'summary-signals-nomaps.json']) {
      const signalSummary =
        readJson(`core/scripts/legacy-javascript/${summaryFilename}`);
      const expectedMissingSignals = [
        'core-js-2-preset-env-esmodules/true',
        'core-js-3-preset-env-esmodules/true',
        'core-js-2-preset-env-esmodules/true-and-bugfixes',
        'core-js-3-preset-env-esmodules/true-and-bugfixes',
      ];
      for (const expectedVariant of expectedMissingSignals) {
        expect(signalSummary.variantsMissingSignals).toContain(expectedVariant);
      }
    }
  });
});
