import * as THREE from 'three';

const MEMBRANE_PATCHES = Object.freeze([
  Object.freeze({
    key: 'rear',
    name: 'rear-left-canopy',
    center: Object.freeze([-2.04, 0.88]),
    scale: Object.freeze([2.25, 1.02]),
    color: '#1d4d68',
    opacity: 0.104,
    seed: 0.73,
    z: -0.78,
    rotation: -0.11,
    bend: 0.22,
    cavity: 0.15,
    parallax: 0.003
  }),
  Object.freeze({
    key: 'rear',
    name: 'rear-right-canopy',
    center: Object.freeze([0.56, 0.44]),
    scale: Object.freeze([2.55, 1.24]),
    color: '#204c66',
    opacity: 0.094,
    seed: 1.91,
    z: -0.86,
    rotation: 0.14,
    bend: 0.19,
    cavity: 0.19,
    parallax: 0.0035
  }),
  Object.freeze({
    key: 'mid',
    name: 'answer-tissue',
    center: Object.freeze([-2.08, 0.42]),
    scale: Object.freeze([1.66, 0.82]),
    color: '#54c6e2',
    opacity: 0.242,
    seed: 2.47,
    z: -0.12,
    rotation: -0.23,
    bend: 0.28,
    cavity: 0.28,
    parallax: 0.006
  }),
  Object.freeze({
    key: 'mid',
    name: 'citation-tissue',
    center: Object.freeze([1.86, 0.66]),
    scale: Object.freeze([1.44, 0.76]),
    color: '#87a8c0',
    opacity: 0.208,
    seed: 3.38,
    z: -0.25,
    rotation: 0.2,
    bend: 0.24,
    cavity: 0.3,
    parallax: 0.0065
  }),
  Object.freeze({
    key: 'mid',
    name: 'keyword-tissue',
    center: Object.freeze([1.88, -0.78]),
    scale: Object.freeze([1.66, 0.7]),
    color: '#3bb6c8',
    opacity: 0.214,
    seed: 4.41,
    z: -0.08,
    rotation: -0.12,
    bend: 0.24,
    cavity: 0.32,
    parallax: 0.007
  }),
  Object.freeze({
    key: 'mid',
    name: 'central-upper-bridge',
    center: Object.freeze([-0.02, -0.02]),
    scale: Object.freeze([1.32, 0.76]),
    color: '#326b84',
    opacity: 0.142,
    seed: 5.63,
    z: -1.08,
    rotation: 0.05,
    bend: 0.34,
    cavity: 0.46,
    parallax: 0.005
  }),
  Object.freeze({
    key: 'mid',
    name: 'central-lower-bridge',
    center: Object.freeze([0.08, -0.72]),
    scale: Object.freeze([1.52, 0.5]),
    color: '#397d95',
    opacity: 0.164,
    seed: 6.74,
    z: -0.42,
    rotation: -0.06,
    bend: 0.27,
    cavity: 0.68,
    parallax: 0.005
  }),
  Object.freeze({
    key: 'foreground',
    name: 'foreground-left-fold',
    center: Object.freeze([-3.12, -1.04]),
    scale: Object.freeze([1.58, 0.9]),
    color: '#356e82',
    opacity: 0.046,
    seed: 7.82,
    z: 0.72,
    rotation: 0.28,
    bend: 0.38,
    cavity: 0.05,
    parallax: 0.016
  }),
  Object.freeze({
    key: 'foreground',
    name: 'foreground-top-fold',
    center: Object.freeze([0.55, 1.58]),
    scale: Object.freeze([2.05, 0.56]),
    color: '#315f71',
    opacity: 0.044,
    seed: 8.96,
    z: 0.64,
    rotation: -0.08,
    bend: 0.34,
    cavity: 0.1,
    parallax: 0.014
  })
]);

