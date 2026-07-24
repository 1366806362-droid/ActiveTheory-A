import * as THREE from 'three';
import {
  createGeoSignalCore,
  createGeoVisualResources,
  createSignalPointsMaterial,
  clamp,
  lerp,
  seededRandom,
  smootherstep
} from './geo/geoSignalCore.js';
import {
  createGeoBusinessClusters,
  GEO_CLUSTER_CONFIGS
} from './geo/geoBusinessClusters.js';
import { createGeoDataStreams } from './geo/geoDataStreams.js';
import { createGeoNebulaField } from './geo/geoNebulaField.js';
import { resolveGeoVersionSelection } from './geo/geoVisualProfiles.js';
import { createGeoGyroscopeCore } from './geo/geoGyroscopeCore.js';
import { createGeoBioDigitalField } from './geo/geoBioDigitalField.js';
import { createGeoCinematicMembraneField } from './geo/geoCinematicMembraneField.js';
import { createGeoCinematicCoreShell } from './geo/geoCinematicCoreShell.js';
import { createGeoCinematicStreams } from './geo/geoCinematicStreams.js';
import {
  createGeoCinematicJourney,
  resolveGeoCinematicJourney
} from './geo/geoCinematicJourney.js';
import { setGeoCinematicGradeProgress } from './geo/geoCinematicGrade.js';

