const DATA_CENTER_STATUS_KEY = '__ACTIVE_THEORY_DATA_CENTER_STATUS__';

export function createDataCenterLifecycle({ registry, windowObject = window } = {}) {
  if (!registry) throw new Error('Data Center lifecycle requires a registry.');

  let activeDataCenterId = null;
  let activeDefinition = null;
  let activeInstance = null;
  let createCount = 0;
  let destroyCount = 0;
  let disposed = false;

  publish('idle');

  return Object.freeze({
    open,
    destroy,
    dispose,
    getActiveDataCenterId: () => activeDataCenterId,
    getActiveInstance: () => activeInstance,
    getStatus
  });

  function open(id, context = {}) {
    if (disposed) throw new Error('Data Center lifecycle is disposed.');
    const definition = registry.get(id);
    if (!definition) throw new Error(`Unknown Data Center “${id}”.`);

    if (activeDataCenterId === id && activeInstance) {
      publish('unchanged');
      return activeInstance;
    }

    destroy({ reason: 'switch', nextDataCenterId: id });
    activeDefinition = definition;
    activeInstance = definition.create(context);
    activeDataCenterId = id;
    createCount += 1;
    publish('active');
    return activeInstance;
  }

  function destroy(context = {}) {
    if (!activeDefinition || !activeInstance) {
      activeDataCenterId = null;
      activeDefinition = null;
      activeInstance = null;
      publish('idle');
      return false;
    }

    const definition = activeDefinition;
    const instance = activeInstance;
    activeDataCenterId = null;
    activeDefinition = null;
    activeInstance = null;
    definition.destroy(instance, context);
    destroyCount += 1;
    publish('destroyed');
    return true;
  }

  function dispose() {
    if (disposed) return;
    destroy({ reason: 'lifecycle-dispose' });
    disposed = true;
    delete windowObject[DATA_CENTER_STATUS_KEY];
    windowObject.document?.documentElement?.removeAttribute?.('data-active-data-center');
  }

  function getStatus() {
    return {
      activeDataCenterId,
      instanceCount: activeInstance ? 1 : 0,
      createCount,
      destroyCount,
      state: activeInstance ? 'active' : 'idle'
    };
  }

  function publish(state) {
    const status = { ...getStatus(), state };
    windowObject[DATA_CENTER_STATUS_KEY] = status;
    const root = windowObject.document?.documentElement;
    if (!root) return;
    if (activeDataCenterId) root.dataset.activeDataCenter = activeDataCenterId;
    else delete root.dataset.activeDataCenter;
    root.dataset.dataCenterInstanceCount = String(status.instanceCount);
  }
}