export function createGeoV4OrganicEnvironment(resources, sharedField) {
  const group = new THREE.Group();
  const patchGeometry = createMembranePatchGeometry();
  const patches = MEMBRANE_PATCHES.map((spec) => (
    createMembranePatch(patchGeometry, spec, sharedField)
  ));
  const cells = createCellNetwork(sharedField);
  const fibers = createSharedFibers(sharedField);
  const nodes = createMembraneNodes(sharedField, resources.pointTexture);

  group.name = 'GEO V4 Shared Organic Environment';
  patches.forEach(({ mesh }) => group.add(mesh));
  group.add(cells.patchMesh, cells.mesh, fibers.lines, nodes.points);

  let debugLayer = 'full';
  applyDebugLayer();

  return {
    group,
    particleCount: nodes.particleCount,
    segmentCount: cells.segmentCount + fibers.segmentCount,
    foregroundParticleCount: nodes.foregroundParticleCount,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugLayer();
    },
    update(time, reveal = 1, pointer = null) {
      const opacity = THREE.MathUtils.clamp(reveal, 0, 1);
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;

      patches.forEach(({ mesh, material, spec, basePosition }) => {
        material.uniforms.uTime.value = time;
        material.uniforms.uOpacity.value = opacity * spec.opacity;
        const targetX = basePosition.x + px * spec.parallax;
        const targetY = basePosition.y - py * spec.parallax * 0.58;
        mesh.position.x += (targetX - mesh.position.x) * 0.028;
        mesh.position.y += (targetY - mesh.position.y) * 0.028;
      });
      cells.material.uniforms.uTime.value = time;
      cells.material.uniforms.uOpacity.value = opacity * 0.092;
      cells.patchMaterial.uniforms.uTime.value = time;
      cells.patchMaterial.uniforms.uOpacity.value = opacity * 0.076;
      fibers.material.uniforms.uTime.value = time;
      fibers.material.uniforms.uOpacity.value = opacity * 0.19;
      nodes.material.uniforms.uTime.value = time;
      nodes.material.uniforms.uOpacity.value = opacity * 0.26;
      const tissueX = px * 0.006;
      const tissueY = -py * 0.0035;
      [cells.patchMesh, cells.mesh, fibers.lines, nodes.points].forEach((object) => {
        object.position.x += (tissueX - object.position.x) * 0.028;
        object.position.y += (tissueY - object.position.y) * 0.028;
      });
    },
    dispose() {
      patchGeometry.dispose();
      patches.forEach(({ material }) => material.dispose());
      cells.dispose();
      fibers.dispose();
      nodes.dispose();
      group.clear();
    }
  };

  function applyDebugLayer() {
    const full = debugLayer === 'full';
    const environment = debugLayer === 'environment' || debugLayer === 'organism';
    const field = debugLayer === 'field';
    patches.forEach(({ mesh, spec }) => {
      mesh.visible = full
        || environment
        || debugLayer === 'membrane'
        || debugLayer === 'surface'
        || (field && spec.key !== 'foreground')
        || debugLayer === spec.key;
    });
    cells.mesh.visible = full
      || environment
      || field
      || debugLayer === 'membrane'
      || debugLayer === 'cells'
      || debugLayer === 'mid';
    cells.patchMesh.visible = cells.mesh.visible;
    fibers.lines.visible = full
      || environment
      || field
      || debugLayer === 'membrane'
      || debugLayer === 'fibers'
      || debugLayer === 'cavity';
    nodes.points.visible = full
      || environment
      || field
      || debugLayer === 'membrane'
      || debugLayer === 'cells'
      || debugLayer === 'fibers';
  }
}

function createMembranePatchGeometry() {
  const geometry = new THREE.PlaneGeometry(2, 2, 24, 14);
  geometry.computeVertexNormals();
  return geometry;
}

function createMembranePatch(geometry, spec, field) {
  const centerSample = field.sample(spec.center[0], spec.center[1], spec.z);
  const material = createMembranePatchMaterial(spec, centerSample, field.core);
  const mesh = new THREE.Mesh(geometry, material);
  const basePosition = new THREE.Vector3(spec.center[0], spec.center[1], spec.z);
  mesh.name = `GEO V4 ${spec.name} Volumetric Membrane`;
  mesh.position.copy(basePosition);
  mesh.scale.set(spec.scale[0], spec.scale[1], 1);
  mesh.rotation.z = spec.rotation;
  mesh.renderOrder = spec.key === 'rear' ? -4 : spec.key === 'foreground' ? 4 : -1;
  return { mesh, material, spec, basePosition };
}

