import * as THREE from 'three';
import { createGeoGyroscopeCore } from './geoGyroscopeCore.js';
import { smootherstep } from './geoSignalCore.js';

const SHELL_FRAGMENT_COUNT = 5;
const SHELL_NODE_COUNT = 72;
const TITLE_OPACITY_FACTOR = 0.89;
const DATA_SEED_OPACITY_FACTOR = 0.95;
const PROCESSING_DISK_OPACITY_FACTOR = 1.12;
const SHELL_FRAGMENTS = Object.freeze([
  Object.freeze({
    id: 'answer-chamber',
    entry: 0,
    radius: 0.39,
    start: 2.02,
    sweep: 0.82,
    width: 0.18,
    depth: 0.035,
    rotation: [0.46, 0.2, -0.28],
    opacity: 1,
    color: '#a9efff'
  }),
  Object.freeze({
    id: 'citation-chamber',
    entry: 1,
    radius: 0.42,
    start: 0.12,
    sweep: 0.88,
    width: 0.18,
    depth: -0.055,
    rotation: [-0.3, 0.42, 0.26],
    opacity: 0.92,
    color: '#e1f7ff'
  }),
  Object.freeze({
    id: 'keyword-chamber',
    entry: 2,
    radius: 0.37,
    start: -1.2,
    sweep: 0.72,
    width: 0.15,
    depth: 0.075,
    rotation: [0.32, -0.42, -0.12],
    opacity: 0.9,
    color: '#5bdfe9'
  }),
  Object.freeze({
    id: 'rear-chamber',
    entry: 3,
    radius: 0.43,
    start: 3.48,
    sweep: 1.02,
    width: 0.18,
    depth: -0.18,
    rotation: [-0.18, -0.22, -0.35],
    opacity: 0.62,
    color: '#9be9f5'
  }),
  Object.freeze({
    id: 'foreground-edge',
    entry: 3,
    radius: 0.34,
    start: -2.42,
    sweep: 0.34,
    width: 0.095,
    depth: 0.18,
    rotation: [0.22, 0.32, 0.16],
    opacity: 0.46,
    color: '#74d9eb'
  })
]);