const GEO_DEBUG = Object.freeze({
  showInternalPlanets: readDebugFlag('showInternalPlanets', true),
  showInternalOrbits: readDebugFlag('showInternalOrbits', true),
  showLabels: readDebugFlag('showLabels', true)
});
export function createGeoScene() {
  const versionSelection = resolveGeoVersionSelection();
  const visualProfile = versionSelection.visualProfile;
  const coreMode = versionSelection.coreMode;
  const cinematicV3 = versionSelection.activeVersion === 'v3';
  const journeySelection = resolveGeoCinematicJourney();
  const cinematicJourney = createGeoCinematicJourney(journeySelection);
  if (cinematicJourney.enabled) setGeoCinematicGradeProgress(0);
  const coreDebug = resolveGeoCoreDebug(coreMode);
  const backgroundDebug = resolveGeoBackgroundDebug(visualProfile);
  const v3Debug = resolveGeoV3Debug(cinematicV3);
  const v3StreamDebug = resolveGeoV3StreamDebug(cinematicV3);
  const group = new THREE.Group();
  const systemGroup = new THREE.Group();
  const resources = createGeoVisualResources();
  const background = createGeoBackground(resources, visualProfile);
  const businessClusters = createGeoBusinessClusters(resources, visualProfile);
  const clusterConfigs = businessClusters.configs ?? GEO_CLUSTER_CONFIGS;
  const nebula = createGeoNebulaField(resources, visualProfile, clusterConfigs);
  const streams = cinematicV3
    ? createGeoCinematicStreams(resources, clusterConfigs, visualProfile)
    : createGeoDataStreams(resources, clusterConfigs, visualProfile);
  const core = cinematicV3
    ? createGeoCinematicCoreShell(resources, visualProfile)
    : coreMode === 'gyroscope'
      ? createGeoGyroscopeCore(resources, visualProfile)
      : createGeoSignalCore(resources, visualProfile);
  let revealProgress = 0;

  group.name = 'GeoScene';
  systemGroup.name = cinematicV3
    ? 'GEO V3 Cinematic Organic Signal Space'
    : visualProfile.cinematic
    ? 'GEO Cinematic Signal Universe'
    : 'GEO Signal System';
  systemGroup.position.set(...visualProfile.scene.corePosition);
  systemGroup.add(
    nebula.group,
    streams.group,
    core.group,
    businessClusters.group
  );
  group.add(background.group, systemGroup);
  const coreInstanceCount = systemGroup.children.filter(
    (child) => child.name === 'GEO SIGNAL CORE'
      || child.name === 'GEO Broken Gyroscope Core'
      || child.name === 'GEO V3 Cinematic Core'
  ).length;

  core.setDebugVisibility(
    coreDebug.enabled ? true : GEO_DEBUG.showInternalPlanets,
    coreDebug.enabled ? coreDebug.layer === 'full' : GEO_DEBUG.showLabels
  );
  core.setDebugLayer(coreDebug.layer);
  businessClusters.setDebugVisibility(
    coreDebug.enabled ? false : GEO_DEBUG.showInternalPlanets,
    coreDebug.enabled ? false : GEO_DEBUG.showLabels
  );
  streams.setDebugVisibility(coreDebug.enabled ? false : GEO_DEBUG.showInternalOrbits);
  if (coreDebug.enabled) {
    nebula.group.visible = false;
    background.group.visible = false;
  }
  background.setDebugLayer(backgroundDebug.layer);
  if (backgroundDebug.enabled) {
    core.setDebugVisibility(false, false);
    businessClusters.setDebugVisibility(false, false);
    streams.setDebugVisibility(false);
    const showNebulaOnly = backgroundDebug.layer === 'glow'
      || backgroundDebug.layer === 'clean';
    nebula.group.visible = showNebulaOnly;
    systemGroup.visible = showNebulaOnly;
  }
  applyGeoV3Debug({
    debug: v3Debug,
    background,
    nebula,
    streams,
    core,
    businessClusters
  });
  applyGeoV3StreamDebug({
    debug: v3StreamDebug,
    background,
    nebula,
    streams,
    core,
    businessClusters
  });

  const particleCount = background.particleCount
    + nebula.particleCount
    + streams.particleCount
    + core.particleCount
    + businessClusters.particleCount;
  const resourceCounts = countSceneResources(group);
  const diagnostics = createGeoDiagnostics({
    particleCount,
    resourceCounts,
    visualProfile: visualProfile.id,
    versionSelection,
    coreInstanceCount,
    background
  });
  const coreDebugDiagnostics = createGeoCoreDebugDiagnostics(coreDebug, coreMode);
  const backgroundDebugDiagnostics = createGeoBackgroundDebugDiagnostics(
    backgroundDebug,
    versionSelection
  );
  const v3DebugDiagnostics = createGeoV3DebugDiagnostics(v3Debug);
  const v3StreamDebugDiagnostics = createGeoV3StreamDebugDiagnostics(v3StreamDebug);

  function update(renderState, delta, time, galaxyOpenProgress = 1, journeyProgress = 1) {
    revealProgress = clamp(galaxyOpenProgress, 0, 1);
    const journey = clamp(journeyProgress, 0, 1);
    const visualProgress = cinematicJourney.enabled
      && journeySelection.debugProgress !== null
      ? journeySelection.debugProgress
      : revealProgress;
    const journeyState = cinematicJourney.enabled
      ? cinematicJourney.update(
        visualProgress,
        visualProgress > 0.001 ? 'GeoScene' : 'HeroScene'
      )
      : null;
    const lockedJourneyState = journeyState?.finalBaseline ? null : journeyState;
    const visualTime = cinematicV3 && journeySelection.debugTime !== null
      ? journeySelection.debugTime
      : time;
    setGeoCinematicGradeProgress(
      journeyState?.finalBaseline ? 1 : journeyState?.gradeProgress ?? 1
    );
    const backgroundReveal = smootherstep(
      0.18,
      0.78,
      journeyState ? visualProgress : journey
    );
    const compactViewport = window.innerWidth < 700;
    const mediumViewport = window.innerWidth < 1500;
    const sceneScale = compactViewport
      ? visualProfile.scene.compactScale
      : mediumViewport
        ? visualProfile.scene.mediumScale
        : visualProfile.scene.desktopScale;
    const finalPosition = compactViewport
      ? visualProfile.scene.compactPosition
      : mediumViewport
        ? visualProfile.scene.mediumPosition
        : visualProfile.scene.desktopPosition;
    const placementProgress = smootherstep(0.2, 0.82, visualProgress);

    group.visible = journey > 0.001 || visualProgress > 0.001;
    group.position.set(
      lerp(
        0.08,
        finalPosition[0],
        smootherstep(0.25, 0.76, visualProgress)
      ),
      lerp(-0.08, finalPosition[1], smootherstep(0.25, 0.76, visualProgress)),
      lerp(-2.1, finalPosition[2], placementProgress)
    );
    group.scale.setScalar(lerp(0.66, 1, placementProgress) * sceneScale);
    group.rotation.y = Math.sin(visualTime * 0.021) * 0.009 * smootherstep(0.88, 1, visualProgress);

    background.update(visualTime, backgroundReveal, visualProgress, lockedJourneyState);
    nebula.update(visualTime, visualProgress);
    const clusterProgress = businessClusters.update(
      visualTime,
      lockedJourneyState?.clusterTimeline ?? visualProgress
    );
    const activeStreamCount = streams.update(
      visualTime,
      visualProgress,
      lockedJourneyState?.streams
    );
    const coreIntensity = core.update(
      visualTime,
      visualProgress,
      lockedJourneyState?.core
    );
    renderState.exposure += coreIntensity * 0.022;

    diagnostics.update({
      progress: visualProgress,
      journeyProgress: journey,
      delta,
      coreIntensity,
      clusterProgress,
      activeStreamCount,
      activeScene: group.visible ? 'GeoScene' : 'HeroScene'
    });
  }

  function dispose() {
    diagnostics.dispose();
    coreDebugDiagnostics.dispose();
    backgroundDebugDiagnostics.dispose();
    v3DebugDiagnostics.dispose();
    v3StreamDebugDiagnostics.dispose();
    cinematicJourney.dispose();
    setGeoCinematicGradeProgress(1);
    background.dispose();
    core.dispose();
    businessClusters.dispose();
    streams.dispose();
    nebula.dispose();
    resources.dispose();
    group.clear();
  }

  return {
    name: 'GeoScene',
    group,
    update,
    dispose
  };
}

