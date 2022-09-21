/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

// node core/scripts/print-a11y-scoring.js

import {initializeConfig} from '../config/config.js';

const {config} = await initializeConfig('navigation');
if (!config.categories || !config.audits) throw new Error('wut');

const auditRefs = config.categories.accessibility.auditRefs;
const sum = auditRefs.reduce((sum, item) => sum += item.weight, 0);
const result = auditRefs
  .filter(a => a.weight)
  .sort((a, b) => b.weight - a.weight)
  .map(a => {
    return [
      undefined,
      a.id,
      `${(a.weight / sum * 100).toLocaleString(undefined, {maximumFractionDigits: 1})}%`,
      undefined,
    ].join(' | ');
  })
  .join('\n');

// eslint-disable-next-line no-console
console.log(result);
