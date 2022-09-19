/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import LargestContentfulPaintLazyLoaded from '../../audits/lcp-lazy-loaded.js';

const SAMPLE_NODE = {
  devtoolsNodePath: '1,HTML,1,BODY,3,DIV,2,IMG',
  selector: 'div.l-header > div.chorus-emc__content',
  nodeLabel: 'My Test Label',
  snippet: '<img class="test-class">',
};
function generateImage(loading, clientRectTop) {
  return {
    src: 'test',
    loading,
    clientRect: {
      top: clientRectTop,
      bottom: 400,
      left: 0,
      right: 0,
    },
    node: SAMPLE_NODE,
  };
}
describe('Performance: lcp-lazy-loaded audit', () => {
  it('correctly surfaces the lazy loaded LCP element', async () => {
    const artifacts = {
      TraceElements: [{
        traceEventType: 'largest-contentful-paint',
        node: SAMPLE_NODE,
        type: 'image',
      }],
      ImageElements: [
        generateImage('lazy', 0),
      ],
      ViewportDimensions: {
        innerHeight: 500,
        innerWidth: 300,
      },
    };

    const auditResult = await LargestContentfulPaintLazyLoaded.audit(artifacts);
    expect(auditResult.score).toEqual(0);
    expect(auditResult.details.items).toHaveLength(1);
    expect(auditResult.details.items[0].node.path).toEqual('1,HTML,1,BODY,3,DIV,2,IMG');
    expect(auditResult.details.items[0].node.nodeLabel).toEqual('My Test Label');
    expect(auditResult.details.items[0].node.snippet).toEqual('<img class="test-class">');
  });

  it('eager LCP element scores 1', async () => {
    const artifacts = {
      TraceElements: [{
        traceEventType: 'largest-contentful-paint',
        node: SAMPLE_NODE,
        type: 'image',
      }],
      ImageElements: [
        generateImage('eager', 0),
      ],
      ViewportDimensions: {
        innerHeight: 500,
        innerWidth: 300,
      },
    };
    const auditResult = await LargestContentfulPaintLazyLoaded.audit(artifacts);
    expect(auditResult.score).toEqual(1);
    expect(auditResult.details.items).toHaveLength(1);
  });

  it('not applicable when outside of viewport', async () => {
    const artifacts = {
      TraceElements: [{
        traceEventType: 'largest-contentful-paint',
        node: SAMPLE_NODE,
        type: 'image',
      }],
      ImageElements: [
        generateImage('lazy', 700),
      ],
      ViewportDimensions: {
        innerHeight: 500,
        innerWidth: 300,
      },
    };
    const auditResult = await LargestContentfulPaintLazyLoaded.audit(artifacts);
    expect(auditResult.notApplicable).toEqual(true);
  });

  it('doesn\'t throw an error when there is nothing to show', async () => {
    const artifacts = {
      TraceElements: [],
      ImageElements: [],
    };

    const auditResult = await LargestContentfulPaintLazyLoaded.audit(artifacts);
    expect(auditResult.score).toEqual(null);
    expect(auditResult.notApplicable).toEqual(true);
  });

  it('is not applicable when LCP was text', async () => {
    const artifacts = {
      TraceElements: [{
        traceEventType: 'largest-contentful-paint',
        node: SAMPLE_NODE,
        type: 'text',
      }],
      ImageElements: [
        generateImage('lazy', 700),
      ],
      ViewportDimensions: {
        innerHeight: 500,
        innerWidth: 300,
      },
    };
    const auditResult = await LargestContentfulPaintLazyLoaded.audit(artifacts);
    expect(auditResult).toEqual({
      score: null,
      notApplicable: true,
    });
  });
});
