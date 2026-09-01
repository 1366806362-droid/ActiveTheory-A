import {
  BRAND_UNIVERSE_VISUAL_STATE_VERSION,
  FIVE_A_STAGES,
  FIVE_A_TRANSITIONS,
  GEO_SIGNAL_IDS,
  VISUAL_MAPPING_VERSION,
  deepFreeze
} from '../contracts/brandUniverseContract.js';
import {
  ART_DIRECTION_GUARDRAILS,
  applyVisualGuardrail
} from './artDirectionGuardrails.js';
import {
  NORMALIZATION_STRATEGIES,
  meanNormalized,
  normalizeConfidence,
  normalizeDataPoint
} from './normalizers.js';
import { validateSnapshot } from '../runtime/validateSnapshot.js';

export const DATA_TO_VISUAL_MAPPING = Object.freeze({
  volume: Object.freeze({ strategy: NORMALIZATION_STRATEGIES.LOG, min: 0, max: 100000 }),
  score: Object.freeze({ strategy: NORMALIZATION_STRATEGIES.BOUNDED, min: 0, max: 100 }),
  rate: Object.freeze({ strategy: NORMALIZATION_STRATEGIES.BOUNDED, min: 0, max: 1 }),
  confidence: Object.freeze({ strategy: NORMALIZATION_STRATEGIES.CLAMP, min: 0, max: 1 }),
  associationWeight: Object.freeze({
    strategy: NORMALIZATION_STRATEGIES.BOUNDED,
    min: 0,
    max: 100
  })
});

export function buildVisualState(snapshot) {
  const validation = validateSnapshot(snapshot);
  if (!validation.ok) {
    throw new Error(`Invalid BrandUniverseSnapshot:\n- ${validation.errors.join('\n- ')}`);
  }

  const geo = buildGeoVisualState(snapshot.geo);
  const fiveA = buildFiveAVisualState(snapshot.fiveA);
  const brandMind = buildBrandMindVisualState(snapshot.brandMind);
  const availability = {
    geo: snapshot.geo !== null,
    fiveA: snapshot.fiveA !== null,
    brandMind: snapshot.brandMind !== null
  };

  return deepFreeze({
    metadata: {
      brandId: snapshot.metadata.brandId,
      snapshotId: snapshot.metadata.snapshotId,
      capturedAt: snapshot.metadata.capturedAt,
      schemaVersion: BRAND_UNIVERSE_VISUAL_STATE_VERSION,
      sourceSnapshotSchemaVersion: snapshot.metadata.schemaVersion,
      sourceType: snapshot.metadata.sourceType,
      mappingVersion: VISUAL_MAPPING_VERSION
    },
    availability,
    home: buildHomeVisualState({ geo, fiveA, brandMind, availability }),
    geo,
    fiveA,
    brandMind,
    diagnostics: {
      missingModules: Object.entries(availability)
        .filter(([, available]) => !available)
        .map(([moduleId]) => moduleId),
      validationWarnings: [...validation.warnings],
      dataControlsComposition: false,
      rendererIntegration: 'NOT_CONNECTED'
    }
  });
}

function buildGeoVisualState(geo) {
  const mapped = Object.fromEntries(GEO_SIGNAL_IDS.map((signalId) => [
    visualGeoId(signalId),
    mapGeoSignal(geo?.[signalId])
  ]));
  return mapped;
}

function mapGeoSignal(signal) {
  const volume = normalizeDataPoint(signal?.volume, DATA_TO_VISUAL_MAPPING.volume);
  const strength = normalizeDataPoint(signal?.strength, DATA_TO_VISUAL_MAPPING.score);
  const quality = normalizeDataPoint(signal?.quality, DATA_TO_VISUAL_MAPPING.score);
  const opportunity = normalizeDataPoint(signal?.opportunity, DATA_TO_VISUAL_MAPPING.score);
  const confidence = meanNormalized([
    normalizeConfidence(signal?.volume),
    normalizeConfidence(signal?.strength),
    normalizeConfidence(signal?.quality),
    normalizeConfidence(signal?.opportunity)
  ]);

  return {
    density: applyVisualGuardrail('density', volume),
    energy: applyVisualGuardrail('energy', strength),
    flowSpeed: applyVisualGuardrail('flowSpeed', opportunity),
    highlightRate: applyVisualGuardrail('highlightRate', quality),
    confidence
  };
}

