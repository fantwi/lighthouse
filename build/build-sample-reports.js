#!/usr/bin/env node
/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

/* eslint-disable no-console */

import fs from 'fs';
import path from 'path';

import {swapLocale} from '../shared/localization/swap-locale.js';
import {swapFlowLocale} from '../shared/localization/swap-flow-locale.js';
import {ReportGenerator} from '../report/generator/report-generator.js';
import {defaultSettings} from '../core/config/constants.js';
import lighthouse from '../core/index.js';
import {LH_ROOT} from '../root.js';
import {readJson} from '../core/test/test-utils.js';

/** @type {LH.Result} */
const lhr = readJson(`${LH_ROOT}/core/test/results/sample_v2.json`);

/** @type {LH.FlowResult} */
const flowResult = readJson(
  `${LH_ROOT}/core/test/fixtures/fraggle-rock/reports/sample-flow-result.json`
);

const DIST = path.join(LH_ROOT, 'dist');

async function buildSampleReports() {
  const snapshotLhr = flowResult.steps.find(step => step.lhr.gatherMode === 'snapshot')?.lhr;
  const timespanLhr = flowResult.steps.find(step => step.lhr.gatherMode === 'timespan')?.lhr;
  if (!snapshotLhr) throw new Error('Could not find a snapshot report on the sample flow result');
  if (!timespanLhr) throw new Error('Could not find a timespan report on the sample flow result');

  addPluginCategory(lhr);
  const errorLhr = await generateErrorLHR();

  const filenameToLhr = {
    'english': lhr,
    'espanol': swapLocale(lhr, 'es').lhr,
    'ɑrabic': swapLocale(lhr, 'ar').lhr,
    'xl-accented': swapLocale(lhr, 'en-XL').lhr,
    'error': errorLhr,
    'single-category': tweakLhrForPsi(lhr),
    'snapshot': snapshotLhr,
    'timespan': timespanLhr,
  };

  // Generate and write reports
  Object.entries(filenameToLhr).forEach(([filename, sampleLhr]) => {
    for (const variant of ['', '⌣.cdt.', '⌣.psi.']) {
      let html = variant.includes('psi') ?
        generatePsiReportHtml(sampleLhr) :
        ReportGenerator.generateReportHtml(sampleLhr);

      if (variant.includes('cdt')) {
        // TODO: Make the DevTools Audits panel "emulation" more comprehensive
        // - the parent widget/vbox container with overflow
        // - a more constrained/realistic default size
        html = html.replace(`"lh-root lh-vars"`, `"lh-root lh-vars lh-devtools"`);
      }
      const filepath = `${DIST}/sample-reports/${variant}${filename}/index.html`;
      fs.mkdirSync(path.dirname(filepath), {recursive: true});
      fs.writeFileSync(filepath, html, {encoding: 'utf-8'});
      console.log('✅', filepath, 'written.');
    }
  });

  generateFlowReports();
}

function generateFlowReports() {
  const filenameToFlowResult = {
    'flow-report': flowResult,
    'xl.flow-report': swapFlowLocale(flowResult, 'en-XL'),
  };

  for (const [filename, fr] of Object.entries(filenameToFlowResult)) {
    const html = ReportGenerator.generateFlowReportHtml(fr);
    const filepath = `${DIST}/sample-reports/${filename}/index.html`;
    fs.mkdirSync(path.dirname(filepath), {recursive: true});
    fs.writeFileSync(filepath, html, {encoding: 'utf-8'});
    console.log('✅', filepath, 'written.');
  }
}

/**
 * @param {LH.Result} sampleLhr
 * @return {string}
 */
function generatePsiReportHtml(sampleLhr) {
  const sanitizedJson = ReportGenerator.sanitizeJson(tweakLhrForPsi(sampleLhr));
  const PSI_TEMPLATE = fs.readFileSync(
    `${LH_ROOT}/report/test-assets/faux-psi-template.html`, 'utf8');
  const PSI_JAVASCRIPT = `
${fs.readFileSync(`${LH_ROOT}/dist/report/bundle.umd.js`, 'utf8')};
${fs.readFileSync(`${LH_ROOT}/report/test-assets/faux-psi.js`, 'utf8')};
  `;

  const html = ReportGenerator.replaceStrings(PSI_TEMPLATE, [
    {search: '%%LIGHTHOUSE_JSON%%', replacement: sanitizedJson},
    {search: '%%LIGHTHOUSE_JAVASCRIPT%%', replacement: PSI_JAVASCRIPT},
  ]);
  return html;
}
/**
 * Add a plugin to demo plugin rendering.
 * @param {LH.Result} sampleLhr
 */
