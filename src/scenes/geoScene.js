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
import { resolveGeoVisualProfile } from './geo/geoVisualProfiles.js';
import { createGeoGyroscopeCore } from './geo/geoGyroscopeCore.js';

const GEO_DEBUG = Object.freeze({
  showInternalPlanets: readDebugFlag('showInternalPlanets', true),
  showInternalOrbits: readDebugFlag('showInternalOrbits', true),
  showLabels: readDebugFlag('showLabels', true)
});
const GEO_CORE_MODE = resolveGeoCoreMode();
const GEO_CORE_DEBUG = resolveGeoCoreDebug(GEO_CORE_MODE);

export function createGeoScene() {
  const visualProfile = resolveGeoVisualProfile();
  const group = new THREE.Group();
  const systemGroup = new THREE.Group();
  const resources = createGeoVisualResources();
  const background = createGeoBackground(resources, visualProfile);
  const businessClusters = createGeoBusinessClusters(resources, visualProfile);
  const clusterConfigs = businessClusters.configs ?? GEO_CLUSTER_CONFIGS;
  const nebula = createGeoNebulaField(resources, visualProfile, clusterConfigs);
  const streams = createGeoDataStreams(resources, clusterConfigs, visualProfile);
  const core = GEO_CORE_MODE === 'gyroscope'
    ? createGeoGyroscopeCore(resources, visualProfile)
    : createGeoSignalCore(resources, visualProfile);
  let revealProgress = 0;

  group.name = 'GeoScene';
  systemGroup.name = visualProfile.cinematic
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

  core.setDebugVisibility(
    GEO_CORE_DEBUG.enabled ? true : GEO_DEBUG.showInternalPlanets,
    GEO_CORE_DEBUG.enabled ? GEO_CORE_DEBUG.layer === 'full' : GEO_DEBUG.showLabels
  );
  core.setDebugLayer(GEO_CORE_DEBUG.layer);
  businessClusters.setDebugVisibility(
    GEO_CORE_DEBUG.enabled ? false : GEO_DEBUG.showInternalPlanets,
    GEO_CORE_DEBUG.enabled ? false : GEO_DEBUG.showLabels
  );
  streams.setDebugVisibility(GEO_CORE_DEBUG.enabled ? false : GEO_DEBUG.showInternalOrbits);
  if (GEO_CORE_DEBUG.enabled) {
    nebula.group.visible = false;
    background.group.visible = false;
  }

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
    coreMode: GEO_CORE_MODE
  });
  const coreDebugDiagnostics = createGeoCoreDebugDiagnostics(GEO_CORE_DEBUG);

  function update(renderState, delta, time, galaxyOpenProgress = 1, journeyProgress = 1) {
    revealProgress = clamp(galaxyOpenProgress, 0, 1);
    const journey = clamp(journeyProgress, 0, 1);
    const backgroundReveal = smootherstep(0.18, 0.78, journey);
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
    const placementProgress = smootherstep(0.2, 0.82, revealProgress);

    group.visible = journey > 0.001 || revealProgress > 0.001;
    group.position.set(
      lerp(
        0.08,
        finalPosition[0],
        smootherstep(0.25, 0.76, revealProgress)
      ),
      lerp(-0.08, finalPosition[1], smootherstep(0.25, 0.76, revealProgress)),
      lerp(-2.1, finalPosition[2], placementProgress)
    );
    group.scale.setScalar(lerp(0.66, 1, placementProgress) * sceneScale);
    group.rotation.y = Math.sin(time * 0.021) * 0.009 * smootherstep(0.88, 1, revealProgress);

    background.update(time, backgroundReveal, revealProgress);
    nebula.update(time, revealProgress);
    const clusterProgress = businessClusters.update(time, revealProgress);
    const activeStreamCount = streams.update(time, revealProgress);
    const coreIntensity = core.update(time, revealProgress);
    renderState.exposure += coreIntensity * 0.022;

    diagnostics.update({
      progress: revealProgress,
      journeyProgress: journey,
      coreIntensity,
      clusterProgress,
      activeStreamCount,
      activeScene: group.visible ? 'GeoScene' : 'HeroScene'
    });
  }

  function dispose() {
    diagnostics.dispose();
    coreDebugDiagnostics.dispose();
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

function resolveGeoCoreMode(search = window.location.search) {
  const params = new URLSearchParams(search);
  return params.get('geoCore') === 'gyroscope' ? 'gyroscope' : 'v2.3';
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

function createGeoCoreDebugDiagnostics(debug) {
  if (!import.meta.env.DEV) return { dispose() {} };
  const status = Object.freeze({
    enabled: debug.enabled,
    layer: debug.layer,
    layers: Object.freeze(
      GEO_CORE_MODE === 'gyroscope'
        ? ['seed', 'answer', 'citation', 'keyword', 'fragments', 'full', 'hidden-label']
        : ['seed', 'disk', 'sectors', 'fragments', 'full', 'hidden-label']
    ),
    coreMode: GEO_CORE_MODE
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
  const deepSpace = createDeepSpace();
  const farStars = createBackgroundPoints(
    visualProfile.scene.backgroundStars,
    resources.pointTexture,
    false,
    7103,
    visualProfile
  );
  const depthParticles = createBackgroundPoints(
    visualProfile.scene.foregroundParticles,
    resources.pointTexture,
    true,
    8209,
    visualProfile
  );

  group.name = 'GEO Deep Space';
  deepSpace.mesh.renderOrder = -20;
  farStars.points.renderOrder = -12;
  depthParticles.points.renderOrder = 12;
  group.add(deepSpace.mesh, farStars.points, depthParticles.points);

  return {
    group,
    particleCount: visualProfile.scene.backgroundStars + visualProfile.scene.foregroundParticles,
    update(time, reveal, localProgress) {
      const foregroundReveal = smootherstep(0.58, 0.94, localProgress);

      deepSpace.update(time, reveal, visualProfile.cinematic);
      farStars.material.uniforms.uOpacity.value = reveal * (visualProfile.cinematic ? 0.31 : 0.26);
      farStars.points.rotation.y = time * 0.0025;
      depthParticles.material.uniforms.uOpacity.value = foregroundReveal * (visualProfile.cinematic ? 0.16 : 0.12);
      depthParticles.points.position.z = lerp(-0.48, 0.24, foregroundReveal);
      depthParticles.points.rotation.z = time * 0.004;
    },
    dispose() {
      deepSpace.dispose();
      farStars.dispose();
      depthParticles.dispose();
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
    sizes[index] = near ? 0.92 + random() * 1.18 : 0.58 + random() * 1.15;
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

function createGeoDiagnostics({ particleCount, resourceCounts, visualProfile, coreMode }) {
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
    visualProfile,
    coreMode
  };
  let previousProgress = 0;
  let publishFrame = 0;

  window.__GEO_SCENE_STATUS__ = status;
  publish();
  return {
    update({ progress, journeyProgress, coreIntensity, clusterProgress, activeStreamCount, activeScene }) {
      const delta = progress - previousProgress;
      status.localProgress = progress;
      status.journeyProgress = journeyProgress;
      status.currentStage = getGeoStage(progress);
      status.coreIntensity = coreIntensity;
      status.answerProgress = clusterProgress.answer ?? 0;
      status.citationProgress = clusterProgress.citation ?? 0;
      status.keywordProgress = clusterProgress.keyword ?? 0;
      status.activeStreamCount = activeStreamCount;
      status.direction = delta > 0.0001 ? 'entering' : delta < -0.0001 ? 'returning' : 'idle';
      status.activeScene = activeScene;
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
