/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * @fileoverview The relationship between these CLI modules:
 *
 *   index.js     : only calls bin.js's begin()
 *   cli-flags.js : leverages yargs to read argv, outputs LH.CliFlags
 *   bin.js       : CLI args processing. cwd, list/print commands
 *   run.js       : chrome-launcher bits, calling core, output to Printer
 *
 *   index ---->    bin    ---->      run      ----> printer
 *                  ⭏  ⭎               ⭏  ⭎
 *               cli-flags        lh-core/index
 */

import fs from 'fs';
import path from 'path';
import url from 'url';

import log from 'lighthouse-logger';

import * as commands from './commands/commands.js';
import * as Printer from './printer.js';
import {getFlags} from './cli-flags.js';
import {runLighthouse} from './run.js';
import {generateConfig, generateLegacyConfig} from '../core/index.js';
import {askPermission} from './sentry-prompt.js';
import {LH_ROOT} from '../root.js';
import {Sentry} from '../core/lib/sentry.js';
import {getConfigDisplayString} from '../core/config/config.js';

const pkg = JSON.parse(fs.readFileSync(LH_ROOT + '/package.json', 'utf-8'));

/**
 * @return {boolean}
 */
function isDev() {
  return fs.existsSync(path.join(LH_ROOT, '/.git'));
}

/**
 * @return {Promise<LH.RunnerResult|void>}
 */
async function begin() {
  const cliFlags = getFlags();

  // Process terminating command
  if (cliFlags.listAllAudits) {
    commands.listAudits();
  }

  // Process terminating command
  if (cliFlags.listLocales) {
    commands.listLocales();
  }

  // Process terminating command
  if (cliFlags.listTraceCategories) {
    commands.listTraceCategories();
  }

  const urlUnderTest = cliFlags._[0];

  /** @type {LH.Config.Json|undefined} */
  let configJson;
  if (cliFlags.configPath) {
    // Resolve the config file path relative to where cli was called.
    cliFlags.configPath = path.resolve(process.cwd(), cliFlags.configPath);

    if (cliFlags.configPath.endsWith('.json')) {
      configJson = JSON.parse(fs.readFileSync(cliFlags.configPath, 'utf-8'));
    } else {
      const configModuleUrl = url.pathToFileURL(cliFlags.configPath).href;
      configJson = (await import(configModuleUrl)).default;
    }
  } else if (cliFlags.preset) {
    configJson = (await import(`../core/config/${cliFlags.preset}-config.js`)).default;
  }

  if (cliFlags.budgetPath) {
    cliFlags.budgetPath = path.resolve(process.cwd(), cliFlags.budgetPath);
    /** @type {Array<LH.Budget>} */
    const parsedBudget = JSON.parse(fs.readFileSync(cliFlags.budgetPath, 'utf8'));
    cliFlags.budgets = parsedBudget;
  }

  // set logging preferences
  cliFlags.logLevel = 'info';
  if (cliFlags.verbose) {
    cliFlags.logLevel = 'verbose';
  } else if (cliFlags.quiet) {
    cliFlags.logLevel = 'silent';
  }
  log.setLevel(cliFlags.logLevel);

  if (
    cliFlags.output.length === 1 &&
    cliFlags.output[0] === Printer.OutputMode.json &&
    !cliFlags.outputPath
  ) {
    cliFlags.outputPath = 'stdout';
  }

  if (cliFlags.precomputedLanternDataPath) {
    const lanternDataStr = fs.readFileSync(cliFlags.precomputedLanternDataPath, 'utf8');
    /** @type {LH.PrecomputedLanternData} */
    const data = JSON.parse(lanternDataStr);
    if (!data.additionalRttByOrigin || !data.serverResponseTimeByOrigin) {
      throw new Error('Invalid precomputed lantern data file');
    }

    cliFlags.precomputedLanternData = data;
  }

  if (cliFlags.printConfig) {
    if (cliFlags.legacyNavigation) {
      const config = await generateLegacyConfig(configJson, cliFlags);
      process.stdout.write(config.getPrintString());
    } else {
      const config = await generateConfig(configJson, cliFlags);
      process.stdout.write(getConfigDisplayString(config));
    }
    return;
  }

  // By default, cliFlags.enableErrorReporting is undefined so the user is
  // prompted. This can be overriden with an explicit flag or by the cached
  // answer returned by askPermission().
  if (typeof cliFlags.enableErrorReporting === 'undefined') {
    cliFlags.enableErrorReporting = await askPermission();
  }
  if (cliFlags.enableErrorReporting) {
    await Sentry.init({
      url: urlUnderTest,
      flags: cliFlags,
      environmentData: {
        serverName: 'redacted', // prevent sentry from using hostname
        environment: isDev() ? 'development' : 'production',
        release: pkg.version,
      },
    });
  }

  return runLighthouse(urlUnderTest, cliFlags, configJson);
}

export {
  begin,
};