function buildFiveAVisualState(fiveA) {
  const stages = Object.fromEntries(Object.keys(FIVE_A_STAGES).map((stageId) => {
    const stage = fiveA?.stages?.[stageId];
    const population = normalizeDataPoint(stage?.population, DATA_TO_VISUAL_MAPPING.volume);
    const strength = normalizeDataPoint(stage?.strength, DATA_TO_VISUAL_MAPPING.score);
    const confidence = normalizeDataPoint(stage?.confidence, DATA_TO_VISUAL_MAPPING.confidence);
    return [stageId, {
      scale: applyVisualGuardrail('stageScale', population),
      density: applyVisualGuardrail('density', population),
      energy: applyVisualGuardrail('energy', strength),
      activity: applyVisualGuardrail('activity', meanNormalized([strength, confidence])),
      confidence
    }];
  }));

  const transitions = Object.fromEntries(FIVE_A_TRANSITIONS.map((transitionId) => {
    const transition = fiveA?.transitions?.[transitionId];
    const rate = normalizeDataPoint(transition?.rate, DATA_TO_VISUAL_MAPPING.rate);
    const volume = normalizeDataPoint(transition?.volume, DATA_TO_VISUAL_MAPPING.volume);
    const confidence = normalizeDataPoint(
      transition?.confidence,
      DATA_TO_VISUAL_MAPPING.confidence
    );
    return [transitionId, {
      flowStrength: applyVisualGuardrail('flowStrength', rate),
      flowSpeed: applyVisualGuardrail('flowSpeed', volume),
      confidence
    }];
  }));

  const opportunityVolume = normalizeDataPoint(
    fiveA?.opportunityPool?.volume,
    DATA_TO_VISUAL_MAPPING.volume
  );
  const opportunityStrength = normalizeDataPoint(
    fiveA?.opportunityPool?.strength,
    DATA_TO_VISUAL_MAPPING.score
  );
  const opportunityConfidence = normalizeDataPoint(
    fiveA?.opportunityPool?.confidence,
    DATA_TO_VISUAL_MAPPING.confidence
  );

  return {
    stages,
    transitions,
    opportunityPool: {
      density: applyVisualGuardrail('density', opportunityVolume),
      energy: applyVisualGuardrail('energy', opportunityStrength),
      activity: applyVisualGuardrail(
        'activity',
        meanNormalized([opportunityStrength, opportunityConfidence])
      ),
      confidence: opportunityConfidence,
      isStage: false
    }
  };
}

function buildBrandMindVisualState(brandMind) {
  const coreStrength = normalizeDataPoint(
    brandMind?.core?.strength,
    DATA_TO_VISUAL_MAPPING.score
  );
  const coreConcentration = normalizeDataPoint(
    brandMind?.core?.concentration,
    DATA_TO_VISUAL_MAPPING.score
  );
  const coreConfidence = normalizeDataPoint(
    brandMind?.core?.confidence,
    DATA_TO_VISUAL_MAPPING.confidence
  );
  const associations = (brandMind?.associations ?? []).map((association) => {
    const weight = normalizeDataPoint(
      association.weight,
      DATA_TO_VISUAL_MAPPING.associationWeight
    );
    const confidence = normalizeDataPoint(
      association.confidence,
      DATA_TO_VISUAL_MAPPING.confidence
    );
    return {
      id: association.id,
      label: association.label,
      category: association.category,
      node: {
        scale: applyVisualGuardrail('nodeScale', weight),
        brightness: applyVisualGuardrail('brightness', meanNormalized([weight, confidence])),
        activity: applyVisualGuardrail('activity', confidence),
        relationshipStrength: applyVisualGuardrail('relationshipStrength', weight)
      },
      path: {
        visibility: applyVisualGuardrail('visibility', confidence),
        flowStrength: applyVisualGuardrail('flowStrength', weight)
      },
      confidence
    };
  });

  return {
    core: {
      density: applyVisualGuardrail('density', coreConcentration),
      energy: applyVisualGuardrail('energy', coreStrength),
      concentration: applyVisualGuardrail('concentration', coreConcentration),
      confidence: coreConfidence
    },
    associations
  };
}

