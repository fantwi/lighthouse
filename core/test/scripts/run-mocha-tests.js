/**
 * @license Copyright 2022 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/**
 * @fileoverview
 * CLI tool for running mocha tests. Run with `yarn mocha`
 */

import fs from 'fs';
import path from 'path';
import {Worker, isMainThread, parentPort, workerData} from 'worker_threads';
import {once} from 'events';

import Mocha from 'mocha';
import yargs from 'yargs';
import * as yargsHelpers from 'yargs/helpers';
import glob from 'glob';

import {LH_ROOT} from '../../../root.js';
import {mochaGlobalSetup, mochaGlobalTeardown} from '../test-env/mocha-setup.js';

const failedTestsDir = `${LH_ROOT}/.tmp/failing-tests`;

if (!isMainThread && parentPort) {
  // Worker.
  const {test, mochaArgs, numberMochaInvocations} = workerData;
  const numberFailures = await runMocha([test], mochaArgs, numberMochaInvocations);
  parentPort?.postMessage({type: 'result', numberFailures});
  process.exit(0);
}

/** @param {string} text */
function escapeRegex(text) {
  return text.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
}

function getFailedTests() {
  const allFailedTests = [];
  for (const file of glob.sync('*.json', {cwd: failedTestsDir, absolute: true})) {
    allFailedTests.push(...JSON.parse(fs.readFileSync(file, 'utf-8')));
  }
  return allFailedTests;
}

// Some tests replace real modules with mocks in the global scope of the test file
// (outside 'before' lifecycle / a test unit). Before doing any lifecycle stuff, Mocha will load
// all test files (everything if --no-parallel, else each worker will load a subset of the files
// all at once). This results in unexpected mocks contaminating other test files.
//
// Tests do other undesired things in the global scope too, such as enabling fake timers.
//
// For now, we isolate a number of tests until they can be refactored.
//
// To run tests without isolation, and all in one process:
//    yarn mocha --no-isolation --no-parallel core/test
//
// Because mocha workers can divide up test files that mess with global scope in a way that
// _just happens_ to not cause anything to fail, use this command to verify that
// all necessary tests are isolated:
//    yarn mocha --no-parallel
// (also, just comment out the `testsToRunIsolated` below, as they won't impact this verification)
const testsToIsolate = new Set([
  // grep -lRE '^timers\.useFakeTimers' --include='*-test.*' --exclude-dir=node_modules
  'flow-report/test/common-test.tsx',
  'core/test/fraggle-rock/gather/session-test.js',
  'core/test/legacy/gather/driver-test.js',
  'core/test/gather/driver/execution-context-test.js',
  'core/test/gather/driver/navigation-test.js',
  'core/test/gather/driver/wait-for-condition-test.js',
  'core/test/gather/gatherers/css-usage-test.js',
  'core/test/gather/gatherers/image-elements-test.js',
  'core/test/gather/gatherers/inspector-issues-test.js',
  'core/test/gather/gatherers/js-usage-test.js',
  'core/test/gather/gatherers/source-maps-test.js',
  'core/test/gather/gatherers/trace-elements-test.js',
  'core/test/gather/gatherers/trace-test.js',

  // grep -lRE '^await td\.replace' --include='*-test.*' --exclude-dir=node_modules
  'core/test/fraggle-rock/gather/snapshot-runner-test.js',
  'core/test/fraggle-rock/gather/timespan-runner-test.js',
  'core/test/fraggle-rock/user-flow-test.js',
  'core/test/gather/driver/prepare-test.js',
  'core/test/gather/gatherers/link-elements-test.js',
  'core/test/gather/gatherers/service-worker-test.js',
  'core/test/runner-test.js',

  // grep -lRE --include='-test.js' 'mockDriverSubmodules|mockRunnerModule|mockDriverModule|mockDriverSubmodules|makeMocksForGatherRunner' --include='*-test.*' --exclude-dir=node_modules
  'core/test/fraggle-rock/gather/navigation-runner-test.js',
  'core/test/fraggle-rock/gather/snapshot-runner-test.js',
  'core/test/fraggle-rock/gather/timespan-runner-test.js',
  'core/test/fraggle-rock/user-flow-test.js',
  'core/test/legacy/gather/gather-runner-test.js',
  'core/test/gather/gatherers/dobetterweb/response-compression-test.js',
  'core/test/gather/gatherers/script-elements-test.js',
  'core/test/runner-test.js',

  // These tend to timeout in puppeteer when run in parallel with other tests.
  'core/test/fraggle-rock/scenarios/api-test-pptr.js',
  'core/test/fraggle-rock/scenarios/cross-origin-test-pptr.js',
  'core/test/fraggle-rock/scenarios/disconnect-test-pptr.js',

  // ?
  'clients/test/lightrider/lightrider-entry-test.js', // Runner overrides.
  'flow-report/test/flow-report-pptr-test.ts',
  'cli/test/cli/bin-test.js',
  'cli/test/cli/run-test.js',
  'core/test/legacy/config/config-test.js',
  'core/test/fraggle-rock/config/config-test.js',
  'core/test/lib/emulation-test.js',
  'core/test/lib/sentry-test.js',
  'report/test/clients/bundle-test.js',
  'report/test/clients/bundle-test.js',
  'shared/test/localization/format-test.js',
]);

