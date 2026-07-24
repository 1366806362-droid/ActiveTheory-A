import { clamp, lerp, smootherstep } from './geoSignalCore.js';

const JOURNEY_STAGES = Object.freeze([
  ['hero-space-handoff', 0, 0.12],
  ['organic-membranes-awakening', 0.03, 0.38],
  ['business-systems-condensing', 0.12, 0.62],
  ['cinematic-streams-building', 0.24, 0.78],
  ['core-chamber-assembly', 0.26, 0.82],
  ['core-entry-responses', 0.62, 0.92],
  ['cinematic-grade-completing', 0.64, 1]
]);

const FIFTH_WHEEL_PROGRESS = 5 / 7;
const SIXTH_WHEEL_PROGRESS = 6 / 7;

function linearstep(edge0, edge1, value) {
  return clamp((value - edge0) / Math.max(edge1 - edge0, 0.00001), 0, 1);
}

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
  let lastWheelCount = 0;
  let lastWheelProgress = 0;
  let lastWheelAt = performance.now();
  const baseline = Object.freeze({
    gradeProgress: 1,
    membraneReveal: Object.freeze([1, 1, 1]),
    membraneDepth: Object.freeze([0, 0, 0]),
    streamReveal: Object.freeze([1, 1, 1]),
    coreAssembly: 1,
    coreResponse: 1
  });
  let status = createJourneyState(0, 'idle', baseline);
  const uxStatus = createUxStatus(status);

  if (import.meta.env.DEV && selection.enabled) {
    publish(status);
    publishUx(uxStatus);
  }

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
      updateUxStatus();
      previousProgress = progress;
      if (import.meta.env.DEV && selection.enabled) {
        publish(status);
        publishUx(uxStatus);
      }
      return status;
    },
    current() {
      return status;
    },
    dispose() {
      if (window.__GEO_V3_JOURNEY_STATUS__ === status) {
        delete window.__GEO_V3_JOURNEY_STATUS__;
      }
      if (window.__GEO_V3_UX_STATUS__ === uxStatus) {
        delete window.__GEO_V3_UX_STATUS__;
      }
      delete document.documentElement.dataset.geoV3JourneyStatus;
      delete document.documentElement.dataset.geoV3UxStatus;
    }
  };

  function updateUxStatus() {
    const now = performance.now();
    const tour = window.__GALAXY_TOUR_STATUS__ ?? {};
    const geo = window.__GEO_SCENE_STATUS__ ?? {};
    const luminance = window.__GEO_V3_LUMINANCE_STATUS__ ?? {};
    const video = window.__H1_GALAXY_STATUS__ ?? {};
    const wheelCount = tour.wheelEventCount ?? 0;

    if (wheelCount !== lastWheelCount) {
      lastWheelCount = wheelCount;
      lastWheelProgress = status.localProgress;
      lastWheelAt = now;
    }

    uxStatus.rawDeltaY = tour.rawDelta ?? 0;
    uxStatus.normalizedWheelUnit = tour.normalizedWheelUnit ?? 0;
    uxStatus.scrollUnits = tour.scrollUnits ?? status.localProgress * 7;
    uxStatus.previousJourneyProgress = previousProgress;
    uxStatus.journeyProgress = status.localProgress;
    uxStatus.progressChangedAfterWheel = Math.abs(status.localProgress - lastWheelProgress);
    uxStatus.idleDuration = Math.max(0, now - lastWheelAt) / 1000;
    uxStatus.routeTarget = tour.routeTarget ?? null;
    uxStatus.routeCurrent = tour.routeCurrent ?? null;
    uxStatus.routeState = tour.routeState ?? null;
    uxStatus.activeScene = status.activeScene;
    uxStatus.membraneProgress = status.membraneProgress;
    uxStatus.answerProgress = status.answerProgress;
    uxStatus.citationProgress = status.citationProgress;
    uxStatus.keywordProgress = status.keywordProgress;
    uxStatus.answerStreamProgress = status.answerStreamProgress;
    uxStatus.citationStreamProgress = status.citationStreamProgress;
    uxStatus.keywordStreamProgress = status.keywordStreamProgress;
    uxStatus.seedProgress = status.seedProgress;
    uxStatus.diskProgress = status.diskProgress;
    uxStatus.bandsProgress = status.bandsProgress;
    uxStatus.chamberProgress = status.chamberProgress;
    uxStatus.responseProgress = status.responseProgress;
    uxStatus.gradeProgress = status.gradeProgress;
    uxStatus.bloomProgress = status.bloomProgress;
    uxStatus.coreTop5Luminance = luminance.coreTop5Luminance ?? null;
    uxStatus.answerTop5Luminance = luminance.answerTop5Luminance ?? null;
    uxStatus.citationTop5Luminance = luminance.citationTop5Luminance ?? null;
    uxStatus.fpsAverage = geo.averageFps ?? null;
    uxStatus.fpsOnePercentLow = geo.fpsOnePercentLow ?? null;
    uxStatus.instanceCounts = status.instanceCounts;
    uxStatus.videoCurrentTime = video.currentTime ?? status.videoCurrentTime;
  }
}

