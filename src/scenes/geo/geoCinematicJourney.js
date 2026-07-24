import { clamp, lerp, smootherstep } from './geoSignalCore.js';

const JOURNEY_STAGES = Object.freeze([
  ['hero-space-handoff', 0, 0.12],
  ['organic-membranes-awakening', 0.06, 0.3],
  ['business-systems-condensing', 0.16, 0.5],
  ['cinematic-streams-building', 0.32, 0.7],
  ['core-chamber-assembly', 0.48, 0.86],
  ['core-entry-responses', 0.66, 0.94],
  ['cinematic-grade-completing', 0.82, 1]
]);

export function resolveGeoCinematicJourney(search = window.location.search) {
  const params = new URLSearchParams(search);
  const requestedProgress = Number(params.get('geoJourneyProgress'));
  const requestedTime = Number(params.get('geoDebugTime'));
  const debugProgress = import.meta.env.DEV
    && params.has('geoJourneyProgress')
    && Number.isFinite(requestedProgress)
    ? clamp(requestedProgress, 0, 1)
    : null;
  const debugTime = import.meta.env.DEV
    && params.has('geoDebugTime')
    && Number.isFinite(requestedTime)
    ? Math.max(0, requestedTime)
    : null;
  return Object.freeze({
    enabled: params.get('geoVisual') === 'v3-cinematic'
      && params.get('geoGrade') === 'cinematic'
      && params.get('geoJourney') === 'v1',
    id: params.get('geoJourney') === 'v1' ? 'v1' : 'off',
    debugProgress,
    debugTime
  });
}

export function createGeoCinematicJourney(selection) {
  let previousProgress = 0;
  const baseline = Object.freeze({
    gradeProgress: 1,
    membraneReveal: Object.freeze([1, 1, 1]),
    membraneDepth: Object.freeze([0, 0, 0]),
    streamReveal: Object.freeze([1, 1, 1]),
    coreAssembly: 1,
    coreResponse: 1
  });
  let status = createJourneyState(0, 'idle', baseline);

  if (import.meta.env.DEV && selection.enabled) publish(status);

  return {
    enabled: selection.enabled,
    update(localProgress, activeScene = 'HeroScene') {
      const progress = clamp(localProgress, 0, 1);
      const delta = progress - previousProgress;
      const direction = delta > 0.0001
        ? 'entering'
        : delta < -0.0001
          ? 'returning'
          : 'idle';

      status = createJourneyState(progress, direction, baseline);
      status.activeScene = activeScene;
      status.videoCurrentTime = window.__GALAXY_TOUR_STATUS__?.videoCurrentTime ?? 0;
      previousProgress = progress;
      if (import.meta.env.DEV && selection.enabled) publish(status);
      return status;
    },
    current() {
      return status;
    },
    dispose() {
      if (window.__GEO_V3_JOURNEY_STATUS__ === status) {
        delete window.__GEO_V3_JOURNEY_STATUS__;
      }
      delete document.documentElement.dataset.geoV3JourneyStatus;
    }
  };
}

function createJourneyState(progress, direction, baseline = null) {
  const membraneAnswer = smootherstep(0.06, 0.255, progress);
  const membraneCitation = smootherstep(0.105, 0.3, progress);
  const membraneForeground = smootherstep(0.17, 0.34, progress);
  const answerProgress = smootherstep(0.16, 0.43, progress);
  const citationProgress = smootherstep(0.205, 0.47, progress);
  const keywordProgress = smootherstep(0.255, 0.5, progress);
  const answerStreamProgress = smootherstep(0.32, 0.61, progress);
  const citationStreamProgress = smootherstep(0.375, 0.665, progress);
  const keywordStreamProgress = smootherstep(0.425, 0.7, progress);
  const seedProgress = smootherstep(0.48, 0.625, progress);
  const diskProgress = smootherstep(0.525, 0.705, progress);
  const bandsProgress = smootherstep(0.585, 0.79, progress);
  const chamberProgress = smootherstep(0.645, 0.86, progress);
  const responseProgress = smootherstep(0.66, 0.94, progress);
  const gradeProgress = smootherstep(0.82, 1, progress);
  const clusterTimeline = smootherstep(0.145, 0.5, progress);
  const baseStreamTimeline = smootherstep(0.29, 0.71, progress);
  const coreTimeline = createCoreTimeline(progress);

  const finalBaseline = progress >= 0.99999;
  return {
    enabled: true,
    localProgress: progress,
    finalBaseline,
    baselineRestored: finalBaseline,
    baseline,
    currentStage: getCurrentStage(progress),
    membraneProgress: Math.max(
      membraneAnswer,
      membraneCitation,
      membraneForeground
    ),
    membrane: {
      answer: membraneAnswer,
      citation: membraneCitation,
      foreground: membraneForeground,
      depth: [
        lerp(-0.22, 0, membraneAnswer),
        lerp(-0.28, 0, membraneCitation),
        lerp(0.22, 0, membraneForeground)
      ]
    },
    answerProgress,
    citationProgress,
    keywordProgress,
    clusterTimeline,
    answerStreamProgress,
    citationStreamProgress,
    keywordStreamProgress,
    streams: {
      answer: answerStreamProgress,
      citation: citationStreamProgress,
      keyword: keywordStreamProgress,
      baseTimeline: baseStreamTimeline,
      deterministicTime: progress * 24,
      liveMotionMix: smootherstep(0.955, 1, progress)
    },
    seedProgress,
    diskProgress,
    bandsProgress,
    chamberProgress,
    responseProgress,
    coreTimeline,
    core: {
      baseTimeline: coreTimeline,
      seed: seedProgress,
      disk: diskProgress,
      bands: bandsProgress,
      chamber: chamberProgress,
      response: responseProgress,
      label: smootherstep(0.75, 0.94, progress)
    },
    gradeProgress,
    direction,
    activeScene: progress > 0.001 ? 'GeoScene' : 'HeroScene',
    instanceCounts: {
      scene: 1,
      membrane: 1,
      core: 1,
      streams: 1,
      composer: 1,
      bloom: 1
    },
    videoCurrentTime: 0
  };
}

function createCoreTimeline(progress) {
  if (progress <= 0.48) return 0;
  if (progress < 0.59) {
    return lerp(0, 0.2, smootherstep(0.48, 0.59, progress));
  }
  if (progress < 0.73) {
    return lerp(0.2, 0.58, smootherstep(0.59, 0.73, progress));
  }
  if (progress < 0.84) {
    return lerp(0.58, 0.76, smootherstep(0.73, 0.84, progress));
  }
  return lerp(0.76, 1, smootherstep(0.84, 0.96, progress));
}

function getCurrentStage(progress) {
  let current = JOURNEY_STAGES[0][0];
  for (let index = 0; index < JOURNEY_STAGES.length; index += 1) {
    if (progress >= JOURNEY_STAGES[index][1]) current = JOURNEY_STAGES[index][0];
  }
  if (progress >= 0.999) return 'cinematic-operational';
  return current;
}

function publish(status) {
  window.__GEO_V3_JOURNEY_STATUS__ = status;
  document.documentElement.dataset.geoV3JourneyStatus = JSON.stringify(status);
}
