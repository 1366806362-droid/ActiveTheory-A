import * as THREE from 'three';

export const GEO_CINEMATIC_BLOOM_LAYER = 1;

const BLOOM_OBJECT_NAMES = Object.freeze(new Set([
  'Gyroscope Data Seed',
  'V3.3 Chamber Fresnel Edges And Internal Traces',
  'V3.3 Chamber Processing Nodes',
  'Gyroscope Mapped Entry Responses',
  'V3.4 Highlight Signal Nodes',
  'AI ANSWER Particles',
  'AI CITATION Particles',
  'Soft Organic Membrane Boundaries and Connections',
  'Soft Organic Membrane Nodes and Foreground Micro Particles'
]));

export function resolveGeoCinematicGrade(search = window.location.search) {
  const params = new URLSearchParams(search);
  const enabled = params.get('geoVisual') === 'v3-cinematic'
    && params.get('geoGrade') === 'cinematic';

  return Object.freeze({
    enabled,
    debugLayer: import.meta.env.DEV && params.get('geoGradeLayer') === 'bloom'
      ? 'bloom'
      : 'full'
  });
}

export function prepareGeoCinematicGradeScene(scene, selection) {
  const originalLayerMasks = new Map();
  const selectedNames = [];
  const status = {
    enabled: selection.enabled,
    active: false,
    mode: selection.enabled ? 'cinematic-selective' : 'off',
    debugLayer: selection.debugLayer,
    bloomLayer: GEO_CINEMATIC_BLOOM_LAYER,
    bloomObjectCount: 0,
    bloomObjectNames: selectedNames,
    bloomBufferScale: 0.5,
    geometryAdded: 0,
    materialAdded: selection.enabled ? 1 : 0,
    textureAdded: selection.enabled ? 1 : 0
  };

  if (selection.enabled) {
    scene.traverse((object) => {
      if (!isBloomObject(object)) return;
      originalLayerMasks.set(object, object.layers.mask);
      object.layers.enable(GEO_CINEMATIC_BLOOM_LAYER);
      selectedNames.push(object.name);
    });
    status.bloomObjectCount = selectedNames.length;
  }

  if (import.meta.env.DEV) {
    window.__GEO_CINEMATIC_GRADE_STATUS__ = status;
    publishStatus(status);
  }

  return {
    status,
    isSceneActive() {
      const previousActive = status.active;
      const geoRoot = scene.getObjectByName('GeoScene');
      status.active = Boolean(selection.enabled && isVisibleInHierarchy(geoRoot));
      if (status.active !== previousActive) publishStatus(status);
      return status.active;
    },
    dispose() {
      originalLayerMasks.forEach((mask, object) => {
        object.layers.mask = mask;
      });
      originalLayerMasks.clear();
      if (window.__GEO_CINEMATIC_GRADE_STATUS__ === status) {
        delete window.__GEO_CINEMATIC_GRADE_STATUS__;
      }
      delete document.documentElement.dataset.geoCinematicGradeStatus;
    }
  };
}

function publishStatus(status) {
  if (!import.meta.env.DEV) return;
  document.documentElement.dataset.geoCinematicGradeStatus = JSON.stringify(status);
}

export function createGeoCinematicGradeShader(bloomTexture, debugLayer = 'full') {
  return {
    uniforms: {
      tDiffuse: { value: null },
      tBloom: { value: bloomTexture },
      uBloomTexel: { value: new THREE.Vector2(1, 1) },
      uBloomStrength: { value: 0.55 },
      uGradeStrength: { value: 1 },
      uBloomOnly: { value: debugLayer === 'bloom' ? 1 : 0 }
    },
    vertexShader: `
      varying vec2 vUv;

      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform sampler2D tBloom;
      uniform vec2 uBloomTexel;
      uniform float uBloomStrength;
      uniform float uGradeStrength;
      uniform float uBloomOnly;
      varying vec2 vUv;

      vec3 sampleBloom(vec2 uv) {
        vec2 offset = uBloomTexel * 1.65;
        vec3 bloom = texture2D(tBloom, uv).rgb * 0.24;
        bloom += texture2D(tBloom, uv + vec2(offset.x, 0.0)).rgb * 0.12;
        bloom += texture2D(tBloom, uv - vec2(offset.x, 0.0)).rgb * 0.12;
        bloom += texture2D(tBloom, uv + vec2(0.0, offset.y)).rgb * 0.12;
        bloom += texture2D(tBloom, uv - vec2(0.0, offset.y)).rgb * 0.12;
        bloom += texture2D(tBloom, uv + offset).rgb * 0.07;
        bloom += texture2D(tBloom, uv - offset).rgb * 0.07;
        bloom += texture2D(tBloom, uv + vec2(offset.x, -offset.y)).rgb * 0.07;
        bloom += texture2D(tBloom, uv + vec2(-offset.x, offset.y)).rgb * 0.07;
        float peak = max(max(bloom.r, bloom.g), bloom.b);
        return bloom * smoothstep(0.48, 0.85, peak);
      }

      void main() {
        vec4 base = texture2D(tDiffuse, vUv);
        vec3 bloom = sampleBloom(vUv);
        if (uBloomOnly > 0.5) {
          gl_FragColor = vec4(bloom * 1.8, 1.0);
          return;
        }

        float luminance = dot(base.rgb, vec3(0.2126, 0.7152, 0.0722));
        float midtone = smoothstep(0.035, 0.46, luminance)
          * (1.0 - smoothstep(0.72, 0.98, luminance));
        vec3 graded = base.rgb;
        graded += vec3(-0.002, 0.012, 0.021) * midtone * uGradeStrength;
        graded = max((graded - 0.16) * 1.032 + 0.16, 0.0);
        float highlight = max(max(graded.r, graded.g), graded.b);
        graded /= 1.0 + max(highlight - 0.82, 0.0) * 0.2;
        graded += bloom * uBloomStrength;

        gl_FragColor = vec4(graded, base.a);
      }
    `
  };
}

function isBloomObject(object) {
  return BLOOM_OBJECT_NAMES.has(object.name)
    || object.name.endsWith('Processing Band Particles')
    || object.name.endsWith('Processing Band Broken Lines');
}

function isVisibleInHierarchy(object) {
  if (!object) return false;
  let current = object;

  while (current) {
    if (!current.visible) return false;
    current = current.parent;
  }
  return true;
}