function addPluginCategory(sampleLhr) {
  sampleLhr.categories['lighthouse-plugin-someplugin'] = {
    id: 'lighthouse-plugin-someplugin',
    title: 'Plugin',
    score: 0.5,
    auditRefs: [],
  };
}

/**
 * Drops the LHR to only one, solo category (performance), and removes budgets.
 * @param {LH.Result} sampleLhr
 */
function tweakLhrForPsi(sampleLhr) {
  /** @type {LH.Result} */
  const clone = JSON.parse(JSON.stringify(sampleLhr));
  clone.categories = {
    'performance': clone.categories.performance,
  };
  // no budgets in PSI
  delete clone.audits['performance-budget'];
  clone.categories.performance.auditRefs = clone.categories.performance.auditRefs.filter(audit => {
    return !audit.id.endsWith('-budget');
  });
  return clone;
}

/**
 * Generate an LHR with errors for the renderer to display.
 * We'll write an "empty" artifacts file to disk, only to use it in auditMode.
 * @return {Promise<LH.Result>}
 */
async function generateErrorLHR() {
  /** @type {LH.BaseArtifacts} */
  const artifacts = {
    fetchTime: '2019-06-26T23:56:58.381Z',
    LighthouseRunWarnings: [
      `Something went wrong with recording the trace over your page load. Please run Lighthouse again. (NO_FCP)`, // eslint-disable-line max-len
    ],
    HostFormFactor: 'desktop',
    HostUserAgent: 'Mozilla/5.0 ErrorUserAgent Chrome/66',
    NetworkUserAgent: 'Mozilla/5.0 ErrorUserAgent Chrome/66',
    BenchmarkIndex: 1000,
    WebAppManifest: null,
    InstallabilityErrors: {errors: []},
    Stacks: [],
    settings: defaultSettings,
    URL: {
      requestedUrl: 'http://fakeurl.com',
      mainDocumentUrl: 'http://fakeurl.com',
      finalDisplayedUrl: 'http://fakeurl.com',
    },
    GatherContext: {gatherMode: 'navigation'},
    Timing: [],
    PageLoadError: null,
    devtoolsLogs: {},
    traces: {},
  };

  // Save artifacts to disk then run `lighthouse -G` with them.
  const TMP = `${DIST}/.tmp/`;
  fs.mkdirSync(TMP, {recursive: true});
  fs.writeFileSync(`${TMP}/artifacts.json`, JSON.stringify(artifacts), 'utf-8');
  const errorRunnerResult = await lighthouse(artifacts.URL.requestedUrl, {auditMode: TMP});

  if (!errorRunnerResult) throw new Error('Failed to run lighthouse on empty artifacts');
  const errorLhr = errorRunnerResult.lhr;

  // Add audit warnings to font-display
  errorLhr.audits['font-display'].warnings = [
    'Lighthouse was unable to automatically check the font-display value for the following URL: https://secure-ds.serving-sys.com/resources/PROD/html5/105657/20190307/1074580285/43862346571980472/fonts/IBMPlexSans-Light-Latin1.woff.',
    'Lighthouse was unable to automatically check the font-display value for the following URL: https://secure-ds.serving-sys.com/resources/PROD/html5/105657/20190307/1074580285/43862346571980472/fonts/IBMPlexSans-Bold-Latin1.woff.',
  ];
  // perf/offscreen-images - set as passing but with a warning
  const offscreenImagesAudit = errorLhr.audits['offscreen-images'];
  offscreenImagesAudit.warnings = [
    'Invalid image sizing information: https://cdn.cnn.com/cnn/.e1mo/img/4.0/vr/vr_new_asset.png',
  ];
  offscreenImagesAudit.errorMessage = undefined;
  offscreenImagesAudit.scoreDisplayMode = 'binary';
  offscreenImagesAudit.score = 1;

  fs.rmSync(TMP, {recursive: true, force: true});
  return errorLhr;
}

await buildSampleReports();
