import * as THREE from 'three';
import {
  clamp,
  createBrandCognitionCore,
  createBrandMindResources,
  createMindPointsMaterial,
  createSceneTitleSprite,
  lerp,
  seededRandom,
  smootherstep
} from './brandMind/brandCognitionCore.js';
import {
  BRAND_MIND_CLUSTER_CONFIGS,
  createBrandMindClusters
} from './brandMind/brandMindClusters.js';
import { createBrandRelationStreams } from './brandMind/brandRelationStreams.js';
import { createBrandNebulaField } from './brandMind/brandNebulaField.js';

const FAR_PARTICLE_COUNT = 420;
const FOREGROUND_PARTICLE_COUNT = 260;

export function createBrandMindScene() {
  const group = new THREE.Group();
  const systemGroup = new THREE.Group();
  const resources = createBrandMindResources();
  const background = createBrandBackground(resources);
  const nebula = createBrandNebulaField(resources);
  const relations = createBrandRelationStreams(resources, BRAND_MIND_CLUSTER_CONFIGS);
  const core = createBrandCognitionCore(resources);
  const clusters = createBrandMindClusters(resources);
  const title = createSceneTitleSprite();
  const debugProgress = readDebugProgress();
  let previousProgress = 0;
  let fpsElapsed = 0;
  let fpsFrames = 0;
  let measuredFps = null;
  let minimumFps = null;

  group.name = 'BrandMindScene';
  group.position.set(0, 0, -0.72);
  systemGroup.name = 'Brand Mind Nebula Map';
  systemGroup.add(nebula.group, relations.group, core.group, clusters.group, title.sprite);
  group.add(background.group, systemGroup);

  const particleCount = background.particleCount
    + nebula.particleCount
    + relations.particleCount
    + core.particleCount
    + clusters.particleCount;
  const resourceCounts = countSceneResources(group);
  const diagnostics = createBrandMindDiagnostics({
    particleCount,
    keywordNodeCount: clusters.keywordNodeCount,
    resourceCounts
  });

  function update(renderState, delta, time, transitionProgress = 1) {
    // The route settles at roughly 8% / 92%; remap that protected camera
    // handoff window so the scene itself still reaches exact 0 and 1 states.
    const progress = debugProgress ?? clamp((transitionProgress - 0.09) / 0.83, 0, 1);
    const compactViewport = window.innerWidth < 700;
    const mediumViewport = window.innerWidth < 1500;
    const sceneScale = compactViewport ? 0.72 : mediumViewport ? 0.88 : 1.06;
    const reveal = smootherstep(0.02, 0.94, progress);
    const stable = smootherstep(0.86, 1, progress);
    const direction = progress > previousProgress + 0.0001
      ? 'entering'
      : progress < previousProgress - 0.0001
        ? 'returning'
        : 'idle';

    if (delta > 0) {
      fpsElapsed += delta;
      fpsFrames += 1;
      if (fpsElapsed >= 1) {
        measuredFps = fpsFrames / fpsElapsed;
        minimumFps = Math.min(minimumFps ?? measuredFps, measuredFps);
        fpsElapsed = 0;
        fpsFrames = 0;
      }
    }

    group.visible = progress > 0.001;
    systemGroup.scale.setScalar(sceneScale * lerp(0.66, 1, smootherstep(0.08, 0.84, progress)));
    systemGroup.position.set(
      compactViewport ? -0.1 : mediumViewport ? -0.02 : 0,
      compactViewport ? 0.1 : mediumViewport ? 0.1 : 0.08,
      lerp(-1.12, 0, smootherstep(0.08, 0.78, progress))
    );
    systemGroup.rotation.y = Math.sin(time * 0.014) * 0.006 * stable;

    background.update(time, reveal, progress);
    nebula.update(time, progress);
    const clusterProgress = clusters.update(time, progress);
    const activeRelationCount = relations.update(time, progress);
    const coreIntensity = core.update(time, progress);
    title.material.opacity = smootherstep(0.78, 0.98, progress) * 0.44;
    renderState.exposure += coreIntensity * 0.016;

    diagnostics.update({
      progress,
      coreIntensity,
      clusterProgress,
      activeRelationCount,
      direction,
      fps: measuredFps,
      minimumFps,
      activeScene: group.visible ? 'BrandMindScene' : 'HeroScene'
    });
    previousProgress = progress;
  }

  function dispose() {
    diagnostics.dispose();
    background.dispose();
    nebula.dispose();
    relations.dispose();
    core.dispose();
    clusters.dispose();
    title.dispose();
    resources.dispose();
    group.clear();
  }

  return {
    name: 'BrandMindScene',
    group,
    update,
    dispose,
    isShell: false
  };
}

