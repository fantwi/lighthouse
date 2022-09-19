/**
 * @license Copyright 2021 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {ImageRecords} from '../../computed/image-records.js';
import {NetworkRequest} from '../../lib/network-request.js';

/**
 * @param {Partial<LH.Artifacts.NetworkRequest>=} partial
 * @return {LH.Artifacts.NetworkRequest}
 */
function mockRequest(partial = {}) {
  const request = new NetworkRequest();
  return Object.assign(request, partial);
}

/**
 * @param {Partial<LH.Artifacts.ImageElement>=} partial
 * @return {LH.Artifacts.ImageElement}
 */
function mockElement(partial = {}) {
  return {
    src: 'https://example.com/img.png',
    srcset: '',
    displayedWidth: 200,
    displayedHeight: 200,
    clientRect: {
      top: 50,
      bottom: 250,
      left: 50,
      right: 250,
    },
    attributeWidth: '',
    attributeHeight: '',
    naturalDimensions: undefined,
    cssEffectiveRules: undefined,
    computedStyles: {position: 'absolute', objectFit: '', imageRendering: ''},
    isCss: false,
    isPicture: false,
    isInShadowDOM: false,
    node: {
      lhId: '__nodeid__',
      devtoolsNodePath: '1,HTML,1,BODY,1,DIV,1,IMG',
      selector: 'body > div > img',
      nodeLabel: 'img',
      snippet: '<img src="https://example.com/img.png">',
      boundingRect: {
        top: 50,
        bottom: 250,
        left: 50,
        right: 250,
        width: 200,
        height: 200,
      },
    },
    ...partial,
  };
}

describe('.indexNetworkRecords', () => {
  it('maps image urls to network records', () => {
    const networkRecords = [
      mockRequest({
        mimeType: 'image/png',
        url: 'https://example.com/img.png',
        finished: true,
        statusCode: 200,
      }),
      mockRequest({
        mimeType: 'application/octect-stream',
        url: 'https://example.com/img.webp',
        finished: true,
        statusCode: 200,
      }),
      mockRequest({
        mimeType: 'application/octect-stream',
        url: 'https://example.com/img.avif',
        finished: true,
        statusCode: 200,
      }),
    ];

    const index = ImageRecords.indexNetworkRecords(networkRecords);

    expect(index).toEqual({
      'https://example.com/img.avif': mockRequest({
        finished: true,
        mimeType: 'application/octect-stream',
        statusCode: 200,
        url: 'https://example.com/img.avif',
      }),
      'https://example.com/img.png': mockRequest({
        finished: true,
        mimeType: 'image/png',
        statusCode: 200,
        url: 'https://example.com/img.png',
      }),
      'https://example.com/img.webp': mockRequest({
        finished: true,
        mimeType: 'application/octect-stream',
        statusCode: 200,
        url: 'https://example.com/img.webp',
      }),
    });
  });

  it('ignores bad status codes', () => {
    const networkRecords = [
      mockRequest({
        mimeType: 'image/png',
        url: 'https://example.com/img.png',
        finished: true,
        statusCode: 200,
      }),
      mockRequest({
        mimeType: 'application/octect-stream',
        url: 'https://example.com/img.webp',
        finished: false,
      }),
      mockRequest({
        mimeType: 'application/octect-stream',
        url: 'https://example.com/img.avif',
        finished: true,
        statusCode: 404,
      }),
    ];

    const index = ImageRecords.indexNetworkRecords(networkRecords);

    expect(index).toEqual({
      'https://example.com/img.png': mockRequest({
        finished: true,
        mimeType: 'image/png',
        statusCode: 200,
        url: 'https://example.com/img.png',
      }),
    });
  });
});

describe('compute_', () => {
  it('takes mime type from network record', async () => {
    const elements = await ImageRecords.compute_({
      ImageElements: [
        mockElement(),
      ],
      networkRecords: [
        mockRequest({
          mimeType: 'image/png',
          url: 'https://example.com/img.png',
          finished: true,
          statusCode: 200,
        }),
      ],
    });

    expect(elements).toEqual([mockElement({mimeType: 'image/png'})]);
  });

  it('guess mime type if no request', async () => {
    const elements = await ImageRecords.compute_({
      ImageElements: [
        mockElement(),
      ],
      networkRecords: [],
    });

    expect(elements).toEqual([mockElement({mimeType: 'image/png'})]);
  });
});
