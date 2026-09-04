import { cloneFakeRendererState } from './fakeRendererState.js';

export function rollbackBindingApply(applyResult) {
  if (!applyResult?.previousState) {
    return Object.freeze({ ok: false, state: null, reason: 'ROLLBACK_STATE_UNAVAILABLE' });
  }
  return Object.freeze({
    ok: true,
    state: cloneFakeRendererState(applyResult.previousState),
    restoredEntries: applyResult.applied?.length ?? 0
  });
}