function createJourneyState(progress, direction, baseline = null) {
  const membraneAnswer = smootherstep(0.03, 0.28, progress);
  const membraneCitation = smootherstep(0.1, 0.34, progress);
  const membraneForeground = smootherstep(0.16, 0.38, progress);
  const answerProgress = smootherstep(0.12, 0.46, progress);
  const citationProgress = smootherstep(0.2, 0.54, progress);
  const keywordProgress = smootherstep(0.28, 0.62, progress);
  const answerStreamProgress = linearstep(0.24, 0.66, progress);
  const citationStreamProgress = linearstep(0.3, 0.72, progress);
  const keywordStreamProgress = linearstep(0.36, 0.78, progress);
  const seedProgress = smootherstep(0.26, 0.5, progress);
  const diskProgress = smootherstep(0.34, 0.58, progress);
  const bandsProgress = smootherstep(0.42, 0.7, progress);
  const chamberProgress = smootherstep(0.52, 0.82, progress);
  const responseProgress = smootherstep(0.62, 0.92, progress);
  const gradeProgress = createGradeProgress(progress);
  const bloomProgress = createBloomProgress(progress);
  const priorityProgress = smootherstep(0.68, 1, progress);
  const clusterTimeline = progress;
  const baseStreamTimeline = progress;
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
      label: smootherstep(0.48, 0.76, progress)
    },
    gradeProgress,
    bloomProgress,
    priority: {
      core: lerp(1, 1.1, priorityProgress),
      answer: lerp(1, 0.87, priorityProgress),
      citation: lerp(1, 0.9, priorityProgress),
      answerLabel: lerp(1, 0.94, priorityProgress),
      citationLabel: lerp(1, 0.94, priorityProgress)
    },
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
  return smootherstep(0.26, 0.82, progress);
}

function createGradeProgress(progress) {
  if (progress <= 0.64) return 0;
  if (progress <= FIFTH_WHEEL_PROGRESS) {
    return smootherstep(0.64, FIFTH_WHEEL_PROGRESS, progress) * 0.2;
  }
  if (progress <= SIXTH_WHEEL_PROGRESS) {
    return lerp(
      0.2,
      0.58,
      smootherstep(FIFTH_WHEEL_PROGRESS, SIXTH_WHEEL_PROGRESS, progress)
    );
  }
  return lerp(
    0.58,
    1,
    smootherstep(SIXTH_WHEEL_PROGRESS, 1, progress)
  );
}

function createBloomProgress(progress) {
  if (progress <= 0.64) return 0;
  if (progress <= FIFTH_WHEEL_PROGRESS) {
    return smootherstep(0.64, FIFTH_WHEEL_PROGRESS, progress) * 0.13;
  }
  if (progress <= SIXTH_WHEEL_PROGRESS) {
    return lerp(
      0.13,
      0.72,
      smootherstep(FIFTH_WHEEL_PROGRESS, SIXTH_WHEEL_PROGRESS, progress)
    );
  }
  return lerp(
    0.72,
    1,
    smootherstep(SIXTH_WHEEL_PROGRESS, 1, progress)
  );
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

function createUxStatus(status) {
  return {
    rawDeltaY: 0,
    normalizedWheelUnit: 0,
    scrollUnits: 0,
    journeyProgress: status.localProgress,
    previousJourneyProgress: status.localProgress,
    progressChangedAfterWheel: 0,
    idleDuration: 0,
    routeTarget: 'HERO_START',
    routeCurrent: 'HERO_START',
    routeState: 'HERO_START',
    activeScene: 'HeroScene',
    membraneProgress: 0,
    answerProgress: 0,
    citationProgress: 0,
    keywordProgress: 0,
    answerStreamProgress: 0,
    citationStreamProgress: 0,
    keywordStreamProgress: 0,
    seedProgress: 0,
    diskProgress: 0,
    bandsProgress: 0,
    chamberProgress: 0,
    responseProgress: 0,
    gradeProgress: 0,
    bloomProgress: 0,
    coreTop5Luminance: null,
    answerTop5Luminance: null,
    citationTop5Luminance: null,
    fpsAverage: null,
    fpsOnePercentLow: null,
    instanceCounts: status.instanceCounts,
    videoCurrentTime: 0
  };
}

function publishUx(status) {
  window.__GEO_V3_UX_STATUS__ = status;
  document.documentElement.dataset.geoV3UxStatus = JSON.stringify(status);
}