export function createGeoCinematicCoreShell(resources, visualProfile) {
  const group = new THREE.Group();
  const baseCore = createGeoGyroscopeCore(resources, visualProfile);
  const shell = createTransparentShell(resources.pointTexture);
  const labelSprite = baseCore.group.children.find((child) => (
    child.isSprite && child.material?.map?.isCanvasTexture
  ));
  const dataSeed = baseCore.group.children.find((child) => child.name === 'Gyroscope Data Seed');
  const processingBands = baseCore.group.children.filter((child) => (
    child.name.includes('Processing Band')
  ));
  const processingFragments = baseCore.group.children.find((child) => (
    child.name === 'Gyroscope Processing Fragments'
  ));
  const entryResponses = baseCore.group.children.find((child) => (
    child.name === 'Gyroscope Mapped Entry Responses'
  ));
  let debugLayer = 'full';
  let debugVisuals = true;
  let debugLabel = true;

  group.name = 'GEO V3 Cinematic Core';
  baseCore.group.traverse((object) => {
    if (object.material?.transparent) object.renderOrder = Math.max(object.renderOrder, 9);
  });
  if (labelSprite) labelSprite.position.y -= 0.065;
  shell.group.position.z = -0.02;
  group.add(shell.group, baseCore.group);

  return {
    group,
    particleCount: baseCore.particleCount + SHELL_NODE_COUNT,
    shellFragmentCount: SHELL_FRAGMENT_COUNT,
    bandMetrics: baseCore.bandMetrics,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugVisibility();
    },
    setDebugVisibility(showVisuals, showLabel) {
      debugVisuals = showVisuals;
      debugLabel = showLabel;
      applyDebugVisibility();
    },
    update(time, progress, journey = null) {
      const coreProgress = journey?.baseTimeline ?? progress;
      const chamberProgress = journey?.chamber ?? progress;
      const intensity = baseCore.update(time, coreProgress);
      dataSeed?.scale.setScalar(1.06);
      if (dataSeed?.material?.uniforms?.uOpacity) {
        dataSeed.material.uniforms.uOpacity.value *= DATA_SEED_OPACITY_FACTOR;
      }
      processingBands.forEach((band) => {
        band.scale.multiplyScalar(0.59);
        band.traverse((child) => {
          if (child.material?.uniforms?.uOpacity) {
            child.material.uniforms.uOpacity.value *= PROCESSING_DISK_OPACITY_FACTOR;
          } else if (child.material?.transparent) {
            child.material.opacity = Math.min(
              1,
              child.material.opacity * PROCESSING_DISK_OPACITY_FACTOR
            );
          }
        });
      });
      processingFragments?.scale.setScalar(0.68);
      entryResponses?.scale.setScalar(0.61);
      shell.update(time, chamberProgress, journey);
      if (labelSprite) labelSprite.material.opacity *= TITLE_OPACITY_FACTOR;
      if (journey) labelSprite.material.opacity *= journey.label;
      applyDebugVisibility();
      return intensity;
    },
    dispose() {
      baseCore.dispose();
      shell.dispose();
      group.clear();
    }
  };

  function applyDebugVisibility() {
    const hiddenLabel = debugLayer === 'hidden-label';
    const full = debugLayer === 'full' || hiddenLabel;

    if (!debugVisuals) {
      baseCore.setDebugVisibility(false, false);
      shell.group.visible = false;
      return;
    }

    if (debugLayer === 'seed') {
      baseCore.setDebugVisibility(true, false);
      baseCore.setDebugLayer('seed');
      shell.group.visible = false;
      return;
    }

    if (debugLayer === 'bands') {
      baseCore.setDebugVisibility(true, false);
      baseCore.setDebugLayer('full');
      baseCore.group.children.forEach((child) => {
        child.visible = child.name.includes('Processing Band');
      });
      shell.group.visible = false;
      return;
    }

    if (debugLayer === 'shell') {
      baseCore.setDebugVisibility(false, false);
      shell.group.visible = true;
      return;
    }

    baseCore.setDebugVisibility(true, debugLabel && !hiddenLabel);
    baseCore.setDebugLayer(full ? (hiddenLabel ? 'hidden-label' : 'full') : debugLayer);
    shell.group.visible = full;
  }
}

function createTransparentShell(pointTexture) {
  const group = new THREE.Group();
  const surfaceData = createShellSurfaceGeometry();
  const edgeData = createShellEdgeGeometry();
  const nodeData = createShellNodeGeometry();
  const surfaceMaterial = createShellSurfaceMaterial();
  const edgeMaterial = createShellEdgeMaterial();
  const nodeMaterial = createShellNodeMaterial(pointTexture);
  const surfaces = new THREE.Mesh(surfaceData.geometry, surfaceMaterial);
  const edges = new THREE.LineSegments(edgeData.geometry, edgeMaterial);
  const nodes = new THREE.Points(nodeData.geometry, nodeMaterial);

  surfaces.name = 'V3.3 Open Chamber Curved Fragments';
  edges.name = 'V3.3 Chamber Fresnel Edges And Internal Traces';
  nodes.name = 'V3.3 Chamber Processing Nodes';
  surfaces.renderOrder = 10;
  edges.renderOrder = 11;
  nodes.renderOrder = 12;
  group.name = 'GEO V3.3 Transparent Core Chamber';
  group.add(surfaces, edges, nodes);

  return {
    group,
    update(time, progress, journey = null) {
      const reveal = smootherstep(0.22, 0.86, progress);
      const stable = smootherstep(0.88, 1, progress);
      const answer = journey
        ? createJourneyResponse(journey.response, 0, stable)
        : createEntryResponse(progress, 0.5, 0.7, stable);
      const citation = journey
        ? createJourneyResponse(journey.response, 0.18, stable)
        : createEntryResponse(progress, 0.58, 0.78, stable);
      const keyword = journey
        ? createJourneyResponse(journey.response, 0.36, stable)
        : createEntryResponse(progress, 0.66, 0.86, stable);

      updateShellUniforms(surfaceMaterial, time, reveal, stable, answer, citation, keyword);
      updateShellUniforms(edgeMaterial, time, reveal, stable, answer, citation, keyword);
      updateShellUniforms(nodeMaterial, time, reveal, stable, answer, citation, keyword);
      const assembly = journey?.chamber ?? reveal;
      surfaceMaterial.uniforms.uAssembly.value = assembly;
      edgeMaterial.uniforms.uAssembly.value = assembly;
      nodeMaterial.uniforms.uAssembly.value = assembly;
      group.rotation.y = Math.sin(time * 0.008) * 0.012 * stable;
      group.rotation.x = Math.cos(time * 0.0065) * 0.007 * stable;
    },
    dispose() {
      surfaceData.geometry.dispose();
      surfaceMaterial.dispose();
      edgeData.geometry.dispose();
      edgeMaterial.dispose();
      nodeData.geometry.dispose();
      nodeMaterial.dispose();
      group.clear();
    }
  };
}

