/**
 * @license Copyright 2018 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import assert from 'assert/strict';

import PluginsAudit from '../../../audits/seo/plugins.js';

describe('SEO: Avoids plugins', () => {
  it('fails when page contains java, silverlight or flash content', () => {
    const embeddedContentValues = [
      [{
        tagName: 'APPLET',
        params: [],
        node: {},
      }],
      [{
        tagName: 'OBJECT',
        type: 'application/x-shockwave-flash',
        params: [],
        node: {
          lhId: 'page-11-OBJECT',
          // eslint-disable-next-line max-len
          devtoolsNodePath: '1,HTML,1,BODY,1,DIV,0,ARTICLE,12,FORM,0,DIV,1,DIV,1,DIV,0,DIV,0,OBJECT',
          selector: 'div.code-group > div.result-pane > div.result > object',
          boundingRect: {
            top: 1173,
            bottom: 1268,
            left: 27,
            right: 377,
            width: 350,
            height: 95,
          },
          // eslint-disable-next-line max-len
          snippet: '<object type="application/x-shockwave-flash" data="/web_design/paris_vegas.swf" width="350" height="95">',
          nodeLabel: 'object',
        },
      }],
      [{
        tagName: 'EMBED',
        type: 'application/x-java-applet;jpi-version=1.4',
        params: [],
        node: {},
      }],
      [{
        tagName: 'OBJECT',
        type: 'application/x-silverlight-2',
        params: [],
        node: {},
      }],
      [{
        tagName: 'OBJECT',
        data: 'https://example.com/movie_name.swf?uid=123',
        params: [],
        node: {},
      }],
      [{
        tagName: 'EMBED',
        src: '/path/to/movie_name.latest.swf',
        params: [],
        node: {},
      }],
      [{
        tagName: 'OBJECT',
        params: [
          {name: 'quality', value: 'low'},
          {name: 'movie', value: 'movie.swf?id=123'},
        ],
        node: {},
      }],
      [{
        tagName: 'OBJECT',
        params: [
          {name: 'code', value: '../HelloWorld.class'},
        ],
        node: {},
      }],
    ];

    embeddedContentValues.forEach(embeddedContent => {
      const artifacts = {
        EmbeddedContent: embeddedContent,
      };

      const auditResult = PluginsAudit.audit(artifacts);
      assert.equal(auditResult.score, 0);
      assert.equal(auditResult.details.items.length, 1);
    });
  });

  it('returns multiple results when there are multiple failing items', () => {
    const artifacts = {
      EmbeddedContent: [
        {
          tagName: 'EMBED',
          type: 'application/x-java-applet;jpi-version=1.4',
          params: [],
          node: {},
        },
        {
          tagName: 'OBJECT',
          type: 'application/x-silverlight-2',
          params: [],
          node: {},
        },
        {
          tagName: 'APPLET',
          params: [],
          node: {},
        },
      ],
    };

    const auditResult = PluginsAudit.audit(artifacts);
    assert.equal(auditResult.score, 0);
    assert.equal(auditResult.details.items.length, 3);
  });

  it('succeeds when there is no external content found on page', () => {
    const artifacts = {
      EmbeddedContent: [],
    };

    const auditResult = PluginsAudit.audit(artifacts);
    assert.equal(auditResult.score, 1);
  });

  it('succeeds when all external content is valid', () => {
    const artifacts = {
      EmbeddedContent: [
        {
          tagName: 'OBJECT',
          type: 'image/svg+xml',
          data: 'https://example.com/test.svg',
          params: [],
          node: {},
        },
        {
          tagName: 'OBJECT',
          data: 'https://example.com',
          params: [],
          node: {},
        },
        {
          tagName: 'EMBED',
          type: 'video/quicktime',
          src: 'movie.mov',
          params: [],
          node: {},
        },
        {
          tagName: 'OBJECT',
          params: [{
            name: 'allowFullScreen',
            value: 'true',
          }, {
            name: 'movie',
            value: 'http://www.youtube.com/v/example',
          }],
          node: {},
        },
      ],
    };

    const auditResult = PluginsAudit.audit(artifacts);
    assert.equal(auditResult.score, 1);
  });
});
