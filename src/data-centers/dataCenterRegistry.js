export const DATA_CENTER_IDS = Object.freeze(['geo', 'a5', 'brandMind']);
export const RESERVED_DATA_CENTER_IDS = Object.freeze(['crossModule']);

const DATA_CENTER_DEFINITIONS = Object.freeze({
  geo: Object.freeze({
    id: 'geo',
    name: 'GEO Data Center',
    displayName: 'GEO 数据指挥中心',
    description: '生成式引擎可见性、引用与机会信号中心',
    status: 'activePrototype',
    version: 'v1',
    dataStatus: 'waitingForGeoV2',
    theme: 'geo',
    entryLabel: '进入 GEO Data Center',
    returnTarget: 'universe'
  }),
  a5: Object.freeze({
    id: 'a5',
    name: '5A Asset Center',
    displayName: '5A 人群资产中心',
    description: '品牌人群资产、流转与机会结构中心',
    status: 'shell',
    version: 'v1',
    dataStatus: 'waitingForDataContract',
    theme: 'a5',
    entryLabel: '进入 5A Asset Center',
    returnTarget: 'universe'
  }),
  brandMind: Object.freeze({
    id: 'brandMind',
    name: 'Brand Mind Center',
    displayName: '品牌心智中心',
    description: '品牌心智覆盖、行业机会与强化方向中心',
    status: 'shell',
    version: 'v1',
    dataStatus: 'waitingForDataContract',
    theme: 'brandMind',
    entryLabel: '进入 Brand Mind Center',
    returnTarget: 'universe'
  })
});

export function createDataCenterRegistry(factories = {}) {
  const entries = DATA_CENTER_IDS.map((id) => {
    const definition = DATA_CENTER_DEFINITIONS[id];
    const factory = factories[id] ?? {};

    return Object.freeze({
      ...definition,
      dataAdapter: factory.dataAdapter ?? null,
      dataValidator: factory.dataValidator ?? null,
      dataSource: factory.dataSource ?? null,
      create(context = {}) {
        if (typeof factory.create !== 'function') {
          throw new Error(`Data Center “${id}” has no create factory.`);
        }
        return factory.create({ ...context, definition });
      },
      destroy(instance, context = {}) {
        if (typeof factory.destroy === 'function') {
          factory.destroy(instance, { ...context, definition });
          return;
        }
        instance?.destroy?.();
        instance?.dispose?.();
      }
    });
  });
  const entriesById = new Map(entries.map((entry) => [entry.id, entry]));

  return Object.freeze({
    ids: DATA_CENTER_IDS,
    list() {
      return entries;
    },
    has(id) {
      return entriesById.has(id);
    },
    get(id) {
      return entriesById.get(id) ?? null;
    }
  });
}

export function getDataCenterDefinition(id) {
  return DATA_CENTER_DEFINITIONS[id] ?? null;
}
