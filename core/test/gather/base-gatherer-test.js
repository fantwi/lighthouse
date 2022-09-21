/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import Gatherer from '../../gather/base-gatherer.js';
import {fnAny} from '../test-utils.js';

/** @type {any} */
const fakeParam = {};

describe('BaseGatherer', () => {
  it('should fullfill the contract of both interfaces', async () => {
    const gatherer = new Gatherer();

    // Fraggle Rock Gatherer contract
    expect(typeof gatherer.meta).toBe('object');
    expect(gatherer.getArtifact(fakeParam)).toBe(undefined);

    // Legacy Gatherer contract
    expect(typeof gatherer.name).toBe('string');
    expect(await gatherer.beforePass(fakeParam)).toBe(undefined);
    expect(await gatherer.pass(fakeParam)).toBe(undefined);
    expect(await gatherer.afterPass(fakeParam, fakeParam)).toBe(undefined);
  });

  describe('.beforePass', () => {
    it('delegates to startInstrumentation by default', async () => {
      class MyGatherer extends Gatherer {
        startInstrumentation = fnAny();
        startSensitiveInstrumentation = fnAny();
      }

      const gatherer = new MyGatherer();
      await gatherer.beforePass(fakeParam);
      expect(gatherer.startInstrumentation).toHaveBeenCalled();
      expect(gatherer.startSensitiveInstrumentation).toHaveBeenCalled();
    });
  });

  describe('.afterPass', () => {
    it('delegates to getArtifact by default', async () => {
      class MyGatherer extends Gatherer {
        /** @param {*} _ */
        getArtifact(_) {
          return 'Hello, Fraggle!';
        }
      }

      const gatherer = new MyGatherer();
      expect(gatherer.getArtifact(fakeParam)).toEqual('Hello, Fraggle!');
      expect(await gatherer.afterPass(fakeParam, fakeParam)).toEqual('Hello, Fraggle!');
    });

    it('invokes stopInstrumentation when supported', async () => {
      class MyGatherer extends Gatherer {
        /** @type {LH.Gatherer.GathererMeta} */
        meta = {supportedModes: ['timespan']};
        stopInstrumentation = fnAny();
        stopSensitiveInstrumentation = fnAny();
      }

      const gatherer = new MyGatherer();
      await gatherer.afterPass(fakeParam, fakeParam);
      expect(gatherer.stopInstrumentation).toHaveBeenCalled();
      expect(gatherer.stopSensitiveInstrumentation).toHaveBeenCalled();
    });

    it('throws if no override and has dependencies', async () => {
      class MyGatherer extends Gatherer {
        /** @type {LH.Gatherer.GathererMeta<'Trace'>} */
        meta = {supportedModes: ['timespan'], dependencies: {Trace: Symbol('Trace')}};
        stopInstrumentation = fnAny();
        stopSensitiveInstrumentation = fnAny();
      }

      const gatherer = new MyGatherer();
      const afterPassPromise = gatherer.afterPass(fakeParam, fakeParam);
      await expect(afterPassPromise).rejects.toThrowError(/Gatherer with dependencies/);
      expect(gatherer.stopInstrumentation).not.toHaveBeenCalled();
      expect(gatherer.stopSensitiveInstrumentation).not.toHaveBeenCalled();
    });
  });
});