function createShellSurfaceGeometry() {
  const positions = [];
  const colors = [];
  const alphas = [];
  const fragmentIds = [];
  const indices = [];
  const columns = 10;
  const rows = 4;

  SHELL_FRAGMENTS.forEach((definition, fragmentIndex) => {
    const rotation = new THREE.Euler(...definition.rotation);
    const vertexOffset = positions.length / 3;
    for (let row = 0; row <= rows; row += 1) {
      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns;
        const v = row / rows;
        const point = getShellPoint(definition, rotation, u, v);
        const color = new THREE.Color(definition.color);
        const edgeFade = Math.sin(Math.PI * u) * Math.sin(Math.PI * v);

        positions.push(point.x, point.y, point.z);
        colors.push(color.r, color.g, color.b);
        alphas.push((0.22 + edgeFade * 0.78) * definition.opacity);
        fragmentIds.push(fragmentIndex);
      }
    }
    for (let row = 0; row < rows; row += 1) {
      for (let column = 0; column < columns; column += 1) {
        if ((column + fragmentIndex * 2) % 7 === 5) continue;
        const a = vertexOffset + row * (columns + 1) + column;
        const b = a + 1;
        const c = a + columns + 1;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setAttribute('aFragment', new THREE.Float32BufferAttribute(fragmentIds, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry };
}

function createShellEdgeGeometry() {
  const positions = [];
  const colors = [];
  const alphas = [];
  const fragmentIds = [];
  const columns = 16;

  SHELL_FRAGMENTS.forEach((definition, fragmentIndex) => {
    const rotation = new THREE.Euler(...definition.rotation);
    const color = new THREE.Color(definition.color);
    const lanes = [0.04, 0.5, 0.96];

    lanes.forEach((lane, laneIndex) => {
      for (let column = 0; column < columns; column += 1) {
        if ((column + fragmentIndex + laneIndex) % 6 === 4) continue;
        const u0 = column / columns;
        const u1 = Math.min(1, (column + 0.72) / columns);
        const a = getShellPoint(definition, rotation, u0, lane);
        const b = getShellPoint(definition, rotation, u1, lane);
        const laneAlpha = (laneIndex === 1 ? 0.4 : 1) * definition.opacity;
        appendLineVertex(positions, colors, alphas, fragmentIds, a, color, laneAlpha, fragmentIndex);
        appendLineVertex(positions, colors, alphas, fragmentIds, b, color, laneAlpha, fragmentIndex);
      }
    });

    for (let connector = 1; connector <= 3; connector += 1) {
      const u = connector / 4 + Math.sin(fragmentIndex * 1.7 + connector) * 0.035;
      const a = getShellPoint(definition, rotation, u, 0.08);
      const b = getShellPoint(definition, rotation, u + 0.025, 0.92);
      appendLineVertex(
        positions,
        colors,
        alphas,
        fragmentIds,
        a,
        color,
        0.32 * definition.opacity,
        fragmentIndex
      );
      appendLineVertex(
        positions,
        colors,
        alphas,
        fragmentIds,
        b,
        color,
        0.32 * definition.opacity,
        fragmentIndex
      );
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setAttribute('aFragment', new THREE.Float32BufferAttribute(fragmentIds, 1));
  return { geometry };
}

function createShellNodeGeometry() {
  const positions = new Float32Array(SHELL_NODE_COUNT * 3);
  const colors = new Float32Array(SHELL_NODE_COUNT * 3);
  const sizes = new Float32Array(SHELL_NODE_COUNT);
  const fragments = new Float32Array(SHELL_NODE_COUNT);
  const phases = new Float32Array(SHELL_NODE_COUNT);

  for (let index = 0; index < SHELL_NODE_COUNT; index += 1) {
    const fragmentIndex = index % SHELL_FRAGMENT_COUNT;
    const definition = SHELL_FRAGMENTS[fragmentIndex];
    const rotation = new THREE.Euler(...definition.rotation);
    const localIndex = Math.floor(index / SHELL_FRAGMENT_COUNT);
    const fragmentPopulation = Math.ceil(SHELL_NODE_COUNT / SHELL_FRAGMENT_COUNT);
    const u = (localIndex + 0.35 + Math.sin(index * 2.17) * 0.16) / fragmentPopulation;
    const v = 0.12 + ((index * 7) % 11) / 14;
    const point = getShellPoint(definition, rotation, Math.min(0.96, u), v);
    const color = new THREE.Color(definition.color);
    const stride = index * 3;

    positions[stride] = point.x;
    positions[stride + 1] = point.y;
    positions[stride + 2] = point.z;
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = (index % 19 === 0 ? 1.36 : 0.58 + (index % 5) * 0.075)
      * definition.opacity;
    fragments[index] = fragmentIndex;
    phases[index] = (index * 2.399963229728653) % (Math.PI * 2);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aFragment', new THREE.BufferAttribute(fragments, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return { geometry };
}

function getShellPoint(definition, rotation, u, v) {
  const taper = 0.54 + Math.sin(Math.PI * u) * 0.46;
  const angleNoise = Math.sin(u * 8.7 + definition.radius * 11.3) * 0.025;
  const angle = definition.start + definition.sweep * u + angleNoise;
  const radialNoise = Math.sin(u * 5.9 + v * 4.3 + definition.depth * 9.1) * 0.012;
  const radius = definition.radius + (v - 0.5) * definition.width * taper + radialNoise;
  const surfaceCurl = Math.sin(Math.PI * v) * Math.sin(Math.PI * u) * 0.085;
  const chamberBowl = (1 - Math.pow(v * 2 - 1, 2)) * 0.035;
  const point = new THREE.Vector3(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.72,
    definition.depth
      + Math.sin(angle * 1.6 + definition.radius * 2.3) * 0.1
      + surfaceCurl
      + chamberBowl
  );
  point.applyEuler(rotation);
  return point;
}

function appendLineVertex(positions, colors, alphas, fragmentIds, point, color, alpha, fragmentIndex) {
  positions.push(point.x, point.y, point.z);
  colors.push(color.r, color.g, color.b);
  alphas.push(alpha);
  fragmentIds.push(fragmentIndex);
}

function createShellSurfaceMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: createShellUniforms(0.32),
    vertexShader: `
      attribute float aAlpha;
      attribute float aFragment;
      uniform float uTime;
      uniform float uStable;
      uniform float uAssembly;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vAlpha;
      varying float vFragment;

      void main() {
        float drift = sin(uTime * 0.075 + aFragment * 1.73) * 0.006 * uStable;
        vec3 animated = position + normal * drift;
        float assemblyOffset = (1.0 - uAssembly) * (aFragment - 2.0);
        animated.xy *= mix(0.78, 1.0, uAssembly);
        animated.z += assemblyOffset * 0.075;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        vAlpha = aAlpha;
        vFragment = aFragment;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uProgress;
      uniform vec3 uResponses;
      varying vec3 vColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;
      varying float vAlpha;
      varying float vFragment;

      float entryResponse(float fragment) {
        if (fragment < 0.5) return uResponses.x;
        if (fragment < 1.5) return uResponses.y;
        if (fragment < 2.5) return uResponses.z;
        return (uResponses.x + uResponses.y + uResponses.z) * 0.08;
      }

      void main() {
        float reveal = smoothstep(vFragment * 0.045, vFragment * 0.045 + 0.46, uProgress);
        float fresnel = pow(1.0 - abs(dot(normalize(vNormal), normalize(vViewDirection))), 2.2);
        float response = entryResponse(vFragment);
        float alpha = uOpacity * vAlpha * reveal * (0.35 + fresnel * 0.65);
        alpha *= 1.0 + response * 0.24;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(vColor * (0.72 + fresnel * 0.42), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createShellEdgeMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: createShellUniforms(0.68),
    vertexShader: `
      attribute float aAlpha;
      attribute float aFragment;
      uniform float uTime;
      uniform float uStable;
      uniform float uAssembly;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vFragment;

      void main() {
        vec3 animated = position;
        animated.z += sin(uTime * 0.08 + aFragment * 1.91) * 0.004 * uStable;
        float assemblyOffset = (1.0 - uAssembly) * (aFragment - 2.0);
        animated.xy *= mix(0.78, 1.0, uAssembly);
        animated.z += assemblyOffset * 0.075;
        vColor = color;
        vAlpha = aAlpha;
        vFragment = aFragment;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(animated, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uProgress;
      uniform vec3 uResponses;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vFragment;

      float entryResponse(float fragment) {
        if (fragment < 0.5) return uResponses.x;
        if (fragment < 1.5) return uResponses.y;
        if (fragment < 2.5) return uResponses.z;
        return 0.08;
      }

      void main() {
        float reveal = smoothstep(vFragment * 0.04, vFragment * 0.04 + 0.4, uProgress);
        float alpha = uOpacity * vAlpha * reveal * (1.0 + entryResponse(vFragment) * 0.32);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

function createShellNodeMaterial(pointTexture) {
  const uniforms = createShellUniforms(0.66);
  uniforms.uPointTexture = { value: pointTexture };
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      attribute float aSize;
      attribute float aFragment;
      attribute float aPhase;
      uniform float uTime;
      uniform float uStable;
      uniform float uAssembly;
      varying vec3 vColor;
      varying float vFragment;
      varying float vTwinkle;

      void main() {
        vec3 animated = position;
        float assemblyOffset = (1.0 - uAssembly) * (aFragment - 2.0);
        animated.xy *= mix(0.78, 1.0, uAssembly);
        animated.z += assemblyOffset * 0.075;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        vFragment = aFragment;
        vTwinkle = 0.88 + sin(uTime * 0.19 + aPhase) * 0.12 * uStable;
        gl_PointSize = aSize * (14.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uProgress;
      uniform vec3 uResponses;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vFragment;
      varying float vTwinkle;

      float entryResponse(float fragment) {
        if (fragment < 0.5) return uResponses.x;
        if (fragment < 1.5) return uResponses.y;
        if (fragment < 2.5) return uResponses.z;
        return 0.06;
      }

      void main() {
        float reveal = smoothstep(vFragment * 0.04, vFragment * 0.04 + 0.42, uProgress);
        float alpha = texture2D(uPointTexture, gl_PointCoord).a;
        alpha *= uOpacity * reveal * vTwinkle * (1.0 + entryResponse(vFragment) * 0.28);
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

function createShellUniforms(opacity) {
  return {
    uOpacity: { value: opacity },
    uProgress: { value: 0 },
    uStable: { value: 0 },
    uTime: { value: 0 },
    uResponses: { value: new THREE.Vector3() },
    uAssembly: { value: 1 }
  };
}

function updateShellUniforms(material, time, progress, stable, answer, citation, keyword) {
  material.uniforms.uTime.value = time;
  material.uniforms.uProgress.value = progress;
  material.uniforms.uStable.value = stable;
  material.uniforms.uResponses.value.set(answer, citation, keyword);
}

function createEntryResponse(progress, start, end, stable) {
  const arrival = smootherstep(start, end, progress);
  const decay = 1 - smootherstep(end - 0.015, end + 0.11, progress);
  return arrival * decay + stable * 0.1;
}

function createJourneyResponse(progress, delay, stable) {
  const local = smootherstep(delay, Math.min(1, delay + 0.48), progress);
  const decay = 1 - smootherstep(Math.min(0.86, delay + 0.38), Math.min(1, delay + 0.72), progress);
  return local * decay + stable * 0.1;
}