function createBrandBackground(resources) {
  const group = new THREE.Group();
  const deepSpace = createDeepSpace();
  const far = createDepthParticles(FAR_PARTICLE_COUNT, resources.pointTexture, false, 28657);
  const foreground = createDepthParticles(FOREGROUND_PARTICLE_COUNT, resources.pointTexture, true, 32771);

  group.name = 'Brand Mind Semantic Space';
  group.add(deepSpace.mesh, far.points, foreground.points);
  return {
    group,
    particleCount: FAR_PARTICLE_COUNT + FOREGROUND_PARTICLE_COUNT,
    update(time, reveal, progress) {
      const foregroundReveal = smootherstep(0.62, 0.96, progress);
      deepSpace.material.uniforms.uTime.value = time;
      deepSpace.material.uniforms.uOpacity.value = reveal * 0.92;
      far.material.uniforms.uOpacity.value = reveal * 0.32;
      far.points.rotation.y = time * 0.002;
      foreground.material.uniforms.uOpacity.value = foregroundReveal * 0.11;
      foreground.points.rotation.z = time * 0.0035;
    },
    dispose() {
      deepSpace.dispose();
      far.dispose();
      foreground.dispose();
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
      uDeep: { value: new THREE.Color('#03091c') },
      uBlue: { value: new THREE.Color('#171846') },
      uPurple: { value: new THREE.Color('#462b70') }
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
      uniform vec3 uPurple;
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
        float field = noise(direction * 2.35 + vec3(uTime * 0.0014, 0.0, -uTime * 0.001));
        float detail = noise(direction * 5.7 - vec3(0.0, uTime * 0.0018, 0.0));
        float nebula = smoothstep(0.52, 0.84, field * 0.78 + detail * 0.22);
        vec3 color = mix(uDeep, uBlue, nebula * 0.72);
        color = mix(color, uPurple, nebula * nebula * 0.38);
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'Brand Mind Deep Purple Space';
  mesh.renderOrder = -20;
  return {
    mesh,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createDepthParticles(count, texture, foreground, seed) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = seededRandom(seed);
  const back = new THREE.Color(foreground ? '#8e72d0' : '#534b82');
  const ice = new THREE.Color('#ded8f5');
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    if (foreground) {
      const side = index % 2 === 0 ? -1 : 1;
      positions[stride] = side * (1.9 + random() * 2.1);
      positions[stride + 1] = (random() - 0.5) * 3.8;
      positions[stride + 2] = 0.28 + random() * 0.92;
    } else {
      positions[stride] = (random() - 0.5) * 13;
      positions[stride + 1] = (random() - 0.5) * 7.4;
      positions[stride + 2] = -2.8 - random() * 7.2;
    }
    color.copy(back).lerp(ice, random() * (foreground ? 0.24 : 0.12));
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = foreground ? 0.68 + random() * 0.92 : 0.5 + random() * 1.1;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createMindPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);
  points.name = foreground ? 'Foreground Semantic Dust' : 'Distant Cognitive Stars';
  points.renderOrder = foreground ? 12 : -12;
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
      : object.material ? [object.material] : [];
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

function createBrandMindDiagnostics({ particleCount, keywordNodeCount, resourceCounts }) {
  if (!import.meta.env.DEV) return { update() {}, dispose() {} };
  const status = {
    localProgress: 0,
    currentStage: 'cognition-waking',
    coreIntensity: 0,
    awarenessProgress: 0,
    associationProgress: 0,
    reputationProgress: 0,
    preferenceProgress: 0,
    loyaltyProgress: 0,
    activeRelationCount: 0,
    keywordNodeCount,
    particleCount,
    objectCount: resourceCounts.objectCount,
    geometryCount: resourceCounts.geometryCount,
    materialCount: resourceCounts.materialCount,
    textureCount: resourceCounts.textureCount,
    direction: 'idle',
    activeScene: 'HeroScene',
    isShell: false,
    fps: null,
    minimumFps: null,
    heapBytes: null
  };
  let publishFrame = 0;
  window.__BRAND_MIND_SCENE_STATUS__ = status;
  publish();
  return {
    update({ progress, coreIntensity, clusterProgress, activeRelationCount, direction, fps, minimumFps, activeScene }) {
      status.localProgress = progress;
      status.currentStage = getBrandMindStage(progress);
      status.coreIntensity = coreIntensity;
      status.awarenessProgress = clusterProgress.awareness ?? 0;
      status.associationProgress = clusterProgress.association ?? 0;
      status.reputationProgress = clusterProgress.reputation ?? 0;
      status.preferenceProgress = clusterProgress.preference ?? 0;
      status.loyaltyProgress = clusterProgress.loyalty ?? 0;
      status.activeRelationCount = activeRelationCount;
      status.direction = direction;
      status.fps = fps;
      status.minimumFps = minimumFps;
      status.activeScene = activeScene;
      publishFrame += 1;
      if (publishFrame % 12 === 0) publish();
    },
    dispose() {
      if (window.__BRAND_MIND_SCENE_STATUS__ === status) delete window.__BRAND_MIND_SCENE_STATUS__;
      delete document.documentElement.dataset.brandMindSceneStatus;
    }
  };

  function publish() {
    status.heapBytes = window.performance?.memory?.usedJSHeapSize ?? null;
    window.__BRAND_MIND_SCENE_STATUS__ = status;
    document.documentElement.dataset.brandMindSceneStatus = JSON.stringify(status);
  }
}

function getBrandMindStage(progress) {
  if (progress < 0.16) return 'cognition-waking';
  if (progress < 0.52) return 'cluster-gathering';
  if (progress < 0.76) return 'relations-establishing';
  if (progress < 0.92) return 'core-synchronizing';
  return 'operational';
}

function readDebugProgress() {
  if (!import.meta.env.DEV) return null;
  const value = new URLSearchParams(window.location.search).get('brandMindProgress');
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? clamp(parsed, 0, 1) : null;
}

export const brandMindSceneManager = {
  createBrandMindScene
};