function resolveGeoV3StreamDebug(enabled, search = window.location.search) {
  if (!import.meta.env.DEV || !enabled) {
    return Object.freeze({ enabled: false, stream: 'full' });
  }
  const requested = new URLSearchParams(search).get('geoV3Stream');
  const supported = new Set(['answer', 'citation', 'keyword', 'fields', 'full']);

  return Object.freeze({
    enabled: supported.has(requested),
    stream: supported.has(requested) ? requested : 'full'
  });
}

function applyGeoV3StreamDebug({
  debug,
  background,
  nebula,
  streams,
  core,
  businessClusters
}) {
  streams.setDebugStream?.(debug.stream);
  if (!debug.enabled) return;

  background.group.visible = false;
  nebula.group.visible = false;
  core.setDebugVisibility(false, false);
  businessClusters.setDebugVisibility(false, false);
  streams.setDebugVisibility(true);
}

function createGeoV3StreamDebugDiagnostics(debug) {
  if (!import.meta.env.DEV) return { dispose() {} };
  const status = Object.freeze({
    enabled: debug.enabled,
    stream: debug.stream,
    streams: Object.freeze(['answer', 'citation', 'keyword', 'fields', 'full'])
  });

  window.__GEO_V3_STREAM_DEBUG__ = status;
  return {
    dispose() {
      if (window.__GEO_V3_STREAM_DEBUG__ === status) {
        delete window.__GEO_V3_STREAM_DEBUG__;
      }
    }
  };
}

function resolveGeoV3Debug(enabled, search = window.location.search) {
  if (!import.meta.env.DEV || !enabled) {
    return Object.freeze({ enabled: false, layer: 'full' });
  }
  const requested = new URLSearchParams(search).get('geoV3Layer');
  const aliases = Object.freeze({ 'core-shell': 'full' });
  const layer = aliases[requested] ?? requested;
  const supported = new Set([
    'membranes',
    'streams',
    'background',
    'seed',
    'shell',
    'bands',
    'full',
    'hidden-label'
  ]);

  return Object.freeze({
    enabled: supported.has(layer),
    layer: supported.has(layer) ? layer : 'full'
  });
}

