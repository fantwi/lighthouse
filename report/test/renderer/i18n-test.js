/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import {Util} from '../../renderer/util.js';
import {I18n} from '../../renderer/i18n.js';

// Require i18n to make sure Intl is polyfilled in Node without full-icu for testing.
// When Util is run in a browser, Intl will be supplied natively (IE11+).
// eslint-disable-next-line no-unused-vars
import '../../../core/lib/i18n/i18n.js';

const NBSP = '\xa0';

describe('util helpers', () => {
  it('formats a number', () => {
    const i18n = new I18n('en', {...Util.UIStrings});
    assert.strictEqual(i18n.formatNumber(10), '10');
    assert.strictEqual(i18n.formatNumber(100.01), '100.01');
    assert.strictEqual(i18n.formatNumber(13000.456), '13,000.456');
    assert.strictEqual(i18n.formatNumber(13000.456444), '13,000.456');

    assert.strictEqual(i18n.formatNumber(10, 0.1), '10.0');
    assert.strictEqual(i18n.formatNumber(100.01, 0.1), '100.0');
    assert.strictEqual(i18n.formatNumber(13000.456, 0.1), '13,000.5');

    assert.strictEqual(i18n.formatNumber(0), '0');
    assert.strictEqual(i18n.formatNumber(-0), '0');
    assert.strictEqual(i18n.formatNumber(-0, 0.1), '0.0');
    assert.strictEqual(i18n.formatNumber(0.000001), '0');
    assert.strictEqual(i18n.formatNumber(-0.000001), '0');
    assert.strictEqual(i18n.formatNumber(0.000001, 0.1), '0.0');
    assert.strictEqual(i18n.formatNumber(-0.000001, 0.1), '0.0');

    assert.strictEqual(i18n.formatNumber(10), '10');
    assert.strictEqual(i18n.formatNumber(100.01), '100.01');
    assert.strictEqual(i18n.formatNumber(13000.456, 0.1), '13,000.5');

    assert.strictEqual(i18n.formatInteger(10), '10');
    assert.strictEqual(i18n.formatInteger(100.01), '100');
    assert.strictEqual(i18n.formatInteger(13000.6), '13,001');
  });

  it('formats a date', () => {
    const i18n = new I18n('en', {...Util.UIStrings});
    const timestamp = i18n.formatDateTime('2017-04-28T23:07:51.189Z');
    assert.ok(
      timestamp.includes('Apr 27, 2017') ||
      timestamp.includes('Apr 28, 2017') ||
      timestamp.includes('Apr 29, 2017')
    );
  });

  it('formats bytes', () => {
    const i18n = new I18n('en', {...Util.UIStrings});
    assert.equal(i18n.formatBytesToKiB(100), `0.098${NBSP}KiB`);
    assert.equal(i18n.formatBytesToKiB(100, 0.1), `0.1${NBSP}KiB`);
    assert.equal(i18n.formatBytesToKiB(2000, 0.1), `2.0${NBSP}KiB`);
    assert.equal(i18n.formatBytesToKiB(1014 * 1024, 0.1), `1,014.0${NBSP}KiB`);
  });

  it('formats bytes with different granularities', () => {
    const i18n = new I18n('en', {...Util.UIStrings});

    let granularity = 10;
    assert.strictEqual(i18n.formatBytes(15.0, granularity), `20${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(15.12345, granularity), `20${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(14.99999, granularity), `10${NBSP}bytes`);

    granularity = 1;
    assert.strictEqual(i18n.formatBytes(15.0, granularity), `15${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(15.12345, granularity), `15${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(15.54321, granularity), `16${NBSP}bytes`);

    granularity = 0.1;
    assert.strictEqual(i18n.formatBytes(15.0, granularity), `15.0${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(15.12345, granularity), `15.1${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(15.19999, granularity), `15.2${NBSP}bytes`);

    granularity = 0.01;
    assert.strictEqual(i18n.formatBytes(15.0, granularity), `15.00${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(15.12345, granularity), `15.12${NBSP}bytes`);
    assert.strictEqual(i18n.formatBytes(15.19999, granularity), `15.20${NBSP}bytes`);
  });

  it('formats bytes with invalid granularity', () => {
    const i18n = new I18n('en', {...Util.UIStrings});
    const granularity = 0.5;
    const originalWarn = console.warn;

    try {
      console.warn = () => {};
      assert.strictEqual(i18n.formatBytes(15.0, granularity), `15${NBSP}bytes`);
      assert.strictEqual(i18n.formatBytes(15.12345, granularity), `15${NBSP}bytes`);
      assert.strictEqual(i18n.formatBytes(15.54321, granularity), `16${NBSP}bytes`);
    } finally {
      console.warn = originalWarn;
    }
  });

  it('formats kibibytes with different granularities', () => {
    const i18n = new I18n('en', {...Util.UIStrings});

    let granularity = 10;
    assert.strictEqual(i18n.formatBytesToKiB(5 * 1024, granularity), `10${NBSP}KiB`);
    assert.strictEqual(i18n.formatBytesToKiB(4 * 1024, granularity), `0${NBSP}KiB`);

    granularity = 1;
    assert.strictEqual(i18n.formatBytesToKiB(5 * 1024, granularity), `5${NBSP}KiB`);
    assert.strictEqual(i18n.formatBytesToKiB(4 * 1024 + 512, granularity), `5${NBSP}KiB`);
    assert.strictEqual(i18n.formatBytesToKiB(4 * 1024 + 511, granularity), `4${NBSP}KiB`);

    granularity = 0.01;
    assert.strictEqual(i18n.formatBytesToKiB(5 * 1024, granularity), `5.00${NBSP}KiB`);
    assert.strictEqual(i18n.formatBytesToKiB(5 * 1024 - 5, granularity), `5.00${NBSP}KiB`);
    assert.strictEqual(i18n.formatBytesToKiB(5 * 1024 - 6, granularity), `4.99${NBSP}KiB`);
  });

  it('formats ms', () => {
    const i18n = new I18n('en', {...Util.UIStrings});
    assert.equal(i18n.formatMilliseconds(123, 10), `120${NBSP}ms`);
    assert.equal(i18n.formatMilliseconds(2456.5, 0.1), `2,456.5${NBSP}ms`);
    assert.equal(i18n.formatMilliseconds(0.000001), `0${NBSP}ms`);
    assert.equal(i18n.formatMilliseconds(-0.000001), `0${NBSP}ms`);
  });

  it('formats a duration', () => {
    const i18n = new I18n('en', {...Util.UIStrings});
    assert.equal(i18n.formatDuration(60 * 1000), '1m');
    assert.equal(i18n.formatDuration(60 * 60 * 1000 + 5000), '1h 5s');
    assert.equal(i18n.formatDuration(28 * 60 * 60 * 1000 + 5000), '1d 4h 5s');
  });

  it('formats a duration based on locale', () => {
    let i18n = new I18n('de', {...Util.UIStrings});
    assert.equal(i18n.formatDuration(60 * 1000), `1${NBSP}Min.`);
    assert.equal(i18n.formatDuration(60 * 60 * 1000 + 5000), `1${NBSP}Std. 5${NBSP}Sek.`);
    assert.equal(
      i18n.formatDuration(28 * 60 * 60 * 1000 + 5000), `1${NBSP}T 4${NBSP}Std. 5${NBSP}Sek.`);

    // Yes, this is actually backwards (s h d).
    i18n = new I18n('ar', {...Util.UIStrings});
    /* eslint-disable no-irregular-whitespace */
    assert.equal(i18n.formatDuration(60 * 1000), `١${NBSP}د`);
    assert.equal(i18n.formatDuration(60 * 60 * 1000 + 5000), `١${NBSP}س ٥${NBSP}ث`);
    assert.equal(i18n.formatDuration(28 * 60 * 60 * 1000 + 5000), `١ ي ٤ س ٥ ث`);
    /* eslint-enable no-irregular-whitespace */
  });

  it('formats numbers based on locale', () => {
    // Requires full-icu or Intl polyfill.
    const number = 12346.858558;

    const i18n = new I18n('de', {...Util.UIStrings});
    assert.strictEqual(i18n.formatNumber(number), '12.346,859');
    assert.strictEqual(i18n.formatBytesToKiB(number, 0.1), `12,1${NBSP}KiB`);
    assert.strictEqual(i18n.formatMilliseconds(number, 10), `12.350${NBSP}ms`);
    assert.strictEqual(i18n.formatSeconds(number), `12,347${NBSP}Sek.`);
  });

  it('uses decimal comma with en-XA test locale', () => {
    // Requires full-icu or Intl polyfill.
    const number = 12346.858558;

    const i18n = new I18n('en-XA', {...Util.UIStrings});
    assert.strictEqual(i18n.formatNumber(number), '12.346,859');
    assert.strictEqual(i18n.formatBytesToKiB(number, 0.1), `12,1${NBSP}KiB`);
    assert.strictEqual(i18n.formatMilliseconds(number, 100), `12.300${NBSP}ms`);
    assert.strictEqual(i18n.formatSeconds(number, 1), `12${NBSP}Sek.`);
  });

  it('should not crash on unknown locales', () => {
    const i18n = new I18n('unknown-mystery-locale', {...Util.UIStrings});
    const timestamp = i18n.formatDateTime('2017-04-28T23:07:51.189Z');
    assert.ok(
      timestamp.includes('Apr 27, 2017') ||
      timestamp.includes('Apr 28, 2017') ||
      timestamp.includes('Apr 29, 2017')
    );
  });
});