const y = yargs(yargsHelpers.hideBin(process.argv));
// TODO: -t => --fgrep
const rawArgv = y
  .help('help')
  .usage('node $0 [<options>] <paths>')
  .parserConfiguration({'unknown-options-as-args': true})
  .option('_', {
    array: true,
    type: 'string',
  })
  .options({
    'testMatch': {
      type: 'string',
      describe: 'Glob pattern for collecting test files',
    },
    'update': {
      alias: 'u',
      type: 'boolean',
      default: false,
      describe: 'Update snapshots',
    },
    'isolation': {
      type: 'boolean',
      default: true,
    },
    'parallel': {
      type: 'boolean',
      // Although much faster, mocha's parallel test runner defers printing errors until
      // all tests have finished. This may be undesired for local development, so enable
      // parallel mode by default only in CI.
      // Also, good to default to false locally because that avoids missing cross-file
      // test contamination by chance of mocha splitting up the work in a way that hides it.
      default: Boolean(process.env.CI),
    },
    'bail': {
      alias: 'b',
      type: 'boolean',
      default: false,
    },
    't': {
      type: 'string',
      describe: 'an alias for --grep, to run only tests with matching titles',
    },
    'onlyFailures': {
      type: 'boolean',
    },
    'require': {
      type: 'string',
    },
  })
  .wrap(y.terminalWidth())
  .argv;
const argv =
  /** @type {Awaited<typeof rawArgv> & CamelCasify<Awaited<typeof rawArgv>>} */ (rawArgv);

// This captures all of our mocha tests except for:
// * flow-report, because it needs to provide additional mocha flags
// * various *-test-pptr.js integration tests, which are long so are handled explicitly in
//   specific package.json scripts
const defaultTestMatches = [
  'build/**/*-test.js',
  'clients/test/**/*-test.js',
  'cli/**/*-test.js',
  'core/**/*-test.js',
  'core/test/fraggle-rock/**/*-test-pptr.js',
  'report/**/*-test.js',
  'shared/**/*-test.js',
  'third-party/**/*-test.js',
  'treemap/**/*-test.js',
  'viewer/**/*-test.js',
];

const filterFilePatterns = argv._.filter(arg => !(typeof arg !== 'string' || arg.startsWith('--')));

function getTestFiles() {
  // Collect all the possible test files, based off the provided testMatch glob pattern
  // or the default patterns defined above.
  const testsGlob = argv.testMatch || `{${defaultTestMatches.join(',')}}`;
  const allTestFiles = glob.sync(testsGlob, {cwd: LH_ROOT, absolute: true});

  // If provided, filter the test files using a basic string includes on the absolute path of
  // each test file. Map back to a relative path because it's nice to keep the printed commands shorter.
  // Why pass `absolute: true` to glob above? So that this works:
  //     yarn mocha /Users/cjamcl/src/lighthouse/core/test/runner-test.js
  let filteredTests = (
    filterFilePatterns.length ?
      allTestFiles.filter((file) => filterFilePatterns.some(pattern => file.includes(pattern))) :
      allTestFiles
  ).map(testPath => path.relative(process.cwd(), testPath));

  let grep;
  if (argv.onlyFailures) {
    const failedTests = getFailedTests();
    if (failedTests.length === 0) throw new Error('no tests failed');

    const titles = failedTests.map(failed => failed.title);
    grep = new RegExp(titles.map(escapeRegex).join('|'));

    filteredTests = filteredTests.filter(file => failedTests.some(failed => failed.file === file));
  }

  if (filterFilePatterns.length) {
    console.log(`applied test filters: ${JSON.stringify(filterFilePatterns, null, 2)}`);
  }
  console.log(`running ${filteredTests.length} test files`);

  return {filteredTests, grep};
}

/**
 * @param {{numberFailures: number, numberMochaInvocations: number}} params
 */
