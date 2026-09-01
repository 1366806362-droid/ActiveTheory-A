import {
  BRAND_UNIVERSE_MOCKS,
  buildVisualState
} from '../index.js';

for (const [mockId, snapshot] of Object.entries(BRAND_UNIVERSE_MOCKS)) {
  const visualState = buildVisualState(snapshot);
  const summary = {
    snapshotId: visualState.metadata.snapshotId,
    sourceType: visualState.metadata.sourceType,
    geoCoreEnergy: visualState.geo.signalCore.energy,
    a1Scale: visualState.fiveA.stages.A1.scale,
    a2ToA3Flow: visualState.fiveA.transitions.A2_TO_A3.flowStrength,
    brandMindCoreDensity: visualState.brandMind.core.density
  };
  console.log(`${mockId}: ${JSON.stringify(summary)}`);
}
