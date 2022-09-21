/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import path from 'path';

import log from 'lighthouse-logger';

import {Runner} from '../runner.js';
import defaultConfig from './default-config.js';
import {defaultNavigationConfig, nonSimulatedPassConfigOverrides} from './constants.js'; // eslint-disable-line max-len
import {
  isFRGathererDefn,
  throwInvalidDependencyOrder,
  isValidArtifactDependency,
  throwInvalidArtifactDependency,
  assertArtifactTopologicalOrder,
  assertValidConfig,
} from './validation.js';
import {filterConfigByGatherMode, filterConfigByExplicitFilters} from './filters.js';
import {
  deepCloneConfigJson,
  resolveSettings,
  resolveAuditsToDefns,
  resolveGathererToDefn,
  mergePlugins,
  mergeConfigFragment,
  mergeConfigFragmentArrayByKey,
} from './config-helpers.js';
import {getModuleDirectory} from '../../esm-utils.js';
import * as format from '../../shared/localization/format.js';

const defaultConfigPath = path.join(
  getModuleDirectory(import.meta),
  '../../config/default-config.js'
);

/**
 * @param {LH.Config.Json|undefined} configJSON
 * @param {{configPath?: string}} context
 * @return {{configWorkingCopy: LH.Config.Json, configDir?: string, configPath?: string}}
 */
function resolveWorkingCopy(configJSON, context) {
  let {configPath} = context;

  if (configPath && !path.isAbsolute(configPath)) {
    throw new Error('configPath must be an absolute path');
  }

  if (!configJSON) {
    configJSON = defaultConfig;
    configPath = defaultConfigPath;
  }

  // The directory of the config path, if one was provided.
  const configDir = configPath ? path.dirname(configPath) : undefined;

  return {
    configWorkingCopy: deepCloneConfigJson(configJSON),
    configPath,
    configDir,
  };
}

/**
 * @param {LH.Config.Json} configJSON
 * @return {LH.Config.Json}
 */
function resolveExtensions(configJSON) {
  if (!configJSON.extends) return configJSON;

  if (configJSON.extends !== 'lighthouse:default') {
    throw new Error('`lighthouse:default` is the only valid extension method.');
  }

  const {artifacts, ...extensionJSON} = configJSON;
  const defaultClone = deepCloneConfigJson(defaultConfig);
  const mergedConfig = mergeConfigFragment(defaultClone, extensionJSON);

  mergedConfig.artifacts = mergeConfigFragmentArrayByKey(
    defaultClone.artifacts,
    artifacts,
    artifact => artifact.id
  );

  return mergedConfig;
}

/**
 * Looks up the required artifact IDs for each dependency, throwing if no earlier artifact satisfies the dependency.
 *
 * @param {LH.Config.ArtifactJson} artifact
 * @param {LH.Config.AnyFRGathererDefn} gatherer
 * @param {Map<Symbol, LH.Config.AnyArtifactDefn>} artifactDefnsBySymbol
 * @return {LH.Config.AnyArtifactDefn['dependencies']}
 */
function resolveArtifactDependencies(artifact, gatherer, artifactDefnsBySymbol) {
  if (!('dependencies' in gatherer.instance.meta)) return undefined;

  const dependencies = Object.entries(gatherer.instance.meta.dependencies).map(
      ([dependencyName, artifactSymbol]) => {
        const dependency = artifactDefnsBySymbol.get(artifactSymbol);

        // Check that dependency was defined before us.
        if (!dependency) throwInvalidDependencyOrder(artifact.id, dependencyName);

        // Check that the phase relationship is OK too.
        const validDependency = isValidArtifactDependency(gatherer, dependency.gatherer);
        if (!validDependency) throwInvalidArtifactDependency(artifact.id, dependencyName);

        return [dependencyName, {id: dependency.id}];
      }
  );

  return Object.fromEntries(dependencies);
}

/**
 *
 * @param {LH.Config.ArtifactJson[]|null|undefined} artifacts
 * @param {string|undefined} configDir
 * @return {Promise<LH.Config.AnyArtifactDefn[] | null>}
 */
async function resolveArtifactsToDefns(artifacts, configDir) {
  if (!artifacts) return null;

  const status = {msg: 'Resolve artifact definitions', id: 'lh:config:resolveArtifactsToDefns'};
  log.time(status, 'verbose');

  /** @type {Map<Symbol, LH.Config.AnyArtifactDefn>} */
  const artifactDefnsBySymbol = new Map();

  const coreGathererList = Runner.getGathererList();
  const artifactDefns = [];
  for (const artifactJson of artifacts) {
    /** @type {LH.Config.GathererJson} */
    // @ts-expect-error - remove when legacy runner path is removed.
    const gathererJson = artifactJson.gatherer;

    const gatherer = await resolveGathererToDefn(gathererJson, coreGathererList, configDir);
    if (!isFRGathererDefn(gatherer)) {
      throw new Error(`${gatherer.instance.name} gatherer does not have a Fraggle Rock meta obj`);
    }

    /** @type {LH.Config.AnyArtifactDefn} */
    // @ts-expect-error - Typescript can't validate the gatherer and dependencies match
    // even though it knows that they're each valid on their own.
    const artifact = {
      id: artifactJson.id,
      gatherer,
      dependencies: resolveArtifactDependencies(artifactJson, gatherer, artifactDefnsBySymbol),
    };

    const symbol = artifact.gatherer.instance.meta.symbol;
    if (symbol) artifactDefnsBySymbol.set(symbol, artifact);
    artifactDefns.push(artifact);
  }

  log.timeEnd(status);
  return artifactDefns;
}

/**
 * Overrides the settings that may not apply to the chosen gather mode.
 *
 * @param {LH.Config.Settings} settings
 * @param {LH.Gatherer.GatherMode} gatherMode
 */
