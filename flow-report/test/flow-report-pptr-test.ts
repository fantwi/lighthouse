/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import puppeteer, {Browser, Page} from 'puppeteer';

import {ReportGenerator} from '../../report/generator/report-generator.js';
import {swapFlowLocale} from '../../shared/localization/swap-flow-locale.js';
import {flowResult} from './sample-flow';

describe('Lighthouse Flow Report', () => {
  console.log('\n✨ Be sure to have recently run this: yarn build-report');

  let browser: Browser;
  let page: Page;
  const pageErrors: Error[] = [];

  before(async () => {
    browser = await puppeteer.launch({
      headless: true,
    });
    page = await browser.newPage();
    page.on('pageerror', pageError => pageErrors.push(pageError));
  });

  after(async () => {
    if (pageErrors.length > 0) console.error(pageErrors);

    await browser.close();
  });

  describe('Renders the flow report', () => {
    before(async () => {
      const html = ReportGenerator.generateFlowReportHtml(flowResult);
      await page.setContent(html);
    });

    it('should load with no errors', async () => {
      expect(pageErrors).toHaveLength(0);
    });
  });

  describe('Renders the flow report (i18n)', () => {
    before(async () => {
      const html = ReportGenerator.generateFlowReportHtml(swapFlowLocale(flowResult, 'es'));
      await page.setContent(html);
    });

    it('should load with no errors', async () => {
      expect(pageErrors).toHaveLength(0);
      const el = await page.$('.SummarySectionHeader__content');
      if (!el) throw new Error();
      const text = await el.evaluate(el => el.textContent);
      expect(text).toEqual('Todos los informes');
    });
  });
}).timeout(35_000);