function createMembranePatchMaterial(spec, centerSample, core) {
  const holes = createPatchHoles(spec.seed);
  const detail = spec.key === 'mid' ? 1 : spec.key === 'rear' ? 0.34 : 0.035;
  const porosity = spec.name === 'central-upper-bridge'
    ? 0.2
    : spec.name === 'central-lower-bridge'
      ? 0.62
      : 1;
  const coreOffset = new THREE.Vector2(
    core.x - spec.center[0],
    core.y - spec.center[1]
  ).rotateAround(new THREE.Vector2(), -spec.rotation);
  coreOffset.set(
    coreOffset.x / spec.scale[0],
    coreOffset.y / spec.scale[1]
  );
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSeed: { value: spec.seed },
      uColor: { value: new THREE.Color(spec.color) },
      uBend: { value: spec.bend },
      uCavity: { value: spec.cavity },
      uDensity: { value: centerSample.density },
      uAttraction: { value: centerSample.attraction },
      uDetail: { value: detail },
      uPorosity: { value: porosity },
      uCavityCenter: { value: coreOffset },
      uHoleA: { value: holes[0] },
      uHoleB: { value: holes[1] },
      uHoleC: { value: holes[2] },
      uHoleD: { value: holes[3] }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSeed;
      uniform float uBend;
      uniform float uCavity;
      uniform float uAttraction;
      uniform vec2 uCavityCenter;
      varying vec2 vUv;
      varying vec2 vLocal;
      varying vec3 vPatchNormal;
      varying float vFold;
      varying float vCavity;

      void main() {
        vec2 local = position.xy;
        float radial = length(local * vec2(0.86, 1.08));
        float waveA = sin(local.x * 2.45 + local.y * 1.34 + uSeed);
        float waveB = cos(local.y * 3.2 - local.x * 0.82 - uSeed * 0.61);
        float waveC = sin((local.x + local.y) * 4.1 + uSeed * 1.73);
        float fold = waveA * 0.54 + waveB * 0.31 + waveC * 0.15;
        float livingDrift = sin(uTime * 0.052 + uSeed + local.x * 1.7) * 0.012;
        float cavityDistance = length(
          (local - uCavityCenter) * vec2(0.88, 1.16)
        );
        float cavityProfile = exp(-cavityDistance * cavityDistance * 4.4)
          * uCavity;
        vec3 displaced = position;
        displaced.x += local.y * local.y * sin(uSeed * 1.13) * 0.055;
        displaced.y += local.x * local.x * cos(uSeed * 0.79) * 0.04;
        displaced.z += fold * uBend + livingDrift;
        displaced.z -= cavityProfile * (0.22 + uAttraction * 0.28);

        float dzdx = cos(local.x * 2.45 + local.y * 1.34 + uSeed)
          * 2.45 * 0.54 * uBend;
        dzdx += sin(local.y * 3.2 - local.x * 0.82 - uSeed * 0.61)
          * 0.82 * 0.31 * uBend;
        float dzdy = cos(local.x * 2.45 + local.y * 1.34 + uSeed)
          * 1.34 * 0.54 * uBend;
        dzdy -= sin(local.y * 3.2 - local.x * 0.82 - uSeed * 0.61)
          * 3.2 * 0.31 * uBend;
        vec3 patchNormal = normalize(vec3(-dzdx, -dzdy, 1.0));

        vUv = uv;
        vLocal = local;
        vPatchNormal = normalize(normalMatrix * patchNormal);
        vFold = fold * 0.5 + 0.5;
        vCavity = cavityProfile;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uSeed;
      uniform float uDensity;
      uniform float uDetail;
      uniform float uPorosity;
      uniform vec3 uColor;
      uniform vec4 uHoleA;
      uniform vec4 uHoleB;
      uniform vec4 uHoleC;
      uniform vec4 uHoleD;
      varying vec2 vUv;
      varying vec2 vLocal;
      varying vec3 vPatchNormal;
      varying float vFold;
      varying float vCavity;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = noise(p) * 0.58;
        value += noise(p * 2.07 + 1.9) * 0.28;
        value += noise(p * 4.13 - 3.1) * 0.14;
        return value;
      }

      vec2 hash2(vec2 p) {
        return fract(sin(vec2(
          dot(p, vec2(127.1, 311.7)),
          dot(p, vec2(269.5, 183.3))
        )) * 43758.5453);
      }

      float cellularBorder(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 8.0;
        float second = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 site = offset + hash2(cell + offset);
            vec2 delta = site - local;
            float distanceSquared = dot(delta, delta);
            if (distanceSquared < nearest) {
              second = nearest;
              nearest = distanceSquared;
            } else if (distanceSquared < second) {
              second = distanceSquared;
            }
          }
        }
        return sqrt(second) - sqrt(nearest);
      }

      float opening(vec2 q, vec4 hole, float phase) {
        vec2 shifted = q - hole.xy;
        float warp = fbm(shifted * 2.8 + uSeed + phase) - 0.5;
        shifted.x += warp * 0.16;
        shifted.y += (noise(shifted * 3.7 - phase) - 0.5) * 0.13;
        float distanceField = length(shifted / max(hole.zw, vec2(0.05)));
        return 1.0 - smoothstep(0.76 + warp * 0.08, 1.08 + warp * 0.1, distanceField);
      }

      void main() {
        vec2 q = (vUv - 0.5) * 2.0;
        float low = fbm(q * 0.72 + uSeed * 0.37);
        float middle = fbm(q * 1.48 - uSeed * 0.23);
        float fine = noise(q * 5.2 + uSeed * 1.9);
        float boundaryNoise = (low - 0.5) * 0.28 + (middle - 0.5) * 0.11;
        float boundaryRadius = length(q * vec2(0.86, 1.08));
        float boundary = 1.0 - smoothstep(
          0.72 + boundaryNoise,
          1.03 + boundaryNoise,
          boundaryRadius
        );
        float boundaryBreak = smoothstep(
          0.18,
          0.62,
          fbm(q * 1.16 + uSeed * 0.57) + boundary * 0.24
        );
        boundary *= mix(0.26, 1.0, boundaryBreak);

        float pores = max(
          max(opening(q, uHoleA, 0.7), opening(q, uHoleB, 1.9)),
          max(opening(q, uHoleC, 3.1), opening(q, uHoleD, 4.6))
        );
        float poreBreak = smoothstep(0.36, 0.74, fine * 0.45 + low * 0.55);
        pores *= mix(0.72, 1.0, poreBreak) * uPorosity;

        vec2 cellWarp = vec2(
          fbm(q * 0.64 + uSeed),
          fbm(q * 0.72 - uSeed)
        ) - 0.5;
        vec2 warpedCells = q + vec2(
          sin(q.y * 2.4 + uSeed),
          cos(q.x * 1.7 - uSeed)
        ) * 0.24 + cellWarp * 0.76;
        float cellDistance = cellularBorder(
          vec2(warpedCells.x * 1.24, warpedCells.y * 0.72)
          * (3.08 + uDensity * 1.18)
          + uSeed
        );
        float cellular = 1.0 - smoothstep(0.006, 0.029, cellDistance);
        float cellBreak = smoothstep(0.34, 0.62, low * 0.56 + fine * 0.44);
        cellular *= cellBreak * (1.0 - pores * 0.86) * uDetail;
        float poreRim = smoothstep(0.22, 0.66, pores)
          * (1.0 - smoothstep(0.72, 0.96, pores));
        poreRim *= smoothstep(0.34, 0.68, low * 0.55 + fine * 0.45);

        float bodyVariation = smoothstep(
          0.23,
          0.78,
          low * 0.42 + middle * 0.32 + vFold * 0.26
        );
        float translucentBody = 0.18 + bodyVariation * 0.82;
        float foldLight = smoothstep(0.56, 0.86, vFold + middle * 0.18);
        float viewFresnel = pow(
          1.0 - abs(normalize(vPatchNormal).z),
          2.25
        );
        float fresnelBreak = smoothstep(0.58, 0.79, low * 0.62 + fine * 0.38);
        float localFresnel = viewFresnel * fresnelBreak
          * mix(0.16, 1.0, uDetail);
        float ridgeField = abs(
          fbm(q * vec2(1.08, 1.62) + uSeed * 0.43)
          - (0.48 + (middle - 0.5) * 0.12)
        );
        float tissueRidge = 1.0 - smoothstep(0.035, 0.11, ridgeField);
        tissueRidge *= smoothstep(0.42, 0.7, fine * 0.48 + low * 0.52);
        tissueRidge *= (1.0 - pores * 0.88);
        tissueRidge *= mix(0.28, 1.0, uDetail);

        float cavityThin = 1.0 - vCavity * 0.46;
        float alpha = uOpacity * boundary * cavityThin
          * (1.0 - pores * 0.94)
          * (0.2 + translucentBody * 0.36);
        alpha += uOpacity * boundary * cellular * (0.42 + uDensity * 0.2);
        alpha += uOpacity * boundary * poreRim * 0.38 * mix(0.1, 1.0, uDetail);
        alpha += uOpacity * boundary * localFresnel * 0.46;
        alpha += uOpacity * boundary * foldLight * bodyVariation * 0.16;
        alpha += uOpacity * boundary * tissueRidge * 0.1;
        if (alpha < 0.0022) discard;

        vec3 color = uColor * (
          0.54
          + bodyVariation * 0.22
          + cellular * 1.08
          + poreRim * 0.68
          + localFresnel * 0.92
          + foldLight * 0.24
          + tissueRidge * 0.18
        );
        color += vec3(0.12, 0.26, 0.31) * cellular * 0.24;
        gl_FragColor = vec4(color, min(alpha, 0.38));
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createPatchHoles(seed) {
  const angle = seed * 1.731;
  return [
    new THREE.Vector4(
      Math.sin(angle) * 0.31,
      Math.cos(angle * 1.17) * 0.22,
      0.2 + Math.abs(Math.sin(angle * 0.73)) * 0.13,
      0.12 + Math.abs(Math.cos(angle * 0.61)) * 0.12
    ),
    new THREE.Vector4(
      -0.42 + Math.sin(angle * 0.83) * 0.12,
      0.22 + Math.cos(angle * 1.29) * 0.2,
      0.14 + Math.abs(Math.cos(angle * 0.47)) * 0.1,
      0.1 + Math.abs(Math.sin(angle * 0.94)) * 0.09
    ),
    new THREE.Vector4(
      0.38 + Math.cos(angle * 0.59) * 0.13,
      -0.3 + Math.sin(angle * 1.07) * 0.14,
      0.12 + Math.abs(Math.sin(angle * 0.41)) * 0.1,
      0.1 + Math.abs(Math.cos(angle * 0.84)) * 0.08
    ),
    new THREE.Vector4(
      Math.cos(angle * 1.31) * 0.28,
      0.48 + Math.sin(angle * 0.52) * 0.1,
      0.11 + Math.abs(Math.cos(angle * 0.36)) * 0.09,
      0.08 + Math.abs(Math.sin(angle * 0.69)) * 0.08
    )
  ];
}

function createSurfaceGeometry(field) {
  const columns = 48;
  const rows = 26;
  const positions = [];
  const normals = [];
  const uvs = [];
  const densities = [];
  const attractions = [];
  const noises = [];
  const indices = [];

  for (let row = 0; row <= rows; row += 1) {
    const v = row / rows;
    const y = -1.72 + v * 3.44;
    for (let column = 0; column <= columns; column += 1) {
      const u = column / columns;
      const x = -3.48 + u * 6.96;
      const sample = field.sample(x, y, -0.58);
      positions.push(sample.position.x, sample.position.y, sample.position.z);
      normals.push(sample.normal.x, sample.normal.y, sample.normal.z);
      uvs.push(u, v);
      densities.push(sample.density);
      attractions.push(sample.attraction);
      noises.push(sample.localNoise);
    }
  }

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const a = row * (columns + 1) + column;
      const b = a + 1;
      const c = a + columns + 1;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute('aDensity', new THREE.Float32BufferAttribute(densities, 1));
  geometry.setAttribute('aAttraction', new THREE.Float32BufferAttribute(attractions, 1));
  geometry.setAttribute('aLocalNoise', new THREE.Float32BufferAttribute(noises, 1));
  geometry.setIndex(indices);
  return geometry;
}

function createSurfaceLayer(geometry, layer) {
  const material = createSurfaceMaterial(layer);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `GEO V4 Shared ${layer.key} Tissue Veil`;
  mesh.scale.setScalar(layer.scale);
  mesh.position.z = layer.z;
  mesh.renderOrder = layer.key === 'rear' ? -3 : layer.key === 'foreground' ? 3 : -1;
  return { mesh, material, layer };
}

function createSurfaceMaterial(layer) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uLayerSeed: { value: layer.seed },
      uColor: { value: new THREE.Color(layer.color) }
    },
    vertexShader: `
      attribute float aDensity;
      attribute float aAttraction;
      attribute float aLocalNoise;
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDensity;
      varying float vAttraction;
      varying float vNoise;
      uniform float uTime;
      uniform float uLayerSeed;
      void main() {
        vec3 displaced = position;
        float drift = sin(position.x * 0.72 + position.y * 0.54 + uLayerSeed);
        drift += cos(position.x * 0.31 - position.y * 0.84 - uLayerSeed) * 0.55;
        displaced.z += drift * 0.018 + sin(uTime * 0.035 + uLayerSeed) * 0.006;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vUv = uv;
        vPosition = displaced;
        vNormal = normalize(normalMatrix * normal);
        vDensity = aDensity;
        vAttraction = aAttraction;
        vNoise = aLocalNoise;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uLayerSeed;
      uniform vec3 uColor;
      varying vec2 vUv;
      varying vec3 vPosition;
      varying vec3 vNormal;
      varying float vDensity;
      varying float vAttraction;
      varying float vNoise;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
          mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
          f.y
        );
      }
      vec2 hash2(vec2 p) {
        return fract(sin(vec2(
          dot(p, vec2(127.1, 311.7)),
          dot(p, vec2(269.5, 183.3))
        )) * 43758.5453);
      }
      float cellularBorder(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 8.0;
        float second = 8.0;
        for (int y = -1; y <= 1; y++) {
          for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(float(x), float(y));
            vec2 site = offset + hash2(cell + offset);
            vec2 delta = site - local;
            float distanceSquared = dot(delta, delta);
            if (distanceSquared < nearest) {
              second = nearest;
              nearest = distanceSquared;
            } else if (distanceSquared < second) {
              second = distanceSquared;
            }
          }
        }
        return sqrt(second) - sqrt(nearest);
      }
      void main() {
        vec2 p = vPosition.xy;
        float low = noise(p * 0.62 + uLayerSeed);
        float middle = noise(p * 1.38 - uLayerSeed * 0.37);
        float fine = noise(p * 2.7 + vec2(uLayerSeed, -uLayerSeed));
        float poreField = low * 0.5 + middle * 0.34 + fine * 0.16;
        float pores = smoothstep(0.68, 0.82, poreField + vNoise * 0.12);
        float patchField = low * 0.38 + middle * 0.27 + vNoise * 0.16 + vDensity * 0.3;
        float patchMask = smoothstep(0.31, 0.58, patchField);
        float edgeX = smoothstep(0.0, 0.08, vUv.x) * smoothstep(0.0, 0.08, 1.0 - vUv.x);
        float edgeY = smoothstep(0.0, 0.11, vUv.y) * smoothstep(0.0, 0.11, 1.0 - vUv.y);
        float densityPatch = smoothstep(0.1, 0.55, vDensity + (middle - 0.5) * 0.16);
        float coverage = 0.018 + densityPatch * 0.982;
        float cavityPull = smoothstep(
          0.7,
          0.998,
          vAttraction + (low - 0.5) * 0.055 + (fine - 0.5) * 0.018
        );
        float rearLayer = 1.0 - smoothstep(0.9, 1.3, uLayerSeed);
        float cavity = 1.0 - cavityPull * mix(0.52, 0.18, rearLayer);
        float viewEdge = pow(1.0 - abs(normalize(vNormal).z), 2.1);
        float localFresnel = viewEdge * smoothstep(
          0.58,
          0.84,
          middle * 0.65 + vDensity * 0.38
        );
        float illumination = 0.42 + localFresnel * 0.72 + middle * 0.16;
        float alpha = uOpacity * coverage * edgeX * edgeY * cavity
          * (0.08 + patchMask * 0.92);
        alpha *= (1.0 - pores * 0.84) * illumination;
        alpha += uOpacity * rearLayer * cavityPull
          * (0.08 + low * 0.12) * edgeX * edgeY;
        vec2 cellWarp = vec2(
          noise(p * 0.42 + uLayerSeed),
          noise(p * 0.47 - uLayerSeed)
        ) - 0.5;
        vec2 cellularPoint = vec2(p.x, p.y * 1.18) * 3.15
          + cellWarp * 0.82
          + uLayerSeed * 0.13;
        float cellDistance = cellularBorder(cellularPoint);
        float cellEdge = 1.0 - smoothstep(0.012, 0.045, cellDistance);
        float cellRegion = smoothstep(
          0.14,
          0.6,
          vDensity + middle * 0.18 + vNoise * 0.1
        );
        float edgeBreakup = smoothstep(0.3, 0.69, low * 0.58 + fine * 0.42);
        float midLayer = 1.0 - smoothstep(0.35, 1.55, abs(uLayerSeed - 2.4));
        float foregroundLayer = smoothstep(3.8, 4.4, uLayerSeed);
        float detailDepth = (0.28 + midLayer * 0.72)
          * (1.0 - foregroundLayer * 0.82);
        float embeddedCell = cellEdge * cellRegion * edgeBreakup
          * (1.0 - pores * 0.72) * detailDepth;
        alpha += uOpacity * embeddedCell * 0.34 * edgeX * edgeY * cavity;
        float organicDensity = smoothstep(
          0.55,
          0.88,
          vDensity + vNoise * 0.16 + localFresnel * 0.08
        );
        float foldField = middle + low * 0.14 + fine * 0.04;
        float membraneBand = smoothstep(0.38, 0.54, foldField)
          * (1.0 - smoothstep(0.71, 0.86, foldField));
        float localSheet = membraneBand * organicDensity
          * (0.3 + patchMask * 0.7)
          * (1.0 - pores * 0.64);
        alpha += uOpacity * localSheet * 0.52 * edgeX * edgeY * cavity;
        float tissueFold = smoothstep(
          0.46,
          0.82,
          middle * 0.5 + fine * 0.12 + vDensity * 0.62 + localFresnel * 0.18
        );
        alpha += uOpacity * coverage * tissueFold * 0.92 * edgeX * edgeY * cavity;
        if (alpha < 0.0025) discard;
        vec3 color = uColor * (
          0.46
          + middle * 0.2
          + localFresnel * 0.54
          + tissueFold * 0.46
          + embeddedCell * 0.28
          + localSheet * 0.54
        );
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createCellNetwork(field) {
  const positions = [];
  const colors = [];
  const alphas = [];
  const sides = [];
  const alongs = [];
  const patchPositions = [];
  const patchColors = [];
  const patchAlphas = [];
  const patchRadials = [];
  const palette = {
    answer: new THREE.Color('#47a9bd'),
    citation: new THREE.Color('#718aa4'),
    keyword: new THREE.Color('#2b8494'),
    shared: new THREE.Color('#2b6275')
  };
  let segmentCount = 0;

  field.getCells().forEach((cell, cellIndex) => {
    const color = palette[cell.businessRegion] || palette.shared;
    const subdivisions = 4;
    const smoothPoints = new THREE.CatmullRomCurve3(
      cell.points.map((point) => point.clone()),
      true,
      'catmullrom',
      0.54
    ).getPoints(cell.points.length * subdivisions);
    for (let index = 0; index < smoothPoints.length - 1; index += 1) {
      const sourceSegment = Math.min(
        Math.floor(index / subdivisions),
        cell.visibleSegments.length - 1
      );
      if (!cell.visibleSegments[sourceSegment]) continue;
      const a = smoothPoints[index];
      const b = smoothPoints[index + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const length = Math.max(Math.hypot(dx, dy), 0.0001);
      const width = (
        0.00135
        + cell.density * 0.0017
        + cell.attraction * 0.0007
        + (cellIndex % 5) * 0.00014
      );
      const nx = -dy / length * width;
      const ny = dx / length * width;
      const alongA = index % subdivisions / subdivisions;
      const alongB = (index % subdivisions + 1) / subdivisions;
      const vertices = [
        [a.x - nx, a.y - ny, a.z, -1, alongA],
        [a.x + nx, a.y + ny, a.z, 1, alongA],
        [b.x + nx, b.y + ny, b.z, 1, alongB],
        [a.x - nx, a.y - ny, a.z, -1, alongA],
        [b.x + nx, b.y + ny, b.z, 1, alongB],
        [b.x - nx, b.y - ny, b.z, -1, alongB]
      ];
      const alpha = THREE.MathUtils.clamp(
        0.16 + cell.density * 0.58 + cell.attraction * 0.16 + (cellIndex % 4) * 0.04,
        0.14,
        0.88
      );
      vertices.forEach(([x, y, z, side, along]) => {
        positions.push(x, y, z);
        colors.push(color.r, color.g, color.b);
        alphas.push(alpha);
        sides.push(side);
        alongs.push(along);
      });
      segmentCount += 1;
    }

    if ((cellIndex * 7) % 13 > 3 || cell.density > 0.43) {
      const centerAlpha = THREE.MathUtils.clamp(
        0.08 + cell.density * 0.34 + cell.attraction * 0.08,
        0.06,
        0.42
      );
      for (let index = 0; index < cell.points.length; index += 1) {
        const nextIndex = (index + 1) % cell.points.length;
        const a = cell.points[index];
        const b = cell.points[nextIndex];
        [
          [cell.center, 0],
          [a, 1],
          [b, 1]
        ].forEach(([point, radial]) => {
          patchPositions.push(point.x, point.y, point.z - 0.008);
          patchColors.push(color.r, color.g, color.b);
          patchAlphas.push(centerAlpha);
          patchRadials.push(radial);
        });
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  geometry.setAttribute('aSide', new THREE.Float32BufferAttribute(sides, 1));
  geometry.setAttribute('aAlong', new THREE.Float32BufferAttribute(alongs, 1));
  const material = createCellRibbonMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'GEO V4 Embedded Soft Cellular Tissue';
  mesh.renderOrder = 0;

  const patchGeometry = new THREE.BufferGeometry();
  patchGeometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(patchPositions, 3)
  );
  patchGeometry.setAttribute('color', new THREE.Float32BufferAttribute(patchColors, 3));
  patchGeometry.setAttribute(
    'aPatchAlpha',
    new THREE.Float32BufferAttribute(patchAlphas, 1)
  );
  patchGeometry.setAttribute(
    'aRadial',
    new THREE.Float32BufferAttribute(patchRadials, 1)
  );
  const patchMaterial = createCellPatchMaterial();
  const patchMesh = new THREE.Mesh(patchGeometry, patchMaterial);
  patchMesh.name = 'GEO V4 Translucent Cellular Tissue Patches';
  patchMesh.renderOrder = -0.5;
  return {
    mesh,
    material,
    patchMesh,
    patchMaterial,
    segmentCount,
    dispose() {
      geometry.dispose();
      material.dispose();
      patchGeometry.dispose();
      patchMaterial.dispose();
    }
  };
}

function createCellPatchMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      attribute float aPatchAlpha;
      attribute float aRadial;
      varying vec3 vColor;
      varying float vPatchAlpha;
      varying float vRadial;
      void main() {
        vColor = color;
        vPatchAlpha = aPatchAlpha;
        vRadial = aRadial;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vPatchAlpha;
      varying float vRadial;
      void main() {
        float body = (1.0 - smoothstep(0.5, 1.0, vRadial)) * 0.42;
        float softEdge = smoothstep(0.64, 0.84, vRadial)
          * (1.0 - smoothstep(0.86, 1.0, vRadial));
        float bodyVariation = 0.84 + sin(
          vRadial * 8.0 + uTime * 0.025 + vPatchAlpha * 9.0
        ) * 0.16;
        float alpha = uOpacity * vPatchAlpha * (body + softEdge * 0.16)
          * bodyVariation;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor * (0.46 + softEdge * 0.12), alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createCellRibbonMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      attribute float aAlpha;
      attribute float aSide;
      attribute float aAlong;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSide;
      varying float vAlong;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        vSide = aSide;
        vAlong = aAlong;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      varying float vSide;
      varying float vAlong;
      void main() {
        float crossFeather = 1.0 - smoothstep(0.35, 1.0, abs(vSide));
        float endFeather = smoothstep(0.0, 0.035, vAlong)
          * smoothstep(0.0, 0.035, 1.0 - vAlong);
        float shimmer = 0.92 + sin(uTime * 0.035 + vAlpha * 7.0) * 0.08;
        float alpha = uOpacity * vAlpha * crossFeather * endFeather * shimmer;
        if (alpha < 0.002) discard;
        gl_FragColor = vec4(vColor * 1.12, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createSharedFibers(field) {
  const positions = [];
  const colors = [];
  const alphas = [];
  const paths = [
    ...field.getFibers(),
    ...field.getRegionPaths('answer'),
    ...field.getRegionPaths('citation'),
    ...field.getRegionPaths('keyword')
  ];
  const palette = {
    answer: new THREE.Color('#50b3cc'),
    citation: new THREE.Color('#7d9ab8'),
    keyword: new THREE.Color('#2996a8'),
    shared: new THREE.Color('#347e94')
  };
  let segmentCount = 0;

  paths.forEach((path, pathIndex) => {
    const color = palette[path.region] || palette.shared;
    const pointCount = path.points.length;
    for (let index = 0; index < pointCount - 1; index += 1) {
      const visible = (index + pathIndex * 3) % (path.coreSeeking ? 9 : 12)
        < (path.coreSeeking ? 4 : 5);
      if (!visible) continue;
      const a = path.points[index];
      const b = path.points[index + 1];
      const fieldSample = field.sample(a.x, a.y, a.z);
      if (fieldSample.cavity > 0.82) continue;
      positions.push(a.x, a.y, a.z + 0.012, b.x, b.y, b.z + 0.012);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      const alpha = THREE.MathUtils.clamp(
        0.22 + fieldSample.density * 0.52 + fieldSample.attraction * 0.18,
        0.18,
        0.84
      );
      alphas.push(alpha, alpha * 0.88);
      segmentCount += 1;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  const material = createOrganicLineMaterial();
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'GEO V4 Shared Curved Tissue Fibers';
  lines.renderOrder = 1;
  return {
    lines,
    material,
    segmentCount,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createOrganicLineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float pulse = 0.92 + sin(uTime * 0.055 + vAlpha * 8.0) * 0.08;
        float alpha = uOpacity * vAlpha * pulse;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createMembraneNodes(field, texture) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const phases = [];
  const palette = {
    answer: new THREE.Color('#79d9ed'),
    citation: new THREE.Color('#a3b4d8'),
    keyword: new THREE.Color('#3db8c8'),
    shared: new THREE.Color('#397d94')
  };
  let foregroundParticleCount = 0;
  const samples = [
    ...field.getCells().flatMap((cell) => cell.points.filter((_, index) => index % 4 === 0)),
    ...field.getFibers().flatMap((path) => path.points.filter((_, index) => index % 5 === 0))
  ];

  samples.forEach((point, index) => {
    const sample = field.sample(point.x, point.y, point.z);
    if ((index * 7) % 11 > 6) return;
    const color = palette[sample.businessRegion] || palette.shared;
    positions.push(point.x, point.y, point.z + 0.018);
    colors.push(color.r, color.g, color.b);
    sizes.push(0.42 + sample.density * 0.78 + (index % 17 === 0 ? 0.62 : 0));
    phases.push(index * 0.731);
    if (point.z > 0.1) foregroundParticleCount += 1;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  const material = createNodeMaterial(texture);
  const points = new THREE.Points(geometry, material);
  points.name = 'GEO V4 Sparse Shared Membrane Nodes';
  points.renderOrder = 3;
  return {
    points,
    material,
    particleCount: positions.length / 3,
    foregroundParticleCount,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createNodeMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vPulse;
      uniform float uTime;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vPulse = 0.72 + sin(uTime * 0.16 + aPhase) * 0.28;
        gl_PointSize = aSize * (15.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vPulse;
      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a * uOpacity * vPulse;
        if (alpha < 0.008) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}
