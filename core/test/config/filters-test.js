/**
 * @license Copyright 2020 The Lighthouse Authors. All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.
 */

import log from 'lighthouse-logger';

import {Audit as BaseAudit} from '../../audits/audit.js';
import BaseGatherer from '../../gather/base-gatherer.js';
import {defaultSettings, defaultNavigationConfig} from '../../config/constants.js';
import * as filters from '../../config/filters.js';
import {initializeConfig} from '../../config/config.js';

describe('Fraggle Rock Config Filtering', () => {
  const snapshotGatherer = new BaseGatherer();
  snapshotGatherer.meta = {supportedModes: ['snapshot']};
  const timespanGatherer = new BaseGatherer();
  timespanGatherer.meta = {supportedModes: ['timespan']};

  const artifacts = [
    {id: 'Snapshot', gatherer: {instance: snapshotGatherer}},
    {id: 'Timespan', gatherer: {instance: timespanGatherer}},
  ];

  const navigationArtifacts = [
    ...artifacts,
    {id: 'Snapshot2', gatherer: {instance: snapshotGatherer}},
  ];

  const auditMeta = {title: '', description: ''};
  class SnapshotAudit extends BaseAudit {
    static meta = {
      id: 'snapshot',
      requiredArtifacts: /** @type {any} */ (['Snapshot']),
      ...auditMeta,
    };
  }
  class ManualAudit extends BaseAudit {
    static meta = {
      id: 'manual',
      scoreDisplayMode: BaseAudit.SCORING_MODES.MANUAL,
      requiredArtifacts: /** @type {any} */ ([]),
      ...auditMeta,
    };
  }
  class TimespanAudit extends BaseAudit {
    static meta = {
      id: 'timespan',
      requiredArtifacts: /** @type {any} */ (['Timespan']),
      ...auditMeta,
    };
  }
  class NavigationAudit extends BaseAudit {
    static meta = {
      id: 'navigation',
      requiredArtifacts: /** @type {any} */ (['Snapshot', 'Timespan']),
      ...auditMeta,
    };
  }
  class NavigationOnlyAudit extends BaseAudit {
    static meta = {
      id: 'navigation-only',
      requiredArtifacts: /** @type {any} */ (['Snapshot', 'Timespan']),
      supportedModes: /** @type {['navigation']} */ (['navigation']),
      ...auditMeta,
    };
  }

  const audits = [SnapshotAudit, TimespanAudit, NavigationAudit, ManualAudit].map(audit => ({
    implementation: audit,
    options: {},
  }));

  /** @type {Array<LH.Config.NavigationDefn>} */
  const navigations = [
    {
      ...defaultNavigationConfig,
      id: 'firstPass',
      artifacts: [
        {id: 'Snapshot', gatherer: {instance: snapshotGatherer}},
        {id: 'Timespan', gatherer: {instance: timespanGatherer}},
      ],
    },
    {
      ...defaultNavigationConfig,
      id: 'secondPass',
      artifacts: [
        {id: 'Snapshot2', gatherer: {instance: snapshotGatherer}},
      ],
    },
  ];

  describe('filterArtifactsByGatherMode', () => {
    it('should handle null', () => {
      expect(filters.filterArtifactsByGatherMode(null, 'snapshot')).toBe(null);
    });

    it('should filter to the correct mode', () => {
      expect(filters.filterArtifactsByGatherMode(artifacts, 'snapshot')).toEqual([
        {id: 'Snapshot', gatherer: {instance: snapshotGatherer}},
      ]);

      expect(filters.filterArtifactsByGatherMode(artifacts, 'timespan')).toEqual([
        {id: 'Timespan', gatherer: {instance: timespanGatherer}},
      ]);
    });
  });

  describe('filterArtifactsByAvailableAudits', () => {
    it('should handle null artifacts', () => {
      expect(filters.filterArtifactsByAvailableAudits(null, audits)).toBe(null);
    });

    it('should handle null audits', () => {
      expect(filters.filterArtifactsByAvailableAudits(artifacts, null)).toBe(artifacts);
    });

    it('should filter to used artifacts', () => {
      expect(filters.filterArtifactsByAvailableAudits(artifacts, [
        {implementation: SnapshotAudit, options: {}},
      ])).toEqual([
        {id: 'Snapshot', gatherer: {instance: snapshotGatherer}},
      ]);

      expect(filters.filterArtifactsByAvailableAudits(artifacts, [
        {implementation: NavigationAudit, options: {}},
      ])).toEqual([
        {id: 'Snapshot', gatherer: {instance: snapshotGatherer}},
        {id: 'Timespan', gatherer: {instance: timespanGatherer}},
      ]);
    });

    it('should handle transitive dependencies', () => {
      const baseSymbol = Symbol('baseGatherer');
      const base = new BaseGatherer();
      base.meta = {supportedModes: ['snapshot'], symbol: baseSymbol};

      const dependentSymbol = Symbol('dependentGatherer');
      /** @type {LH.Gatherer.FRGathererInstance<'Accessibility'>} */
      const dependent = Object.assign(new BaseGatherer(), {
        meta: {
          supportedModes: ['snapshot'],
          dependencies: {Accessibility: baseSymbol},
          symbol: dependentSymbol,
        },
      });

      /** @type {LH.Gatherer.FRGathererInstance<'Accessibility'>} */
      const dependentsDependent = Object.assign(new BaseGatherer(), {
        meta: {
          supportedModes: ['snapshot'],
          dependencies: {Accessibility: dependentSymbol},
        },
      });


      /** @type {LH.Config.AnyArtifactDefn[]} */
      const transitiveArtifacts = [
        {id: 'DependencysDependency', gatherer: {instance: base}},
        {
          id: 'SnapshotDependency',
          gatherer: {instance: dependent},
          dependencies: {Accessibility: {id: 'DependencysDependency'}},
        },
        {
          id: 'Snapshot',
          gatherer: {instance: dependentsDependent},
          dependencies: {Accessibility: {id: 'SnapshotDependency'}},
        },
      ];

      expect(filters.filterArtifactsByAvailableAudits(transitiveArtifacts, [
        {implementation: SnapshotAudit, options: {}},
      ])).toMatchObject([
        {id: 'DependencysDependency', gatherer: {instance: base}},
        {id: 'SnapshotDependency', gatherer: {instance: dependent}},
        {id: 'Snapshot', gatherer: {instance: dependentsDependent}},
      ]);
    });
  });

  describe('filterNavigationsByAvailableArtifacts', () => {
    it('should handle null', () => {
      expect(filters.filterNavigationsByAvailableArtifacts(null, [])).toBe(null);
    });

    it('should filter out entire navigations', () => {
      const partialArtifacts = [{id: 'Timespan', gatherer: {instance: snapshotGatherer}}];
      const filtered = filters.filterNavigationsByAvailableArtifacts(navigations, partialArtifacts);
      expect(filtered).toMatchObject([
        {id: 'firstPass', artifacts: [{id: 'Timespan'}]},
      ]);
    });

    it('should filter within navigation', () => {
      const partialArtifacts = [
        {id: 'Snapshot', gatherer: {instance: snapshotGatherer}},
        {id: 'Snapshot2', gatherer: {instance: snapshotGatherer}},
      ];
      const filtered = filters.filterNavigationsByAvailableArtifacts(navigations, partialArtifacts);
      expect(filtered).toMatchObject([
        {id: 'firstPass', artifacts: [{id: 'Snapshot'}]},
        {id: 'secondPass', artifacts: [{id: 'Snapshot2'}]},
      ]);
    });
  });

  describe('filterAuditsByAvailableArtifacts', () => {
    it('should handle null', () => {
      expect(filters.filterAuditsByAvailableArtifacts(null, [])).toBe(null);
    });

    it('should filter when partial artifacts available', () => {
      const partialArtifacts = [{id: 'Snapshot', gatherer: {instance: snapshotGatherer}}];
      expect(filters.filterAuditsByAvailableArtifacts(audits, partialArtifacts)).toEqual([
        {implementation: SnapshotAudit, options: {}},
        {implementation: ManualAudit, options: {}},
      ]);
    });

    it('should not filter audits with dependencies on base artifacts', () => {
      class SnapshotWithBase extends BaseAudit {
        static meta = {
          id: 'snapshot',
          requiredArtifacts: /** @type {any} */ (['Snapshot', 'URL', 'Timing']),
          ...auditMeta,
        };
      }

      const auditsWithBaseArtifacts = [SnapshotWithBase, TimespanAudit].map(audit => ({
        implementation: audit,
        options: {},
      }));
      const partialArtifacts = [{id: 'Snapshot', gatherer: {instance: snapshotGatherer}}];
      expect(
        filters.filterAuditsByAvailableArtifacts(auditsWithBaseArtifacts, partialArtifacts)
      ).toEqual([{implementation: SnapshotWithBase, options: {}}]);
    });

    it('should be noop when all artifacts available', () => {
      expect(filters.filterAuditsByAvailableArtifacts(audits, artifacts)).toEqual(audits);
    });
  });

  /** @type {LH.Config.FRConfig['categories']} */
  const categories = {
    snapshot: {title: 'Snapshot', auditRefs: [{id: 'snapshot', weight: 0}]},
    timespan: {title: 'Timespan', auditRefs: [{id: 'timespan', weight: 0}]},
    navigation: {title: 'Navigation', auditRefs: [{id: 'navigation', weight: 0}]},
    manual: {title: 'Manual', auditRefs: [{id: 'manual', weight: 0}]},
    mixed: {
      title: 'Mixed',
      auditRefs: [
        {id: 'snapshot', weight: 0},
        {id: 'timespan', weight: 0},
        {id: 'navigation', weight: 0},
      ],
    },
  };

  describe('filterCategoriesByAvailableAudits', () => {
    it('should handle null', () => {
      expect(filters.filterCategoriesByAvailableAudits(null, [])).toBe(null);
    });

    it('should filter entire categories', () => {
      const partialAudits = [{implementation: SnapshotAudit, options: {}}];
      const filtered = filters.filterCategoriesByAvailableAudits(categories, partialAudits);
      expect(filtered).not.toMatchObject({
        timespan: {},
        navigation: {},
      });
      expect(filtered).toMatchObject({
        snapshot: {},
        mixed: {},
      });
    });

    it('should filter entire categories when all remaining audits are manual', () => {
      const partialAudits = [
        {implementation: SnapshotAudit, options: {}},
        {implementation: ManualAudit, options: {}},
      ];

      const filteredCategories = filters.filterCategoriesByAvailableAudits(
        {
          snapshot: categories.snapshot,
          timespanWithManual: {
            title: 'Timespan + Manual',
            auditRefs: [{id: 'timespan', weight: 0}, {id: 'manual', weight: 0}],
          },
        },
        partialAudits
      );
      expect(filteredCategories).not.toHaveProperty('timespanWithManual');
    });

    it('should filter audits within categories', () => {
      const partialAudits = [{implementation: SnapshotAudit, options: {}}];
      const filtered = filters.filterCategoriesByAvailableAudits(categories, partialAudits);
      if (!filtered) throw new Error(`Failed to produce a categories object`);
      expect(filtered.mixed).toEqual({
        title: 'Mixed',
        auditRefs: [{id: 'snapshot', weight: 0}],
      });
    });

    it('should be noop when all audits available', () => {
      expect(filters.filterCategoriesByAvailableAudits(categories, audits)).toEqual(categories);
    });
  });

  describe('filterCategoriesByGatherMode', () => {
    it('should handle null', () => {
      expect(filters.filterCategoriesByGatherMode(null, 'timespan')).toBeNull();
    });

    it('should be noop when filter is not applied', () => {
      expect(filters.filterCategoriesByGatherMode(categories, 'timespan')).toEqual(categories);
    });

    it('should remove categories that do not support the provided mode', () => {
      /** @type {Record<string, LH.Config.Category>} */
      const categories = {
        timespan: {
          title: 'Timespan',
          auditRefs: [{id: 'timespan', weight: 0}],
          supportedModes: ['timespan'],
        },
        snapshot: {
          title: 'Snapshot',
          auditRefs: [{id: 'snapshot', weight: 0}],
          supportedModes: ['snapshot'],
        },
      };
      expect(filters.filterCategoriesByGatherMode(categories, 'timespan')).toEqual({
        timespan: categories.timespan,
      });
    });
  });

  describe('filterAuditsByGatherMode', () => {
    it('should handle null', () => {
      expect(filters.filterAuditsByGatherMode(null, 'timespan')).toBeNull();
    });

    it('should filter unsupported audits', () => {
      const timespanAudits = [TimespanAudit, NavigationOnlyAudit].map(audit => ({
        implementation: audit,
        options: {},
      }));
      expect(filters.filterAuditsByGatherMode(timespanAudits, 'timespan')).toEqual([
        {implementation: TimespanAudit, options: {}},
      ]);
    });

    it('should keep audits without explicit modes defined', () => {
      const timespanAudits = [TimespanAudit, NavigationAudit].map(audit => ({
        implementation: audit,
        options: {},
      }));
      expect(filters.filterAuditsByGatherMode(timespanAudits, 'timespan')).toEqual([
        {implementation: TimespanAudit, options: {}},
        {implementation: NavigationAudit, options: {}},
      ]);
    });
  });

  describe('filterConfigByGatherMode', () => {
    it('should filter the entire config', () => {
      const config = {
        artifacts,
        navigations,
        audits,
        categories,
        groups: null,
        settings: defaultSettings,
      };

      expect(filters.filterConfigByGatherMode(config, 'snapshot')).toMatchObject({
        navigations,
        artifacts: [{id: 'Snapshot'}],
        audits: [{implementation: SnapshotAudit}, {implementation: ManualAudit}],
        categories: {
          snapshot: {},
          manual: {},
          mixed: {auditRefs: [{id: 'snapshot'}]},
        },
      });
    });
  });

  describe('filterConfigByExplicitFilters', () => {
    /** @type {LH.Config.FRConfig} */
    let config;

    beforeEach(() => {
      config = {
        artifacts: navigationArtifacts,
        navigations,
        audits,
        categories,
        groups: null,
        settings: defaultSettings,
      };
    });

    it('should filter via onlyAudits', () => {
      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyAudits: ['snapshot'],
        onlyCategories: null,
        skipAudits: null,
      });

      expect(filtered).toMatchObject({
        artifacts: [{id: 'Snapshot'}],
        audits: [{implementation: SnapshotAudit}],
        categories: {
          snapshot: {},
          mixed: {auditRefs: [{id: 'snapshot'}]},
        },
      });
    });

    it('should filter via skipAudits', () => {
      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyAudits: null,
        onlyCategories: null,
        skipAudits: ['snapshot', 'navigation'],
      });
      expect(filtered).toMatchObject({
        artifacts: [{id: 'Timespan'}],
        audits: [{implementation: TimespanAudit}, {implementation: ManualAudit}],
        categories: {
          timespan: {},
          mixed: {auditRefs: [{id: 'timespan'}]},
        },
      });
    });

    it('should filter via onlyCategories', () => {
      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyAudits: null,
        onlyCategories: ['timespan'],
        skipAudits: null,
      });
      if (!filtered.categories) throw new Error('Failed to keep any categories');
      expect(Object.keys(filtered.categories)).toEqual(['timespan']);
      expect(filtered).toMatchObject({
        artifacts: [{id: 'Timespan'}],
        audits: [{implementation: TimespanAudit}],
        categories: {
          timespan: {},
        },
      });
    });

    it('should warn and drop unknown onlyCategories entries', () => {
      /** @type {Array<unknown>} */
      const warnings = [];
      /** @param {unknown} evt */
      const saveWarning = evt => warnings.push(evt);

      log.events.on('warning', saveWarning);
      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyAudits: null,
        onlyCategories: ['timespan', 'thisIsNotACategory'],
        skipAudits: null,
      });
      log.events.off('warning', saveWarning);

      if (!filtered.categories) throw new Error('Failed to keep any categories');
      expect(Object.keys(filtered.categories)).toEqual(['timespan']);
      expect(filtered).toMatchObject({
        artifacts: [{id: 'Timespan'}],
        audits: [{implementation: TimespanAudit}],
        categories: {
          timespan: {},
        },
      });
      expect(warnings).toEqual(expect.arrayContaining([
        ['config', `unrecognized category in 'onlyCategories': thisIsNotACategory`],
      ]));
    });

    it('should filter via a combination of filters', () => {
      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyCategories: ['mixed'],
        onlyAudits: ['snapshot', 'timespan'],
        skipAudits: ['timespan', 'navigation'],
      });
      expect(filtered).toMatchObject({
        artifacts: [{id: 'Snapshot'}],
        audits: [{implementation: SnapshotAudit}],
        categories: {
          mixed: {},
        },
      });
    });

    it('should filter out audits and artifacts not in the categories by default', () => {
      config = {
        ...config,
        audits: [
          ...audits,
          {implementation: NavigationOnlyAudit, options: {}},
        ],
      };

      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyAudits: null,
        onlyCategories: null,
        skipAudits: null,
      });
      expect(filtered).toMatchObject({
        navigations: [{id: 'firstPass'}],
        artifacts: [{id: 'Snapshot'}, {id: 'Timespan'}],
        audits: [
          {implementation: SnapshotAudit},
          {implementation: TimespanAudit},
          {implementation: NavigationAudit},
          {implementation: ManualAudit},
        ],
      });
    });

    it('should keep all audits if there are no categories', () => {
      config = {
        ...config,
        audits: [
          ...audits,
          {implementation: NavigationOnlyAudit, options: {}},
        ],
        categories: {},
      };

      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyAudits: null,
        onlyCategories: null,
        skipAudits: null,
      });
      expect(filtered).toMatchObject({
        navigations: [{id: 'firstPass'}],
        artifacts: [{id: 'Snapshot'}, {id: 'Timespan'}],
        audits: [
          {implementation: SnapshotAudit},
          {implementation: TimespanAudit},
          {implementation: NavigationAudit},
          {implementation: ManualAudit},
          {implementation: NavigationOnlyAudit},
        ],
      });
    });

    it('should preserve full-page-screenshot', async () => {
      config = (await initializeConfig('navigation')).config;

      const filtered = filters.filterConfigByExplicitFilters(config, {
        onlyAudits: ['color-contrast'],
        onlyCategories: null,
        skipAudits: null,
      });

      if (!filtered.audits) throw new Error('No audits produced');
      const auditIds = filtered.audits.map(audit => audit.implementation.meta.id);
      expect(auditIds).toEqual(['full-page-screenshot', 'color-contrast']);
    });
  });
});
