/**
 * @license Copyright 2017 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */
'use strict';

/* eslint-disable no-irregular-whitespace */

import assert from 'assert/strict';
import fs from 'fs';

import csvValidator from 'csv-validator';

import {ReportGenerator} from '../../generator/report-generator.js';
import {readJson} from '../../../core/test/test-utils.js';

const sampleResults = readJson('core/test/results/sample_v2.json');

describe('ReportGenerator', () => {
  describe('#replaceStrings', () => {
    it('should replace all occurrences', () => {
      const source = '%foo! %foo %bar!';
      const result = ReportGenerator.replaceStrings(source, [
        {search: '%foo', replacement: 'hey'},
        {search: '%bar', replacement: 'you'},
      ]);

      assert.equal(result, 'hey! hey you!');
    });

    it('should not replace serial occurences', () => {
      const result = ReportGenerator.replaceStrings('%1', [
        {search: '%1', replacement: '%2'},
        {search: '%2', replacement: 'pwnd'},
      ]);

      assert.equal(result, '%2');
    });
  });

  describe('#generateHtmlReport', () => {
    it('should return html', () => {
      const result = ReportGenerator.generateReportHtml({});
      assert.ok(result.includes('doctype html'), 'includes doctype');
      assert.ok(result.trim().match(/<\/html>$/), 'ends with HTML tag');
    });

    it('should inject the report JSON', () => {
      const code = 'hax\u2028hax</script><script>console.log("pwned");%%LIGHTHOUSE_JAVASCRIPT%%';
      const result = ReportGenerator.generateReportHtml({code});
      assert.ok(result.includes('"code":"hax\\u2028'), 'injects the json');
      assert.ok(result.includes('hax\\u003c/script'), 'escapes HTML tags');
      assert.ok(result.includes('LIGHTHOUSE_JAVASCRIPT'), 'cannot be tricked');
    });

    it('should inject the report CSS', () => {
      const result = ReportGenerator.generateReportHtml({});
      assert.ok(!result.includes('/*%%LIGHTHOUSE_CSS%%*/'));
      assert.ok(result.includes('--color-green'));
    });

    it('should inject the report renderer javascript', () => {
      const result = ReportGenerator.generateReportHtml({});
      assert.ok(result.includes('configSettings.channel||"unknown"'), 'injects the script');
      assert.ok(result.includes('robustness: <\\/script'), 'escapes HTML tags in javascript');
      assert.ok(result.includes('pre$`post'), 'does not break from String.replace');
      assert.ok(result.includes('LIGHTHOUSE_JSON'), 'cannot be tricked');
    });
  });

  describe('#generateReport', () => {
    it('creates JSON for results', () => {
      const jsonOutput = ReportGenerator.generateReport(sampleResults, 'json');
      assert.doesNotThrow(_ => JSON.parse(jsonOutput));
    });

    it('creates HTML for results', () => {
      const htmlOutput = ReportGenerator.generateReport(sampleResults, 'html');
      assert.ok(/<!doctype/gim.test(htmlOutput));
      assert.ok(/<html lang="en"/gim.test(htmlOutput));
    });

    it('creates CSV for results', async () => {
      const path = './.results-as-csv.csv';

      const csvOutput = ReportGenerator.generateReport(sampleResults, 'csv');
      fs.writeFileSync(path, csvOutput);

      const lines = csvOutput.split('\n');
      expect(lines.length).toBeGreaterThan(100);
      expect(lines.slice(0, 15).join('\n')).toMatchInlineSnapshot(`
"\\"requestedUrl\\",\\"finalDisplayedUrl\\",\\"fetchTime\\",\\"gatherMode\\"
\\"http://localhost:10200/dobetterweb/dbw_tester.html\\",\\"http://localhost:10200/dobetterweb/dbw_tester.html\\",\\"2021-09-07T20:11:11.853Z\\",\\"navigation\\"

category,score
\\"performance\\",\\"0.26\\"
\\"accessibility\\",\\"0.78\\"
\\"best-practices\\",\\"0.27\\"
\\"seo\\",\\"0.67\\"
\\"pwa\\",\\"0.33\\"

category,audit,score,displayValue,description
\\"performance\\",\\"first-contentful-paint\\",\\"0.01\\",\\"6.8 s\\",\\"First Contentful Paint marks the time at which the first text or image is painted. [Learn more about the First Contentful Paint metric](https://web.dev/first-contentful-paint/).\\"
\\"performance\\",\\"interactive\\",\\"0.41\\",\\"8.2 s\\",\\"Time to Interactive is the amount of time it takes for the page to become fully interactive. [Learn more about the Time to Interactive metric](https://web.dev/interactive/).\\"
\\"performance\\",\\"speed-index\\",\\"0.21\\",\\"8.1 s\\",\\"Speed Index shows how quickly the contents of a page are visibly populated. [Learn more about the Speed Index metric](https://web.dev/speed-index/).\\"
\\"performance\\",\\"total-blocking-time\\",\\"0.2\\",\\"1,220 ms\\",\\"Sum of all time periods between FCP and Time to Interactive, when task length exceeded 50ms, expressed in milliseconds. [Learn more about the Total Blocking Time metric](https://web.dev/lighthouse-total-blocking-time/).\\"
"
`);

      try {
        await csvValidator(path);
      } catch (err) {
        assert.fail('CSV parser error:\n' + err.join('\n'));
      } finally {
        fs.unlinkSync(path);
      }
    });

    it('creates CSV for results including categories', () => {
      const csvOutput = ReportGenerator.generateReport(sampleResults, 'csv');
      expect(csvOutput).toContain('performance');
      expect(csvOutput).toContain('accessibility');
      expect(csvOutput).toContain('best-practices');
      expect(csvOutput).toContain('seo');
      expect(csvOutput).toContain('pwa');
    });

    it('writes extended info', () => {
      const htmlOutput = ReportGenerator.generateReport(sampleResults, 'html');
      const outputCheck = new RegExp('dobetterweb/dbw_tester.css', 'i');
      assert.ok(outputCheck.test(htmlOutput));
    });
  });

  it('handles array of outputs', () => {
    const [json, html] = ReportGenerator.generateReport(sampleResults, ['json', 'html']);
    assert.doesNotThrow(_ => JSON.parse(json));
    assert.ok(/<!doctype/gim.test(html));
    assert.ok(/<html lang="en"/gim.test(html));
  });
});
