/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {Audit} from './audit.js';
import * as i18n from '../lib/i18n/i18n.js';
import {NetworkRecords} from '../computed/network-records.js';
import {NetworkAnalysis} from '../computed/network-analysis.js';

const UIStrings = {
  /** Descriptive title of a Lighthouse audit that tells the user the server latencies observed from each origin the page connected to. This is displayed in a list of audit titles that Lighthouse generates. */
  title: 'Server Backend Latencies',
  /** Description of a Lighthouse audit that tells the user that server latency can effect their website's performance negatively. This is displayed after a user expands the section to see more. No character length limits. The last sentence starting with 'Learn' becomes link text to additional documentation. */
  description: 'Server latencies can impact web performance. ' +
    'If the server latency of an origin is high, it\'s an indication the server is overloaded ' +
    'or has poor backend performance. [Learn more about server response time](https://hpbn.co/primer-on-web-performance/#analyzing-the-resource-waterfall).',
};

const str_ = i18n.createIcuMessageFn(import.meta.url, UIStrings);

class NetworkServerLatency extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'network-server-latency',
      scoreDisplayMode: Audit.SCORING_MODES.INFORMATIVE,
      title: str_(UIStrings.title),
      description: str_(UIStrings.description),
      requiredArtifacts: ['devtoolsLogs'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @param {LH.Audit.Context} context
   * @return {Promise<LH.Audit.Product>}
   */
  static async audit(artifacts, context) {
    const devtoolsLog = artifacts.devtoolsLogs[Audit.DEFAULT_PASS];
    const records = await NetworkRecords.request(devtoolsLog, context);
    if (!records.length) {
      return {
        score: 1,
        notApplicable: true,
      };
    }

    const analysis = await NetworkAnalysis.request(devtoolsLog, context);

    /** @type {number} */
    let maxLatency = 0;
    /** @type {Array<{origin: string, serverResponseTime: number}>} */
    const results = [];
    for (const [origin, serverResponseTime] of analysis.serverResponseTimeByOrigin.entries()) {
      // Ignore entries that don't look like real origins, like the __SUMMARY__ entry.
      if (!origin.startsWith('http')) continue;

      maxLatency = Math.max(serverResponseTime, maxLatency);
      results.push({origin, serverResponseTime});
    }

    results.sort((a, b) => b.serverResponseTime - a.serverResponseTime);

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'origin', itemType: 'text', text: str_(i18n.UIStrings.columnURL)},
      {key: 'serverResponseTime', itemType: 'ms', granularity: 1,
        text: str_(i18n.UIStrings.columnTimeSpent)},
    ];

    const tableDetails = Audit.makeTableDetails(headings, results);

    return {
      score: Math.max(1 - (maxLatency / 500), 0),
      numericValue: maxLatency,
      numericUnit: 'millisecond',
      displayValue: str_(i18n.UIStrings.ms, {timeInMs: maxLatency}),
      details: tableDetails,
    };
  }
}

export default NetworkServerLatency;
export {UIStrings};
