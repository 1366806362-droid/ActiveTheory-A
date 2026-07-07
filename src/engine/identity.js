export const ACTIVE_THEORY_IDENTITY = Object.freeze({
  primaryColor: '#0a0f1a',
  accentColor: '#4da3ff',
  highlightColor: '#7fffd4',
  backgroundColor: '#05070c',
  fogColor: '#020814',
  material: Object.freeze({
    metalness: 0.85,
    roughness: 0.25,
    emissiveIntensity: 0.3
  })
});

let activeIdentity = ACTIVE_THEORY_IDENTITY;

export function initializeIdentitySystem() {
  activeIdentity = ACTIVE_THEORY_IDENTITY;
  return activeIdentity;
}

export function getIdentity() {
  return activeIdentity;
}

export const identityManager = {
  initializeIdentitySystem,
  getIdentity
};