function exit({numberFailures, numberMochaInvocations}) {
  if (!numberFailures) {
    console.log('Tests passed');
    process.exit(0);
  }

  if (numberMochaInvocations === 1) {
    console.log('Tests failed');
    process.exit(1);
  }

  // If running many instances of mocha, failed results can get lost in the output.
  // So keep track of failures and re-print them at the very end.
  // See mocha-setup.js afterAll.

  const allFailedTests = getFailedTests();
  const groupedByFile = new Map();
  for (const failedTest of allFailedTests) {
    const failedTests = groupedByFile.get(failedTest.file) || [];
    failedTests.push(failedTest);
    groupedByFile.set(failedTest.file, failedTests);
  }

  console.log(`${allFailedTests.length} tests failed`);
  console.log('Printing failing tests:\n===========\n');

  for (const [file, failedTests] of groupedByFile) {
    console.log(`${file}\n`);
    for (const failedTest of failedTests) {
      console.log(`= ${failedTest.title}\n`);
      console.log(`${failedTest.error}\n`);
    }
  }

  process.exit(1);
}

/**
 * @typedef OurMochaArgs
 * @property {RegExp | undefined} grep
 * @property {boolean} bail
 * @property {boolean} parallel
 * @property {string | undefined} require
 */

/**
 * @param {string[]} tests
 * @param {OurMochaArgs} mochaArgs
 * @param {number} invocationNumber
 */
async function runMocha(tests, mochaArgs, invocationNumber) {
  process.env.LH_FAILED_TESTS_FILE = `${failedTestsDir}/output-${invocationNumber}.json`;

  const rootHooksPath = mochaArgs.require || '../test-env/mocha-setup.js';
  const {rootHooks} = await import(rootHooksPath);

  try {
    const mocha = new Mocha({
      rootHooks,
      timeout: 20_000,
      bail: mochaArgs.bail,
      grep: mochaArgs.grep,
      // TODO: not working
      // parallel: tests.length > 1 && mochaArgs.parallel,
      parallel: false,
    });

    // @ts-expect-error - not in types.
    mocha.lazyLoadFiles(true);
    for (const test of tests) mocha.addFile(test);
    await mocha.loadFilesAsync();
    return await new Promise(resolve => mocha.run(resolve));
  } catch (err) {
    console.error(err);
    return 1;
  }
}

async function main() {
  process.env.SNAPSHOT_UPDATE = argv.update ? '1' : '';

  const {filteredTests: testsToRun, grep} = getTestFiles();
  const testsToRunTogether = [];
  const testsToRunIsolated = [];
  for (const test of testsToRun) {
    if (argv.isolation && testsToIsolate.has(test)) {
      testsToRunIsolated.push(test);
    } else {
      testsToRunTogether.push(test);
    }
  }

  // If running only a single test file, no need for isolation at all. Move
  // the singular test to `testsToRunTogether` so that it's run in-process,
  // allowing for better DX when doing a `node --inspect-brk` workflow.
  if (testsToRunTogether.length === 0 && testsToRunIsolated.length === 1) {
    testsToRunTogether.push(testsToRunIsolated[0]);
    testsToRunIsolated.splice(0, 1);
  }

  fs.rmSync(failedTestsDir, {recursive: true, force: true});
  fs.mkdirSync(failedTestsDir, {recursive: true});

  /** @type {OurMochaArgs} */
  const mochaArgs = {
    grep,
    bail: argv.bail,
    parallel: argv.parallel,
    require: argv.require,
  };

  mochaGlobalSetup();
  let numberMochaInvocations = 0;
  let numberFailures = 0;
  try {
    if (testsToRunTogether.length) {
      numberFailures += await runMocha(testsToRunTogether, mochaArgs, numberMochaInvocations);
      numberMochaInvocations += 1;
      if (numberFailures && argv.bail) exit({numberFailures, numberMochaInvocations});
    }

    for (const test of testsToRunIsolated) {
      console.log(`Running test in isolation: ${test}`);
      const worker = new Worker(new URL(import.meta.url), {
        workerData: {
          test,
          mochaArgs,
          numberMochaInvocations,
        },
      });

      try {
        const [workerResponse] = await once(worker, 'message');
        numberFailures += workerResponse.numberFailures;
      } catch (err) {
        // `once` throws an error if the underlying event emitter produces an 'error' message.
        console.error(err);
        numberFailures += 1;
      }

      numberMochaInvocations += 1;
      if (numberFailures && argv.bail) exit({numberFailures, numberMochaInvocations});
    }
  } finally {
    mochaGlobalTeardown();
  }

  exit({numberFailures, numberMochaInvocations});
}

await main();