function overrideSettingsForGatherMode(settings, gatherMode) {
  if (gatherMode === 'timespan') {
    if (settings.throttlingMethod === 'simulate') {
      settings.throttlingMethod = 'devtools';
    }
  }
}

/**
 * Overrides the quiet windows when throttlingMethod requires observation.
 *
 * @param {LH.Config.NavigationDefn} navigation
 * @param {LH.Config.Settings} settings
 */
function overrideNavigationThrottlingWindows(navigation, settings) {
  if (navigation.disableThrottling) return;
  if (settings.throttlingMethod === 'simulate') return;

  navigation.cpuQuietThresholdMs = Math.max(
    navigation.cpuQuietThresholdMs || 0,
    nonSimulatedPassConfigOverrides.cpuQuietThresholdMs
  );
  navigation.networkQuietThresholdMs = Math.max(
    navigation.networkQuietThresholdMs || 0,
    nonSimulatedPassConfigOverrides.networkQuietThresholdMs
  );
  navigation.pauseAfterFcpMs = Math.max(
    navigation.pauseAfterFcpMs || 0,
    nonSimulatedPassConfigOverrides.pauseAfterFcpMs
  );
  navigation.pauseAfterLoadMs = Math.max(
    navigation.pauseAfterLoadMs || 0,
    nonSimulatedPassConfigOverrides.pauseAfterLoadMs
  );
}

/**
 * @param {LH.Config.AnyArtifactDefn[]|null|undefined} artifactDefns
 * @param {LH.Config.Settings} settings
 * @return {LH.Config.NavigationDefn[] | null}
 */
function resolveFakeNavigations(artifactDefns, settings) {
  if (!artifactDefns) return null;

  const status = {msg: 'Resolve navigation definitions', id: 'lh:config:resolveNavigationsToDefns'};
  log.time(status, 'verbose');

  const resolvedNavigation = {
    ...defaultNavigationConfig,
    artifacts: artifactDefns,
    pauseAfterFcpMs: settings.pauseAfterFcpMs,
    pauseAfterLoadMs: settings.pauseAfterLoadMs,
    networkQuietThresholdMs: settings.networkQuietThresholdMs,
    cpuQuietThresholdMs: settings.cpuQuietThresholdMs,
    blankPage: settings.blankPage,
  };

  overrideNavigationThrottlingWindows(resolvedNavigation, settings);

  const navigations = [resolvedNavigation];
  assertArtifactTopologicalOrder(navigations);

  log.timeEnd(status);
  return navigations;
}

/**
 * @param {LH.Gatherer.GatherMode} gatherMode
 * @param {LH.Config.Json=} configJSON
 * @param {LH.Flags=} flags
 * @return {Promise<{config: LH.Config.FRConfig, warnings: string[]}>}
 */
async function initializeConfig(gatherMode, configJSON, flags = {}) {
  const status = {msg: 'Initialize config', id: 'lh:config'};
  log.time(status, 'verbose');

  let {configWorkingCopy, configDir} = resolveWorkingCopy(configJSON, flags);

  configWorkingCopy = resolveExtensions(configWorkingCopy);
  configWorkingCopy = await mergePlugins(configWorkingCopy, configDir, flags);

  const settings = resolveSettings(configWorkingCopy.settings || {}, flags);
  overrideSettingsForGatherMode(settings, gatherMode);

  const artifacts = await resolveArtifactsToDefns(configWorkingCopy.artifacts, configDir);

  const navigations = resolveFakeNavigations(artifacts, settings);

  /** @type {LH.Config.FRConfig} */
  let config = {
    artifacts,
    navigations,
    audits: await resolveAuditsToDefns(configWorkingCopy.audits, configDir),
    categories: configWorkingCopy.categories || null,
    groups: configWorkingCopy.groups || null,
    settings,
  };

  const {warnings} = assertValidConfig(config);

  config = filterConfigByGatherMode(config, gatherMode);
  config = filterConfigByExplicitFilters(config, settings);

  log.timeEnd(status);
  return {config, warnings};
}

/**
 * @param {LH.Config.FRConfig} config
 * @return {string}
 */
function getConfigDisplayString(config) {
  /** @type {LH.Config.FRConfig} */
  const jsonConfig = JSON.parse(JSON.stringify(config));

  if (jsonConfig.navigations) {
    for (const navigation of jsonConfig.navigations) {
      for (let i = 0; i < navigation.artifacts.length; ++i) {
        // @ts-expect-error Breaking the Config.AnyArtifactDefn type.
        navigation.artifacts[i] = navigation.artifacts[i].id;
      }
    }
  }

  if (jsonConfig.artifacts) {
    for (const artifactDefn of jsonConfig.artifacts) {
      // @ts-expect-error Breaking the Config.AnyArtifactDefn type.
      artifactDefn.gatherer = artifactDefn.gatherer.path;
      // Dependencies are not declared on Config JSON
      artifactDefn.dependencies = undefined;
    }
  }

  if (jsonConfig.audits) {
    for (const auditDefn of jsonConfig.audits) {
      // @ts-expect-error Breaking the Config.AuditDefn type.
      auditDefn.implementation = undefined;
      if (Object.keys(auditDefn.options).length === 0) {
        // @ts-expect-error Breaking the Config.AuditDefn type.
        auditDefn.options = undefined;
      }
    }
  }

  // Printed config is more useful with localized strings.
  format.replaceIcuMessages(jsonConfig, jsonConfig.settings.locale);

  return JSON.stringify(jsonConfig, null, 2);
}

export {
  resolveWorkingCopy,
  initializeConfig,
  getConfigDisplayString,
};
