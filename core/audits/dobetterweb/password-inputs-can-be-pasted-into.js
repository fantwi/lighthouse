/**
 * @license Copyright 2016 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {Audit} from '../audit.js';
import * as i18n from '../../lib/i18n/i18n.js';

const UIStrings = {
  /** Title of a Lighthouse audit that provides detail on the ability to paste into password fields. This descriptive title is shown to users when the page allows pasting of content into password fields. */
  title: 'Allows users to paste into password fields',
  /** Title of a Lighthouse audit that provides detail on the ability to paste into password fields. This descriptive title is shown to users when the page does not allow pasting of content into password fields. */
  failureTitle: 'Prevents users to paste into password fields',
  /** Description of a Lighthouse audit that tells the user why they should allow pasting of content into password fields. This is displayed after a user expands the section to see more. No character length limits. The last sentence starting with 'Learn' becomes link text to additional documentation. */
  description: 'Preventing password pasting undermines good security policy. ' +
      '[Learn more about user-friendly password fields](https://web.dev/password-inputs-can-be-pasted-into/).',
};

const str_ = i18n.createIcuMessageFn(import.meta.url, UIStrings);

class PasswordInputsCanBePastedIntoAudit extends Audit {
  /**
   * @return {LH.Audit.Meta}
   */
  static get meta() {
    return {
      id: 'password-inputs-can-be-pasted-into',
      title: str_(UIStrings.title),
      failureTitle: str_(UIStrings.failureTitle),
      description: str_(UIStrings.description),
      requiredArtifacts: ['PasswordInputsWithPreventedPaste'],
    };
  }

  /**
   * @param {LH.Artifacts} artifacts
   * @return {LH.Audit.Product}
   */
  static audit(artifacts) {
    const passwordInputsWithPreventedPaste = artifacts.PasswordInputsWithPreventedPaste;

    /** @type {LH.Audit.Details.Table['items']} */
    const items = [];

    passwordInputsWithPreventedPaste.forEach(input => {
      items.push({
        node: Audit.makeNodeItem(input.node),
      });
    });

    /** @type {LH.Audit.Details.Table['headings']} */
    const headings = [
      {key: 'node', itemType: 'node', text: str_(i18n.UIStrings.columnFailingElem)},
    ];

    return {
      score: Number(passwordInputsWithPreventedPaste.length === 0),
      details: Audit.makeTableDetails(headings, items),
    };
  }
}

export default PasswordInputsCanBePastedIntoAudit;
export {UIStrings};