function buildHomeVisualState({ geo, fiveA, brandMind, availability }) {
  const geoDensity = meanNormalized([
    inverseGuardrail('density', geo.answerStream.density),
    inverseGuardrail('density', geo.citationStream.density),
    inverseGuardrail('density', geo.keywordStream.density)
  ]);
  const geoEnergy = inverseGuardrail('energy', geo.signalCore.energy);
  const geoFlow = meanNormalized([
    inverseGuardrail('flowSpeed', geo.answerStream.flowSpeed),
    inverseGuardrail('flowSpeed', geo.citationStream.flowSpeed),
    inverseGuardrail('flowSpeed', geo.keywordStream.flowSpeed)
  ]);

  const stageValues = Object.values(fiveA.stages);
  const transitionValues = Object.values(fiveA.transitions);
  const fiveADensity = meanNormalized(
    stageValues.map((stage) => inverseGuardrail('density', stage.density))
  );
  const fiveAEnergy = meanNormalized(
    stageValues.map((stage) => inverseGuardrail('energy', stage.energy))
  );
  const fiveAFlow = meanNormalized(
    transitionValues.map((transition) => (
      inverseGuardrail('flowStrength', transition.flowStrength)
    ))
  );

  const mindDensity = inverseGuardrail('density', brandMind.core.density);
  const mindEnergy = inverseGuardrail('energy', brandMind.core.energy);
  const associationActivity = meanNormalized(
    brandMind.associations.map((association) => (
      inverseGuardrail('activity', association.node.activity)
    ))
  );

  return {
    geoNebula: mapHomeModule({
      available: availability.geo,
      density: geoDensity,
      energy: geoEnergy,
      flow: geoFlow,
      confidence: geo.signalCore.confidence
    }),
    fiveANebula: mapHomeModule({
      available: availability.fiveA,
      density: fiveADensity,
      energy: fiveAEnergy,
      flow: fiveAFlow,
      confidence: meanNormalized(stageValues.map((stage) => stage.confidence))
    }),
    brandMindNebula: mapHomeModule({
      available: availability.brandMind,
      density: mindDensity,
      energy: mindEnergy,
      flow: associationActivity,
      confidence: brandMind.core.confidence
    })
  };
}

function mapHomeModule({ available, density, energy, flow, confidence }) {
  const safeAvailability = available ? 1 : 0;
  const activity = meanNormalized([energy, flow, confidence]);
  return {
    availability: available ? 'AVAILABLE' : 'MISSING',
    visibility: applyVisualGuardrail('visibility', safeAvailability),
    density: applyVisualGuardrail('density', density),
    energy: applyVisualGuardrail('energy', energy),
    flow: applyVisualGuardrail('flow', flow),
    emphasis: applyVisualGuardrail('emphasis', meanNormalized([energy, confidence])),
    activity: applyVisualGuardrail('activity', activity),
    confidence
  };
}

function inverseGuardrail(channel, value) {
  const bounds = ART_DIRECTION_GUARDRAILS[channel];
  if (!bounds || !Number.isFinite(value) || bounds.max === bounds.min) return 0;
  return Math.min(Math.max((value - bounds.min) / (bounds.max - bounds.min), 0), 1);
}

function visualGeoId(signalId) {
  if (signalId === 'signalCore') return signalId;
  return `${signalId}Stream`;
}
