/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';
import {spawnSync} from 'child_process';

import {LH_ROOT} from '../../../root.js';

const indexPath = `${LH_ROOT}/cli/index.js`;

describe('CLI Tests', function() {
  it('fails if a url is not provided', () => {
    const ret = spawnSync('node', [indexPath], {encoding: 'utf8'});
    assert.ok(ret.stderr.includes('Please provide a url'));
    assert.equal(ret.status, 1);
  });

  it('should list options via --help', () => {
    const ret = spawnSync('node', [indexPath, '--help'], {encoding: 'utf8', maxBuffer: 10_000_000});
    expect(ret.stdout).toContain('lighthouse <url>');
    expect(ret.stdout).toContain('Examples:');
    // FIXME: yargs does not wait to flush stdout before exiting the process,
    // `--help` can flakily not contain the entire output when isTTY is false.
    // expect(ret.stdout).toContain('For more information on Lighthouse');
  });

  it('should list all audits without a url and exit immediately after', () => {
    const ret = spawnSync('node', [indexPath, '--list-all-audits'], {encoding: 'utf8'});

    const output = JSON.parse(ret.stdout);
    assert.ok(Array.isArray(output.audits));
    assert.ok(output.audits.length > 0);
  });

  it('accepts just the list-trace-categories flag and exit immediately after', () => {
    const ret = spawnSync('node', [indexPath, '--list-trace-categories'], {encoding: 'utf8'});

    const output = JSON.parse(ret.stdout);
    assert.ok(Array.isArray(output.traceCategories));
    assert.ok(output.traceCategories.length > 0);
  });

  it('accepts just the list-locales flag and exit immediately after', () => {
    const ret = spawnSync('node', [indexPath, '--list-locales'], {encoding: 'utf8'});

    const output = JSON.parse(ret.stdout);
    assert.ok(Array.isArray(output.locales));
    assert.ok(output.locales.length > 52);
    for (const lang of ['en', 'es', 'ru', 'zh']) {
      assert.ok(output.locales.includes(lang));
    }
  });

  describe('extra-headers', () => {
    it('should exit with a error if the path is not valid', () => {
      const ret = spawnSync('node', [indexPath, 'https://www.google.com',
        '--extra-headers=./fixtures/extra-headers/not-found.json'], {encoding: 'utf8'});

      assert.ok(ret.stderr.includes('no such file or directory'));
      assert.equal(ret.status, 1);
    });

    it('should exit with a error if the file does not contain valid JSON', () => {
      const ret = spawnSync('node', [indexPath, 'https://www.google.com',
        '--extra-headers',
        `${LH_ROOT}/cli/test/fixtures/extra-headers/invalid.txt`], {encoding: 'utf8'});

      assert.ok(ret.stderr.includes('Unexpected token'));
      assert.equal(ret.status, 1);
    });

    it('should exit with a error if the passsed in string is not valid JSON', () => {
      const ret = spawnSync('node', [indexPath, 'https://www.google.com',
        '--extra-headers', '{notjson}'], {encoding: 'utf8'});

      assert.ok(ret.stderr.includes('Unexpected token'));
      assert.equal(ret.status, 1);
    });
  });

  describe('print-config', () => {
    describe('fraggle rock', () => {
      it('should print the overridden config and exit immediately after', () => {
        const flags = [
          '--print-config', '-A',
          '--output', 'json',
          '--only-audits', 'metrics',
        ];
        const ret = spawnSync('node', [indexPath, ...flags], {encoding: 'utf8'});

        const config = JSON.parse(ret.stdout);
        assert.strictEqual(config.settings.output[0], 'json');
        assert.strictEqual(config.settings.auditMode, true);
        // FR config doesn't exclude full-page-screenshot with --only-audits
        assert.strictEqual(config.audits.length, 2);

        expect(config).toMatchSnapshot();
      });
    });

    it('should print the overridden config and exit immediately after', () => {
      const flags = [
        '--print-config', '-A',
        '--output', 'json',
        '--only-audits', 'charset',
        '--legacy-navigation',
      ];
      const ret = spawnSync('node', [indexPath, ...flags], {encoding: 'utf8'});

      const config = JSON.parse(ret.stdout);
      assert.strictEqual(config.settings.output[0], 'json');
      assert.strictEqual(config.settings.auditMode, true);
      assert.strictEqual(config.audits.length, 1);

      expect(config).toMatchSnapshot();
    });
  });

  describe('preset', () => {
    it('desktop should set appropriate config', () => {
      const ret = spawnSync('node', [indexPath, '--print-config', '--preset=desktop'], {
        encoding: 'utf8',
      });

      const config = JSON.parse(ret.stdout);
      const {emulatedUserAgent, formFactor, screenEmulation, throttling, throttlingMethod} =
        config.settings;
      const emulationSettings =
            {emulatedUserAgent, formFactor, screenEmulation, throttling, throttlingMethod};

      /* eslint-disable max-len */
      expect(emulationSettings).toMatchInlineSnapshot(`
        Object {
          "emulatedUserAgent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/98.0.4695.0 Safari/537.36 Chrome-Lighthouse",
          "formFactor": "desktop",
          "screenEmulation": Object {
            "deviceScaleFactor": 1,
            "disabled": false,
            "height": 940,
            "mobile": false,
            "width": 1350,
          },
          "throttling": Object {
            "cpuSlowdownMultiplier": 1,
            "downloadThroughputKbps": 0,
            "requestLatencyMs": 0,
            "rttMs": 40,
            "throughputKbps": 10240,
            "uploadThroughputKbps": 0,
          },
          "throttlingMethod": "simulate",
        }
      `);
      /* eslint-enable max-len */
    });
  });
});
