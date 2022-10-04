/**
 * @license Copyright 2020 Google Inc. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import {createMockContext} from '../../gather/mock-driver.js';
import FullPageScreenshotGatherer from '../../../gather/gatherers/full-page-screenshot.js';

// Headless's default value is (1024 * 16), but this varies by device
const maxTextureSizeMock = 1024 * 8;

/** @type {{width: number, height: number}} */
let contentSize;
/** @type {{width?: number, height?: number, dpr: number}} */
let screenSize;
/** @type {{width?: number, height?: number}} */
let screenshotAreaSize;
/** @type {string[]} */
let screenshotData;
let mockContext = createMockContext();

beforeEach(() => {
  contentSize = {width: 100, height: 100};
  screenSize = {width: 100, height: 100, dpr: 1};
  screenshotAreaSize = contentSize;
  screenshotData = [];
  mockContext = createMockContext();
  mockContext.driver.defaultSession.sendCommand.mockImplementation((method) => {
    if (method === 'Page.getLayoutMetrics') {
      return {
        contentSize,
        // See comment within _takeScreenshot() implementation
        layoutViewport: {clientWidth: screenSize.width, clientHeight: screenSize.height},
      };
    }
    if (method === 'Page.captureScreenshot') {
      return {
        data: screenshotData?.length ? screenshotData.shift() : 'abc',
      };
    }
  });
  mockContext.driver._executionContext.evaluate.mockImplementation(fn => {
    if (fn.name === 'resolveNodes') {
      return {};
    } if (fn.name === 'getMaxTextureSize') {
      return maxTextureSizeMock;
    } else if (fn.name === 'getObservedDeviceMetrics') {
      return {
        width: screenSize.width,
        height: screenSize.height,
        screenOrientation: {
          type: 'landscapePrimary',
          angle: 30,
        },
        deviceScaleFactor: screenSize.dpr,
      };
    } else if (fn.name === 'getScreenshotAreaSize') {
      return {
        width: screenshotAreaSize.width,
        height: screenshotAreaSize.height,
      };
    } else if (fn.name === 'waitForDoubleRaf') {
      return {};
    } else {
      throw new Error(`unexpected fn ${fn.name}`);
    }
  });
});

describe('FullPageScreenshot gatherer', () => {
  it('captures a full-page screenshot', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();
    contentSize = {width: 412, height: 2000};
    screenSize = {width: 412, height: 412};
    screenshotAreaSize = contentSize;

    mockContext.settings = {
      ...mockContext.settings,
      formFactor: 'mobile',
      screenEmulation: {
        height: screenSize.height,
        width: screenSize.width,
        mobile: true,
        disabled: false,
      },
    };

    const artifact = await fpsGatherer.getArtifact(mockContext.asContext());

    expect(artifact).toEqual({
      screenshot: {
        data: 'data:image/webp;base64,abc',
        height: 2000,
        width: 412,
      },
      nodes: {},
    });
  });

  it('resets the emulation correctly when Lighthouse controls it', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();
    contentSize = {width: 412, height: 2000};
    screenSize = {width: 412, height: 412};
    screenshotAreaSize = contentSize;

    mockContext.settings = {
      ...mockContext.settings,
      formFactor: 'mobile',
      screenEmulation: {
        height: screenSize.height,
        width: screenSize.width,
        mobile: true,
        disabled: false,
      },
    };

    await fpsGatherer.getArtifact(mockContext.asContext());

    // Lighthouse-controlled emulation.emulate() sets touch emulation.
    const emulationInvocations = mockContext.driver.defaultSession.sendCommand
        .findAllInvocations('Emulation.setTouchEmulationEnabled');
    expect(emulationInvocations).toHaveLength(1);

    expect(mockContext.driver.defaultSession.sendCommand).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({
        height: 412,
        width: 412,
        mobile: true,
      })
    );
  });

  it('resets the emulation correctly when Lighthouse does not control it', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();
    contentSize = {width: 500, height: 1500};
    screenSize = {width: 500, height: 500, dpr: 2};
    screenshotAreaSize = contentSize;
    mockContext.settings = {
      ...mockContext.settings,
      screenEmulation: {
        height: screenSize.height,
        width: screenSize.width,
        mobile: true,
        disabled: true,
      },
      formFactor: 'mobile',
    };

    await fpsGatherer.getArtifact(mockContext.asContext());

    // If not Lighthouse controlled, no touch emulation.
    const emulationInvocations = mockContext.driver.defaultSession.sendCommand
        .findAllInvocations('Emulation.setTouchEmulationEnabled');
    expect(emulationInvocations).toHaveLength(0);

    // Setting up for screenshot.
    expect(mockContext.driver.defaultSession.sendCommand).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({
        mobile: true,
        deviceScaleFactor: 1,
        height: 1500,
        width: 0,
      })
    );

    // Restoring.
    expect(mockContext.driver.defaultSession.sendCommand).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      expect.objectContaining({
        mobile: true,
        deviceScaleFactor: 2,
        height: 500,
        width: 0,
      })
    );
  });

  it('limits the screenshot height to the max Chrome can capture', async () => {
    const fpsGatherer = new FullPageScreenshotGatherer();

    contentSize = {width: 412, height: 100000};
    screenSize = {width: 412, height: 412, dpr: 1};
    screenshotAreaSize = contentSize;
    mockContext.settings = {
      ...mockContext.settings,
      formFactor: 'mobile',
      screenEmulation: {
        height: screenSize.height,
        width: screenSize.width,
        mobile: true,
        disabled: false,
      },
    };

    await fpsGatherer.getArtifact(mockContext.asContext());

    expect(mockContext.driver.defaultSession.sendCommand).toHaveBeenCalledWith(
      'Emulation.setDeviceMetricsOverride',
      {
        mobile: true,
        deviceScaleFactor: 1,
        width: 0,
        height: maxTextureSizeMock,
      }
    );
  });
});