function applyGeoV3Debug({ debug, background, nebula, streams, core, businessClusters }) {
  if (!debug.enabled) return;
  const showBackground = debug.layer === 'background' || debug.layer === 'membranes';
  const showCore = debug.layer === 'seed'
    || debug.layer === 'shell'
    || debug.layer === 'bands'
    || debug.layer === 'full'
    || debug.layer === 'hidden-label';

  background.setDebugLayer(debug.layer);
  nebula.group.visible = debug.layer === 'background';
  core.setDebugVisibility(showCore, debug.layer === 'full');
  if (showCore) core.setDebugLayer(debug.layer);
  businessClusters.setDebugVisibility(false, false);
  streams.setDebugVisibility(debug.layer === 'streams');
  background.group.visible = showBackground;
}

function createGeoV3DebugDiagnostics(debug) {
  if (!import.meta.env.DEV) return { dispose() {} };
  const status = Object.freeze({
    enabled: debug.enabled,
    layer: debug.layer,
    layers: Object.freeze([
      'membranes',
      'streams',
      'background',
      'seed',
      'shell',
      'bands',
      'full',
      'hidden-label'
    ])
  });

  window.__GEO_V3_DEBUG__ = status;
  return {
    dispose() {
      if (window.__GEO_V3_DEBUG__ === status) delete window.__GEO_V3_DEBUG__;
    }
  };
}

function resolveGeoBackgroundDebug(visualProfile, search = window.location.search) {
  if (!import.meta.env.DEV || visualProfile.backgroundMode !== 'biodigital-elevated') {
    return Object.freeze({ enabled: false, layer: 'full' });
  }
  const params = new URLSearchParams(search);
  const requested = params.get('geoBackgroundLayer');
  const aliases = Object.freeze({
    'semantic-membrane': 'membrane',
    'answer-filaments': 'answer',
    'citation-network': 'citation',
    'background-glow': 'glow',
    'foreground-only': 'foreground',
    'clean-background': 'clean'
  });
  const layer = aliases[requested] ?? requested;
  const supported = new Set(['membrane', 'answer', 'citation', 'glow', 'foreground', 'clean']);
  return Object.freeze({
    enabled: supported.has(layer),
    layer: supported.has(layer) ? layer : 'full'
  });
}

function createGeoBackgroundDebugDiagnostics(debug, versionSelection) {
  if (!import.meta.env.DEV) return { dispose() {} };
  const status = Object.freeze({
    enabled: debug.enabled,
    layer: debug.layer,
    activeBackground: versionSelection.activeBackground,
    backgroundIsDefault: versionSelection.backgroundIsDefault,
    layers: Object.freeze(['membrane', 'answer', 'citation', 'glow', 'foreground', 'clean'])
  });
  window.__GEO_BACKGROUND_DEBUG__ = status;
  return {
    dispose() {
      if (window.__GEO_BACKGROUND_DEBUG__ === status) delete window.__GEO_BACKGROUND_DEBUG__;
    }
  };
}

function resolveGeoCoreDebug(coreMode, search = window.location.search) {
  if (!import.meta.env.DEV) return Object.freeze({ enabled: false, layer: 'full' });
  const params = new URLSearchParams(search);
  const gyroscopeLayer = coreMode === 'gyroscope' && params.has('geoCoreLayer');
  const enabled = params.get('geoCoreDebug') === '1' || gyroscopeLayer;
  const requested = params.get('geoCoreLayer') ?? 'full';
  const aliases = Object.freeze({
    'data-seed': 'seed',
    'processing-disk': 'disk',
    'processing-sectors': 'sectors',
    'output-fragments': 'fragments',
    'hidden-label': 'hidden-label'
  });
  const layer = aliases[requested] ?? requested;
  const supported = coreMode === 'gyroscope'
    ? new Set(['seed', 'answer', 'citation', 'keyword', 'fragments', 'full', 'hidden-label'])
    : new Set(['seed', 'disk', 'sectors', 'fragments', 'full', 'hidden-label']);
  return Object.freeze({
    enabled,
    layer: enabled && supported.has(layer) ? layer : 'full'
  });
}

