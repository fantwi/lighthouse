/**
 * @license Copyright 2019 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import * as SettingsController from '../../extension/scripts/settings-controller.js';
import defaultConfig from '../../../core/config/default-config.js';
import * as format from '../../../shared/localization/format.js';

describe('Lighthouse chrome extension SettingsController', () => {
  it('default categories should be correct', () => {
    const categories = Object.entries(defaultConfig.categories)
      .map(([id, category]) => {
        return {
          id,
          title: format.getFormatted(category.title, 'en-US'),
        };
      });
    expect(SettingsController.DEFAULT_CATEGORIES).toEqual(categories);
  });
});
