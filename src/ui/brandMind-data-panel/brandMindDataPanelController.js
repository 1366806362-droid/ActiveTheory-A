export const BRAND_MIND_DATA_PANEL_ISOLATED_EVENTS = Object.freeze([
  'pointerdown',
  'pointerup',
  'click',
  'dblclick',
  'wheel',
  'touchstart',
  'touchmove',
  'touchend'
]);

export function isBrandMindDataPanelIsolationEvent(eventType) {
  return BRAND_MIND_DATA_PANEL_ISOLATED_EVENTS.includes(eventType);
}

export function createBrandMindDataPanelController({ onStateChange = () => {} } = {}) {
  let openState = false;
  let destroyed = false;

  function setOpen(nextOpen, reason) {
    if (destroyed || openState === nextOpen) return false;
    openState = nextOpen;
    onStateChange(Object.freeze({ open: openState, reason }));
    return true;
  }

  return Object.freeze({
    open(reason = 'primary-core') {
      return setOpen(true, reason);
    },
    close(reason = 'close-button') {
      return setOpen(false, reason);
    },
    toggle(reason = 'primary-core') {
      return setOpen(!openState, reason);
    },
    handleKeyDown(event) {
      if (event?.key !== 'Escape' || !openState) return false;
      return setOpen(false, 'escape');
    },
    isOpen() {
      return openState;
    },
    destroy() {
      destroyed = true;
      openState = false;
    }
  });
}