function createGeoCoreDebugDiagnostics(debug, coreMode) {
  if (!import.meta.env.DEV) return { dispose() {} };
  const status = Object.freeze({
    enabled: debug.enabled,
    layer: debug.layer,
    layers: Object.freeze(
      coreMode === 'gyroscope'
        ? ['seed', 'answer', 'citation', 'keyword', 'fragments', 'full', 'hidden-label']
        : ['seed', 'disk', 'sectors', 'fragments', 'full', 'hidden-label']
    ),
    coreMode
  });
  window.__GEO_CORE_DEBUG__ = status;
  return {
    dispose() {
      if (window.__GEO_CORE_DEBUG__ === status) delete window.__GEO_CORE_DEBUG__;
    }
  };
}

function createGeoBackground(resources, visualProfile) {
  const group = new THREE.Group();
  const elevated = visualProfile.backgroundMode === 'biodigital-elevated';
  const cinematicV3 = visualProfile.backgroundMode === 'cinematic-organic-v3';
  const deepSpace = createDeepSpace();
  const farStars = createBackgroundPoints(
    visualProfile.scene.backgroundStars,
    resources.pointTexture,
    false,
    7103,
    visualProfile
  );
  const depthParticles = elevated || cinematicV3
    ? null
    : createBackgroundPoints(
      visualProfile.scene.foregroundParticles,
      resources.pointTexture,
      true,
      8209,
      visualProfile
    );
  const bioDigital = elevated ? createGeoBioDigitalField(resources) : null;
  const cinematicField = cinematicV3 ? createGeoCinematicMembraneField(resources) : null;

  group.name = cinematicV3
    ? 'GEO V3 Cinematic Organic Background'
    : elevated
      ? 'GEO BioDigital Elevated Background'
      : 'GEO Deep Space';
  deepSpace.mesh.renderOrder = -20;
  farStars.points.renderOrder = -12;
  if (depthParticles) depthParticles.points.renderOrder = 12;
  group.add(deepSpace.mesh, farStars.points);
  if (bioDigital) group.add(bioDigital.group);
  if (cinematicField) group.add(cinematicField.group);
  if (depthParticles) group.add(depthParticles.points);

  return {
    group,
    particleCount: visualProfile.scene.backgroundStars
      + (bioDigital?.particleCount
        ?? cinematicField?.particleCount
        ?? visualProfile.scene.foregroundParticles),
    backgroundMode: cinematicV3
      ? 'cinematic-organic-v3'
      : elevated
        ? 'biodigital-organic-v27'
        : 'formal',
    backgroundInstanceCount: 1,
    bioDigitalInstanceCount: elevated ? 1 : 0,
    cinematicBackgroundInstanceCount: cinematicV3 ? 1 : 0,
    formalBackgroundInstanceCount: elevated || cinematicV3 ? 0 : 1,
    farParticleCount: visualProfile.scene.backgroundStars,
    foregroundParticleCount: bioDigital?.foregroundParticleCount
      ?? visualProfile.scene.foregroundParticles,
    bioDigitalParticleCount: bioDigital?.particleCount ?? 0,
    bioDigitalSegmentCount: bioDigital?.segmentCount ?? 0,
    cinematicParticleCount: cinematicField?.particleCount ?? 0,
    cinematicSegmentCount: cinematicField?.segmentCount ?? 0,
    setDebugLayer(layer = 'full') {
      const baseVisible = layer === 'full' || layer === 'clean';
      deepSpace.mesh.visible = baseVisible;
      farStars.points.visible = baseVisible;
      if (depthParticles) depthParticles.points.visible = baseVisible || layer === 'foreground';
      bioDigital?.setDebugLayer(layer);
      cinematicField?.setDebugLayer(layer);
    },
    update(time, reveal, localProgress, journeyState = null) {
      const foregroundReveal = smootherstep(0.58, 0.94, localProgress);

      deepSpace.update(time, reveal, visualProfile.cinematic);
      deepSpace.material.uniforms.uOpacity.value = reveal * (
        visualProfile.scene.deepSpaceOpacity
        ?? (visualProfile.cinematic ? 0.86 : 0.76)
      );
      farStars.material.uniforms.uOpacity.value = reveal * (
        visualProfile.scene.backgroundStarOpacity
        ?? (visualProfile.cinematic ? 0.31 : 0.26)
      );
      farStars.points.rotation.y = time * 0.0025;
      if (depthParticles) {
        depthParticles.material.uniforms.uOpacity.value = foregroundReveal * (
          visualProfile.scene.foregroundOpacity
          ?? (visualProfile.cinematic ? 0.16 : 0.12)
        );
        depthParticles.points.position.z = lerp(-0.48, 0.24, foregroundReveal);
        depthParticles.points.rotation.z = time * 0.004;
      }
      bioDigital?.update(time, localProgress);
      cinematicField?.update(time, localProgress, journeyState?.membrane);
    },
    dispose() {
      deepSpace.dispose();
      farStars.dispose();
      depthParticles?.dispose();
      bioDigital?.dispose();
      cinematicField?.dispose();
      group.clear();
    }
  };
}

