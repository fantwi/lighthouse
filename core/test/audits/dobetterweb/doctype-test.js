/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import Audit from '../../../audits/dobetterweb/doctype.js';

describe('DOBETTERWEB: doctype audit', () => {
  it('fails when document does not contain a doctype', () => {
    const auditResult = Audit.audit({
      Doctype: null,
    });
    assert.equal(auditResult.score, 0);
    expect(auditResult.explanation).toBeDisplayString('Document must contain a doctype');
  });

  it('fails when document is in quirks-mode (but passes other checks)', () => {
    const auditResult = Audit.audit({
      // eg `<!DOCTYPE html foo>`. https://github.com/GoogleChrome/lighthouse/issues/10030
      Doctype: {
        name: 'html',
        publicId: '',
        systemId: '',
        documentCompatMode: 'BackCompat',
      },
    });
    assert.equal(auditResult.score, 0);
    expect(auditResult.explanation)
        .toBeDisplayString('Document contains a doctype that triggers quirks-mode');
  });

  it('fails when the value of the name attribute is a value other than "html"', () => {
    const auditResult = Audit.audit({
      Doctype: {
        name: 'xml',
        publicId: '',
        systemId: '',
        documentCompatMode: 'BackCompat',
      },
    });
    assert.equal(auditResult.score, 0);
    expect(auditResult.explanation).toBeDisplayString(
      'Doctype name must be the string `html`');
  });

  it('fails when the publicId attribute is not an empty string', () => {
    const auditResult = Audit.audit({
      Doctype: {
        name: 'html',
        publicId: '189655',
        systemId: '',
        documentCompatMode: 'BackCompat',
      },
    });
    assert.equal(auditResult.score, 0);
    expect(auditResult.explanation).toBeDisplayString('Expected publicId to be an empty string');
  });

  it('fails when the systemId attribute is not an empty string', () => {
    const auditResult = Audit.audit({
      Doctype: {
        name: 'html',
        publicId: '',
        systemId: '189655',
        documentCompatMode: 'BackCompat',
      },
    });
    assert.equal(auditResult.score, 0);
    expect(auditResult.explanation).toBeDisplayString('Expected systemId to be an empty string');
  });

  it('succeeds when document contains a doctype, and the name value is "html"', () => {
    const auditResult = Audit.audit({
      Doctype: {
        name: 'html',
        publicId: '',
        systemId: '',
        documentCompatMode: 'CSS1Compat',
      },
    });
    assert.equal(auditResult.score, 1);
  });
});