function createDeepSpace() {
  const geometry = new THREE.SphereGeometry(18, 28, 18);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uDeep: { value: new THREE.Color('#021124') },
      uBlue: { value: new THREE.Color('#063f66') },
      uCyan: { value: new THREE.Color('#075f71') }
    },
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uDeep;
      uniform vec3 uBlue;
      uniform vec3 uCyan;
      varying vec3 vDirection;

      float hash(vec3 p) {
        p = fract(p * 0.3183099 + 0.1);
        p *= 17.0;
        return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
      }
      float noise(vec3 p) {
        vec3 i = floor(p);
        vec3 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }
      void main() {
        vec3 direction = normalize(vDirection);
        float largeCloud = noise(direction * 2.45 + vec3(uTime * 0.002, 0.0, -uTime * 0.0015));
        float detail = noise(direction * 6.1 - vec3(0.0, uTime * 0.0025, 0.0));
        float nebula = smoothstep(0.48, 0.82, largeCloud * 0.76 + detail * 0.24);
        vec3 color = mix(uDeep, uBlue, nebula * 0.62);
        color = mix(color, uCyan, nebula * nebula * 0.18);
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'GEO Deep Space Background';
  return {
    mesh,
    material,
    update(time, reveal, cinematic = false) {
      material.uniforms.uTime.value = time;
      material.uniforms.uOpacity.value = reveal * (cinematic ? 0.86 : 0.76);
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createBackgroundPoints(count, texture, near, seed, visualProfile = null) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = seededRandom(seed);
  const farColor = new THREE.Color(near ? '#78e3ef' : '#5aaed7');
  const iceColor = new THREE.Color('#d7f7ff');
  const color = new THREE.Color();
  const foregroundPaths = visualProfile?.cinematic
    ? [
      [[-1.08, 0.45, 0.28], [0, 0.015, 0]],
      [[1.06, 0.53, -0.46], [0, 0.015, 0]],
      [[1.02, -0.61, -0.05], [0, 0.015, 0]]
    ]
    : [
      [[1.34, -0.22, 0.34], [0.14, 0.04, 0]],
      [[-0.94, 0.28, -0.48], [0.14, 0.04, 0]],
      [[0.76, 0.72, -0.12], [0.14, 0.04, 0]]
    ];

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    if (near && index % 4 !== 0) {
      const path = foregroundPaths[index % foregroundPaths.length];
      const t = 0.12 + random() * 0.8;
      const spread = 0.08 + random() * 0.18;

      positions[stride] = lerp(path[0][0], path[1][0], t) + (random() - 0.5) * spread;
      positions[stride + 1] = lerp(path[0][1], path[1][1], t) + (random() - 0.5) * spread * 0.72;
      positions[stride + 2] = lerp(path[0][2], path[1][2], t) + 0.24 + random() * 0.5;
    } else if (near) {
      const edge = index % 2 === 0 ? -1 : 1;
      positions[stride] = edge * (2.15 + random() * 1.85);
      positions[stride + 1] = (random() - 0.5) * 4.2;
      positions[stride + 2] = 0.08 + random() * 0.82;
    } else {
      positions[stride] = (random() - 0.5) * 13;
      positions[stride + 1] = (random() - 0.5) * 7.4;
      positions[stride + 2] = -2.8 - random() * 7.2;
    }
    color.copy(farColor).lerp(iceColor, random() * (near ? 0.28 : 0.14));
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    const sizeScale = near
      ? visualProfile?.scene?.foregroundSizeScale ?? 1
      : visualProfile?.scene?.backgroundStarSizeScale ?? 1;
    sizes[index] = (near ? 0.92 + random() * 1.18 : 0.58 + random() * 1.15) * sizeScale;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = near ? 'GEO Foreground Micro Signals' : 'GEO Distant Signal Stars';
  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function countSceneResources(root) {
  const objects = new Set();
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  root.traverse((object) => {
    objects.add(object);
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material)
      ? object.material
      : object.material
        ? [object.material]
        : [];
    objectMaterials.forEach((material) => {
      materials.add(material);
      if (material.map?.isTexture) textures.add(material.map);
      if (material.uniforms) {
        Object.values(material.uniforms).forEach((uniform) => {
          if (uniform?.value?.isTexture) textures.add(uniform.value);
        });
      }
    });
  });

  return {
    objectCount: objects.size,
    geometryCount: geometries.size,
    materialCount: materials.size,
    textureCount: textures.size
  };
}

function createGeoDiagnostics({
  particleCount,
  resourceCounts,
  visualProfile,
  versionSelection,
  coreInstanceCount,
  background
}) {
  if (!import.meta.env.DEV) {
    return { update() {}, dispose() {} };
  }

  const status = {
    localProgress: 0,
    journeyProgress: 0,
    currentStage: 'signal-awakening',
    coreIntensity: 0,
    answerProgress: 0,
    citationProgress: 0,
    keywordProgress: 0,
    activeStreamCount: 0,
    particleCount,
    objectCount: resourceCounts.objectCount,
    geometryCount: resourceCounts.geometryCount,
    materialCount: resourceCounts.materialCount,
    textureCount: resourceCounts.textureCount,
    direction: 'idle',
    activeScene: 'HeroScene',
    transitionFps: null,
    minTransitionFps: null,
    visualProfile,
    coreMode: versionSelection.coreMode,
    requestedVersion: versionSelection.requestedVersion,
    activeVersion: versionSelection.activeVersion,
    isDefaultVersion: versionSelection.isDefaultVersion,
    fallbackUsed: versionSelection.fallbackUsed,
    legacyQueryUsed: versionSelection.legacyQueryUsed,
    coreType: versionSelection.coreType,
    coreInstanceCount,
    requestedBackground: versionSelection.requestedBackground,
    activeBackground: versionSelection.activeBackground,
    backgroundIsDefault: versionSelection.backgroundIsDefault,
    backgroundFallbackUsed: versionSelection.backgroundFallbackUsed,
    backgroundInstanceCount: background.backgroundInstanceCount,
    bioDigitalInstanceCount: background.bioDigitalInstanceCount,
    formalBackgroundInstanceCount: background.formalBackgroundInstanceCount,
    backgroundParticleCount: background.particleCount,
    farBackgroundParticleCount: background.farParticleCount,
    foregroundParticleCount: background.foregroundParticleCount,
    bioDigitalParticleCount: background.bioDigitalParticleCount,
    bioDigitalSegmentCount: background.bioDigitalSegmentCount,
    cinematicBackgroundInstanceCount: background.cinematicBackgroundInstanceCount,
    cinematicParticleCount: background.cinematicParticleCount,
    cinematicSegmentCount: background.cinematicSegmentCount,
    fps: null,
    averageFps: null,
    completedStateSeconds: 0
  };
  let previousProgress = 0;
  let publishFrame = 0;
  let completedFrames = 0;
  let completedElapsed = 0;
  let fpsWindowFrames = 0;
  let fpsWindowElapsed = 0;
  let transitionFrames = 0;
  let transitionElapsed = 0;

  window.__GEO_SCENE_STATUS__ = status;
  publish();
  return {
    update({ progress, journeyProgress, delta: frameDelta, coreIntensity, clusterProgress, activeStreamCount, activeScene }) {
      const progressDelta = progress - previousProgress;
      status.localProgress = progress;
      status.journeyProgress = journeyProgress;
      status.currentStage = getGeoStage(progress);
      status.coreIntensity = coreIntensity;
      status.answerProgress = clusterProgress.answer ?? 0;
      status.citationProgress = clusterProgress.citation ?? 0;
      status.keywordProgress = clusterProgress.keyword ?? 0;
      status.activeStreamCount = activeStreamCount;
      status.direction = progressDelta > 0.0001 ? 'entering' : progressDelta < -0.0001 ? 'returning' : 'idle';
      status.activeScene = activeScene;
      if (
        activeScene === 'GeoScene'
        && progress > 0.001
        && progress < 0.98
        && frameDelta > 0
        && frameDelta < 0.25
      ) {
        transitionFrames += 1;
        transitionElapsed += frameDelta;
        if (transitionElapsed >= 0.3) {
          status.transitionFps = transitionFrames / transitionElapsed;
          status.minTransitionFps = status.minTransitionFps === null
            ? status.transitionFps
            : Math.min(status.minTransitionFps, status.transitionFps);
          transitionFrames = 0;
          transitionElapsed = 0;
        }
      }
      if (activeScene === 'GeoScene' && progress > 0.98 && frameDelta > 0 && frameDelta < 0.25) {
        completedFrames += 1;
        completedElapsed += frameDelta;
        fpsWindowFrames += 1;
        fpsWindowElapsed += frameDelta;
        status.averageFps = completedFrames / completedElapsed;
        status.completedStateSeconds = completedElapsed;
        if (fpsWindowElapsed >= 0.5) {
          status.fps = fpsWindowFrames / fpsWindowElapsed;
          fpsWindowFrames = 0;
          fpsWindowElapsed = 0;
        }
      }
      previousProgress = progress;
      publishFrame += 1;
      if (publishFrame % 3 === 0) publish();
    },
    dispose() {
      if (window.__GEO_SCENE_STATUS__ === status) delete window.__GEO_SCENE_STATUS__;
      delete document.documentElement.dataset.geoSceneStatus;
    }
  };

  function publish() {
    window.__GEO_SCENE_STATUS__ = status;
    document.documentElement.dataset.geoSceneStatus = JSON.stringify(status);
  }
}

function getGeoStage(progress) {
  if (progress < 0.16) return 'signal-awakening';
  if (progress < 0.48) return 'cluster-aggregation';
  if (progress < 0.72) return 'data-stream-establishment';
  if (progress < 0.9) return 'core-stabilizing';
  return 'operational';
}

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);
  if (!params.has(name)) return fallback;
  return params.get(name) !== '0' && params.get(name) !== 'false';
}

export const geoSceneManager = {
  createGeoScene
};
