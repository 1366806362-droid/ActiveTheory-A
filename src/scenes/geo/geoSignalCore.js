import * as THREE from 'three';

const INNER_PARTICLE_COUNT = 620;
const SHELL_PARTICLE_COUNT = 280;
const MICRO_PARTICLE_COUNT = 260;
const INTERNAL_DISK_PARTICLE_COUNT = 480;
const PROCESSING_SECTOR_PARTICLE_COUNT = 180;
const CORE_RESPONSE_PARTICLE_COUNT = 144;

export function createGeoVisualResources() {
  const pointTexture = createRadialTexture(96, [
    [0, 'rgba(255,255,255,1)'],
    [0.18, 'rgba(222,250,255,0.96)'],
    [0.5, 'rgba(92,206,255,0.42)'],
    [1, 'rgba(0,0,0,0)']
  ]);
  const hazeTexture = createHazeTexture();

  return {
    pointTexture,
    hazeTexture,
    dispose() {
      pointTexture.dispose();
      hazeTexture.dispose();
    }
  };
}

export function createGeoSignalCore(resources, visualProfile = null) {
  const coreProfile = visualProfile?.core ?? {
    scale: 1,
    semanticFieldParticles: 0,
    pulseArcCount: 3,
    labelScale: 1,
    labelOpacity: 0.72
  };
  const group = new THREE.Group();
  const contrastBuffer = createCoreContrastBuffer(resources.hazeTexture);
  const inner = createInnerSignalCore(resources.pointTexture);
  const internalDisk = createInternalSignalDisk(resources.pointTexture);
  const processingSectors = createProcessingSectors(resources.pointTexture);
  const entryResponses = createCoreEntryResponses(resources.pointTexture);
  const shell = createSignalShell(resources.pointTexture);
  const semanticField = coreProfile.semanticFieldParticles > 0
    ? createSemanticProcessingField(resources.pointTexture, coreProfile.semanticFieldParticles)
    : null;
  const pulses = createSemanticPulses(coreProfile.pulseArcCount);
  const micro = createCoreMicroParticles(resources.pointTexture);
  const label = createLabelSprite(
    'GEO SIGNAL CORE',
    'GEO \u4fe1\u53f7\u6838\u5fc3',
    '#8fe9ff',
    1.2 * coreProfile.labelScale,
    visualProfile?.cinematic === true,
    visualProfile?.cinematic === true
      ? { titleAlpha: 0.78, subtitleAlpha: 0.32, glowBlur: 3.4 }
      : null
  );
  const glowMaterial = new THREE.SpriteMaterial({
    map: resources.pointTexture,
    color: '#47cfff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const glow = new THREE.Sprite(glowMaterial);

  group.name = 'GEO SIGNAL CORE';
  glow.name = 'GEO Core Restrained Glow';
  glow.scale.set(1.38, 1.38, 1);
  glow.renderOrder = -1;
  label.sprite.position.set(0, visualProfile?.cinematic ? -0.405 : -0.62, 0.08);
  group.add(
    contrastBuffer.sprite,
    glow,
    shell.points,
    pulses.lines,
    internalDisk.points,
    processingSectors.group,
    entryResponses.points,
    inner.points,
    micro.points
  );
  if (semanticField) group.add(semanticField.points);
  group.add(label.sprite);
  let debugVisuals = true;
  let debugLabel = true;
  let debugLayer = 'full';

  return {
    group,
    particleCount: INNER_PARTICLE_COUNT
      + SHELL_PARTICLE_COUNT
      + MICRO_PARTICLE_COUNT
      + INTERNAL_DISK_PARTICLE_COUNT
      + PROCESSING_SECTOR_PARTICLE_COUNT
      + CORE_RESPONSE_PARTICLE_COUNT
      + coreProfile.semanticFieldParticles,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugVisibility();
    },
    setDebugVisibility(showVisuals, showLabel) {
      debugVisuals = showVisuals;
      debugLabel = showLabel;
      applyDebugVisibility();
    },
    update(time, progress) {
      const wake = smootherstep(0, 0.16, progress);
      const shellReveal = smootherstep(0.68, 0.96, progress);
      const pulseReveal = smootherstep(0.72, 0.98, progress);
      const stable = smootherstep(0.78, 0.96, progress);
      const labelReveal = smootherstep(0.84, 0.99, progress);
      const microMotion = smootherstep(0.08, 0.86, progress);
      const signalDriven = smootherstep(0.42, 0.9, progress);
      const volumeComplete = smootherstep(0.62, 0.92, progress);
      const diskWake = smootherstep(0.055, 0.3, progress);
      const restrainedFlicker = stable * (0.97 + Math.sin(time * 0.71) * 0.03);

      const baseScale = lerp(0.62, 0.86, wake) + volumeComplete * 0.14;
      const cinematicScale = visualProfile?.cinematic
        ? lerp(0.84, coreProfile.scale, volumeComplete)
        : 1;
      group.scale.setScalar(baseScale * cinematicScale);
      inner.material.uniforms.uOpacity.value = wake * (0.456 + signalDriven * 0.079 + restrainedFlicker * 0.015);
      contrastBuffer.material.opacity = diskWake * (visualProfile?.cinematic ? 0.09 : 0);
      shell.material.uniforms.uOpacity.value = shellReveal * (visualProfile?.cinematic ? 0.09 : 0.225);
      shell.points.rotation.y = time * 0.021 * stable;
      shell.points.rotation.z = -time * 0.013 * stable;
      pulses.material.opacity = pulseReveal * (visualProfile?.cinematic ? 0.375 : 0.18);
      pulses.lines.rotation.y = time * 0.012 * stable;
      pulses.lines.scale.setScalar(lerp(0.78, 1, pulseReveal));
      internalDisk.material.uniforms.uOpacity.value = visualProfile?.cinematic
        ? diskWake * 0.3 + volumeComplete * 0.58
        : volumeComplete * 0.22;
      internalDisk.material.uniforms.uScale.value = visualProfile?.cinematic ? 2.1 : 1;
      internalDisk.points.rotation.y = time * 0.045 * stable;
      internalDisk.points.rotation.z = -0.14 + Math.sin(time * 0.018) * 0.025 * stable;
      processingSectors.update(time, progress, stable);
      entryResponses.update(time, progress, stable);
      micro.material.uniforms.uProgress.value = microMotion;
      micro.material.uniforms.uTime.value = time;
      micro.material.uniforms.uOpacity.value = wake * (0.19 + signalDriven * 0.06);
      if (semanticField) {
        semanticField.material.uniforms.uOpacity.value = shellReveal * (0.075 + signalDriven * 0.035);
        semanticField.points.rotation.y = time * 0.015 * stable;
        semanticField.points.rotation.x = Math.sin(time * 0.012) * 0.025 * stable;
      }
      glowMaterial.opacity = stable * (visualProfile?.cinematic ? 0.022 : 0.042);
      glow.scale.setScalar(1.34 + stable * 0.06);
      label.material.opacity = labelReveal * coreProfile.labelOpacity;

      return wake * (0.72 + stable * 0.28);
    },
    dispose() {
      inner.dispose();
      contrastBuffer.dispose();
      internalDisk.dispose();
      processingSectors.dispose();
      entryResponses.dispose();
      shell.dispose();
      semanticField?.dispose();
      pulses.dispose();
      micro.dispose();
      label.dispose();
      glowMaterial.dispose();
      group.clear();
    }
  };

  function applyDebugVisibility() {
    const full = debugLayer === 'full' || debugLayer === 'hidden-label';
    inner.points.visible = debugVisuals && (full || debugLayer === 'seed');
    internalDisk.points.visible = debugVisuals && (full || debugLayer === 'disk');
    processingSectors.group.visible = debugVisuals && (full || debugLayer === 'sectors');
    pulses.lines.visible = debugVisuals && (full || debugLayer === 'fragments');
    entryResponses.points.visible = debugVisuals && full;
    contrastBuffer.sprite.visible = debugVisuals && full;
    shell.points.visible = debugVisuals && full;
    if (semanticField) semanticField.points.visible = debugVisuals && full;
    micro.points.visible = debugVisuals && full;
    glow.visible = debugVisuals && full;
    label.sprite.visible = debugLabel && debugLayer === 'full';
  }
}

export function createSignalPointsMaterial(texture, opacity = 1) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: opacity },
      uPointTexture: { value: texture },
      uScale: { value: 1 }
    },
    vertexShader: `
      uniform float uScale;
      attribute float aSize;
      varying vec3 vColor;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        gl_PointSize = aSize * uScale * (13.5 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;

      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}

export function createLabelSprite(title, subtitle, color, width = 1.2, highDensity = false, style = null) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const density = highDensity ? 1.5 : 1;

  canvas.width = 1024 * density;
  canvas.height = 256 * density;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.scale(density, density);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = color;
  context.shadowBlur = style?.glowBlur ?? 5;
  context.globalAlpha = style?.titleAlpha ?? 0.94;
  context.fillStyle = '#d8f5ff';
  context.font = '600 56px Arial, sans-serif';
  context.fillText(title, 512, subtitle ? 86 : 124);
  if (subtitle) {
    context.shadowBlur = 2;
    context.globalAlpha = style?.subtitleAlpha ?? 0.68;
    context.fillStyle = color;
    context.font = '400 36px Arial, sans-serif';
    context.fillText(subtitle, 512, 174);
  }
  context.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false
  });
  const sprite = new THREE.Sprite(material);

  sprite.scale.set(width, width * 0.25, 1);
  sprite.renderOrder = 20;

  return {
    sprite,
    material,
    texture,
    dispose() {
      texture.dispose();
      material.dispose();
    }
  };
}

function createInnerSignalCore(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(INNER_PARTICLE_COUNT * 3);
  const colors = new Float32Array(INNER_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(INNER_PARTICLE_COUNT);
  const random = seededRandom(104729);
  const centerColor = new THREE.Color('#dcf9ff');
  const edgeColor = new THREE.Color('#62d9ff');
  const color = new THREE.Color();

  for (let index = 0; index < INNER_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const radiusRatio = Math.pow(random(), 2.35);
    const radius = 0.26 * radiusRatio;
    const azimuth = random() * Math.PI * 2;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);

    positions[stride] = Math.cos(azimuth) * sine * radius;
    positions[stride + 1] = cosine * radius * 0.84;
    positions[stride + 2] = Math.sin(azimuth) * sine * radius;
    color.copy(centerColor).lerp(edgeColor, radiusRatio * 0.88);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 37 === 0 ? 2.05 : index % 7 === 0 ? 1.38 : 0.78;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'Inner Signal Core';
  points.renderOrder = 5;
  return disposablePoints(points, geometry, material);
}

function createInternalSignalDisk(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(INTERNAL_DISK_PARTICLE_COUNT * 3);
  const colors = new Float32Array(INTERNAL_DISK_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(INTERNAL_DISK_PARTICLE_COUNT);
  const random = seededRandom(118147);
  const ice = new THREE.Color('#82eaff');
  const blue = new THREE.Color('#087da9');
  const color = new THREE.Color();

  const laneRadii = [0.3, 0.44, 0.58];
  const laneInclinations = [-0.18, 0.08, 0.24];
  const laneFragments = [
    [
      { start: -0.42, length: 1.06 },
      { start: 1.1, length: 0.74 },
      { start: 2.46, length: 0.92 },
      { start: 4.28, length: 0.72 }
    ],
    [
      { start: 0.12, length: 0.82 },
      { start: 1.46, length: 0.96 },
      { start: 3.04, length: 0.66 },
      { start: 4.52, length: 0.84 }
    ],
    [
      { start: -0.2, length: 0.68 },
      { start: 1.18, length: 0.7 },
      { start: 2.64, length: 0.88 },
      { start: 4.18, length: 0.58 }
    ]
  ];

  for (let index = 0; index < INTERNAL_DISK_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const lane = index % 3;
    const fragments = laneFragments[lane];
    const fragment = fragments[Math.floor(index / 3) % fragments.length];
    const angle = fragment.start + random() * fragment.length;
    const radius = laneRadii[lane] + (random() - 0.5) * (0.04 + lane * 0.014);
    const thickness = (random() - 0.5) * (0.05 + lane * 0.018);
    const inclination = laneInclinations[lane];

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = Math.sin(angle) * radius * (0.2 + lane * 0.025) + thickness * 0.32;
    positions[stride + 2] = Math.sin(angle) * radius * inclination + thickness;
    color.copy(ice).lerp(blue, 0.12 + lane * 0.17 + random() * 0.28);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 43 === 0 ? 1.45 : 0.56 + random() * 0.46;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'Internal Rotating Signal Disk';
  points.rotation.x = 0.12;
  points.rotation.z = -0.08;
  points.renderOrder = 8;
  material.depthTest = false;
  return disposablePoints(points, geometry, material);
}

function createProcessingSectors(texture) {
  const particleGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(PROCESSING_SECTOR_PARTICLE_COUNT * 3);
  const colors = new Float32Array(PROCESSING_SECTOR_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(PROCESSING_SECTOR_PARTICLE_COUNT);
  const sectors = new Float32Array(PROCESSING_SECTOR_PARTICLE_COUNT);
  const random = seededRandom(119633);
  const sectorDefinitions = [
    { angle: 2.56, span: 0.52, color: new THREE.Color('#9beaff'), depth: 0.04 },
    { angle: 0.56, span: 0.44, color: new THREE.Color('#d7ddf4'), depth: -0.04 },
    { angle: -0.58, span: 0.48, color: new THREE.Color('#63e3df'), depth: 0.08 }
  ];
  const centerColor = new THREE.Color('#e7fbff');
  const color = new THREE.Color();

  for (let index = 0; index < PROCESSING_SECTOR_PARTICLE_COUNT; index += 1) {
    const sector = index % 3;
    const definition = sectorDefinitions[sector];
    const stride = index * 3;
    const radialRatio = Math.pow(random(), 0.72);
    const radius = 0.39 + radialRatio * 0.2;
    const angle = definition.angle + (random() - 0.5) * definition.span;
    const depth = definition.depth + (random() - 0.5) * 0.12;

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = Math.sin(angle) * radius * 0.31 + (random() - 0.5) * 0.035;
    positions[stride + 2] = depth + Math.sin(angle * 1.4) * 0.07;
    color.copy(definition.color).lerp(centerColor, (1 - radialRatio) * 0.38);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 29 === 0 ? 1.72 : 0.7 + random() * 0.58;
    sectors[index] = sector;
  }

  particleGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  particleGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  particleGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  particleGeometry.setAttribute('aSector', new THREE.BufferAttribute(sectors, 1));
  const particleMaterial = createSectorMaterial(texture, true);
  const points = new THREE.Points(particleGeometry, particleMaterial);
  const arcLayer = createProcessingSectorArcs(sectorDefinitions);
  const group = new THREE.Group();

  points.name = 'Three Processing Sector Particles';
  points.renderOrder = 9;
  group.name = 'Three Processing Sectors';
  group.add(points, arcLayer.lines);

  return {
    group,
    update(time, progress, stable) {
      const answer = smootherstep(0.42, 0.62, progress);
      const citation = smootherstep(0.5, 0.7, progress);
      const keyword = smootherstep(0.58, 0.78, progress);
      for (const material of [particleMaterial, arcLayer.material]) {
        material.uniforms.uAnswer.value = answer;
        material.uniforms.uCitation.value = citation;
        material.uniforms.uKeyword.value = keyword;
        material.uniforms.uStable.value = stable;
        material.uniforms.uTime.value = time;
      }
      group.rotation.z = Math.sin(time * 0.018) * 0.008 * stable;
    },
    dispose() {
      particleGeometry.dispose();
      particleMaterial.dispose();
      arcLayer.dispose();
      group.clear();
    }
  };
}

function createSectorMaterial(texture, points) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uAnswer: { value: 0 },
      uCitation: { value: 0 },
      uKeyword: { value: 0 },
      uStable: { value: 0 },
      uTime: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSector;
      ${points ? 'attribute float aSize;' : ''}
      uniform float uAnswer;
      uniform float uCitation;
      uniform float uKeyword;
      uniform float uStable;
      uniform float uTime;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float reveal = aSector < 0.5 ? uAnswer : aSector < 1.5 ? uCitation : uKeyword;
        float current = 0.76 + sin(uTime * 0.8 + aSector * 2.3) * 0.08 * uStable;
        vColor = color;
        vAlpha = reveal * current;
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        ${points ? 'gl_PointSize = aSize * (18.0 / max(-viewPosition.z, 1.0));' : ''}
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        float alpha = vAlpha * ${points ? 'texture2D(uPointTexture, gl_PointCoord).a * 0.72' : '0.52'};
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

function createProcessingSectorArcs(definitions) {
  const positions = [];
  const colors = [];
  const sectors = [];

  definitions.forEach((definition, sector) => {
    for (let fragment = 0; fragment < 2; fragment += 1) {
      const radius = 0.43 + sector * 0.04 + fragment * 0.075;
      const length = definition.span * (fragment === 0 ? 0.72 : 0.46);
      const start = definition.angle - length * (fragment === 0 ? 0.62 : -0.02);
      const segments = fragment === 0 ? 13 : 8;
      for (let index = 0; index < segments; index += 1) {
        if (index % 5 === 3) continue;
        const t0 = index / segments;
        const t1 = (index + 0.68) / segments;
        for (const t of [t0, t1]) {
          const angle = start + length * t;
          positions.push(
            Math.cos(angle) * radius,
            Math.sin(angle) * radius * 0.31,
            definition.depth + Math.sin(angle * 1.4) * 0.07
          );
          colors.push(definition.color.r, definition.color.g, definition.color.b);
          sectors.push(sector);
        }
      }
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aSector', new THREE.Float32BufferAttribute(sectors, 1));
  const material = createSectorMaterial(null, false);
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'Three Broken Processing Sector Arcs';
  lines.renderOrder = 9;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createCoreContrastBuffer(texture) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: '#020b18',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);

  sprite.name = 'GEO Core Contrast Buffer';
  sprite.position.z = -0.28;
  sprite.scale.set(1.34, 0.84, 1);
  sprite.renderOrder = 1;
  return {
    sprite,
    material,
    dispose() {
      material.dispose();
    }
  };
}

function createCoreEntryResponses(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(CORE_RESPONSE_PARTICLE_COUNT * 3);
  const colors = new Float32Array(CORE_RESPONSE_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(CORE_RESPONSE_PARTICLE_COUNT);
  const entries = new Float32Array(CORE_RESPONSE_PARTICLE_COUNT);
  const pathProgress = new Float32Array(CORE_RESPONSE_PARTICLE_COUNT);
  const random = seededRandom(121577);
  const entryColors = [
    new THREE.Color('#bdefff'),
    new THREE.Color('#cfd3e8'),
    new THREE.Color('#7ee9ea')
  ];
  const entryAngles = [2.56, 0.56, -0.58];
  const perEntry = CORE_RESPONSE_PARTICLE_COUNT / 3;

  for (let index = 0; index < CORE_RESPONSE_PARTICLE_COUNT; index += 1) {
    const entry = Math.floor(index / perEntry);
    const localIndex = index % perEntry;
    const t = localIndex / (perEntry - 1);
    const eased = entry === 1
      ? smootherstep(0.06, 0.94, t) * smootherstep(0, 1, t)
      : t * t * (3 - 2 * t);
    const radius = lerp(0.62, 0.12, eased);
    const transitTurn = entry === 0
      ? 0.38 * Math.sin(t * Math.PI)
      : entry === 1
        ? -0.16 * Math.sin(t * Math.PI) * smootherstep(0.28, 0.72, t)
        : 0.22 * Math.sin(t * Math.PI) * smootherstep(0.12, 0.86, t);
    const angle = entryAngles[entry] + transitTurn;
    const stride = index * 3;

    positions[stride] = Math.cos(angle) * radius + (random() - 0.5) * 0.018;
    positions[stride + 1] = Math.sin(angle) * radius * 0.34 + (random() - 0.5) * 0.018;
    positions[stride + 2] = (entry - 1) * 0.035 + Math.sin(angle * 1.4) * 0.07 + (random() - 0.5) * 0.018;
    colors[stride] = entryColors[entry].r;
    colors[stride + 1] = entryColors[entry].g;
    colors[stride + 2] = entryColors[entry].b;
    sizes[index] = entry === 2 && localIndex % 7 === 0
      ? 2.28
      : localIndex % 11 === 0
        ? 2.05
        : 0.94 + random() * 0.68;
    entries[index] = entry;
    pathProgress[index] = t;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aEntry', new THREE.BufferAttribute(entries, 1));
  geometry.setAttribute('aPathProgress', new THREE.BufferAttribute(pathProgress, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0.92 },
      uResponseAnswer: { value: 0 },
      uResponseCitation: { value: 0 },
      uResponseKeyword: { value: 0 },
      uStable: { value: 0 },
      uTime: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aEntry;
      attribute float aPathProgress;
      varying vec3 vColor;
      varying float vEntry;
      varying float vPathProgress;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vEntry = aEntry;
        vPathProgress = aPathProgress;
        gl_PointSize = aSize * (24.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform float uResponseAnswer;
      uniform float uResponseCitation;
      uniform float uResponseKeyword;
      uniform float uStable;
      uniform float uTime;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vEntry;
      varying float vPathProgress;

      void main() {
        float response = vEntry < 0.5
          ? uResponseAnswer
          : vEntry < 1.5
            ? uResponseCitation
            : uResponseKeyword;
        float entryTuning = vEntry < 0.5 ? 0.0 : vEntry < 1.5 ? -0.035 : 0.025;
        float tunedResponse = clamp(response + entryTuning, 0.0, 1.0);
        float head = smoothstep(tunedResponse - 0.2, tunedResponse - 0.045, vPathProgress)
          * (1.0 - smoothstep(tunedResponse + 0.015, tunedResponse + 0.15, vPathProgress));
        float citationHold = vEntry > 0.5 && vEntry < 1.5
          ? smoothstep(0.38, 0.5, tunedResponse) * (1.0 - smoothstep(0.56, 0.68, tunedResponse)) * 0.2
          : 0.0;
        float keywordSteps = vEntry > 1.5
          ? 0.82 + step(0.34, vPathProgress) * 0.08 + step(0.66, vPathProgress) * 0.1
          : 1.0;
        float trail = smoothstep(0.0, tunedResponse, vPathProgress) * 0.18;
        float stableFlow = uStable * (0.065 + sin(uTime * 1.1 + vPathProgress * 18.0) * 0.02);
        float alpha = texture2D(uPointTexture, gl_PointCoord).a;
        alpha *= uOpacity * keywordSteps * max(head + citationHold, trail + stableFlow);
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
  const points = new THREE.Points(geometry, material);

  points.name = 'GEO Core Local Data Responses';
  points.rotation.x = 0.12;
  points.rotation.z = -0.08;
  points.renderOrder = 7;
  return {
    points,
    material,
    update(time, progress, stable) {
      material.uniforms.uResponseAnswer.value = smootherstep(0.46, 0.66, progress);
      material.uniforms.uResponseCitation.value = smootherstep(0.55, 0.76, progress);
      material.uniforms.uResponseKeyword.value = smootherstep(0.64, 0.84, progress);
      material.uniforms.uStable.value = stable;
      material.uniforms.uTime.value = time;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createSignalShell(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(SHELL_PARTICLE_COUNT * 3);
  const colors = new Float32Array(SHELL_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(SHELL_PARTICLE_COUNT);
  const random = seededRandom(130363);
  const cyan = new THREE.Color('#62d8ef');
  const blue = new THREE.Color('#2d88ca');
  const color = new THREE.Color();
  const fragments = [
    { azimuth: -0.42, elevation: 0.12, spread: 0.58 },
    { azimuth: 1.3, elevation: -0.24, spread: 0.44 },
    { azimuth: 3.08, elevation: 0.3, spread: 0.52 },
    { azimuth: 4.7, elevation: -0.08, spread: 0.4 }
  ];

  for (let written = 0; written < SHELL_PARTICLE_COUNT; written += 1) {
    const fragment = fragments[written % fragments.length];
    const azimuth = fragment.azimuth + (random() - 0.5) * fragment.spread;
    const elevation = fragment.elevation + (random() - 0.5) * fragment.spread * 0.72;
    const radius = 0.6 + random() * 0.075;
    const stride = written * 3;
    positions[stride] = Math.cos(elevation) * Math.cos(azimuth) * radius;
    positions[stride + 1] = Math.sin(elevation) * radius * 0.9;
    positions[stride + 2] = Math.cos(elevation) * Math.sin(azimuth) * radius;
    color.copy(cyan).lerp(blue, random() * 0.68);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[written] = 0.7 + random() * 0.8;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'Incomplete Signal Shell';
  points.renderOrder = 3;
  return disposablePoints(points, geometry, material);
}

function createSemanticProcessingField(texture, count) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const random = seededRandom(141907);
  const ice = new THREE.Color('#d7f8ff');
  const cyan = new THREE.Color('#2b9fd8');
  const color = new THREE.Color();
  const fragments = [
    [-0.72, 0.22, 0.16],
    [-0.2, 0.63, -0.2],
    [0.5, 0.44, 0.24],
    [0.7, -0.24, -0.12],
    [-0.36, -0.62, 0.08]
  ];

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const fragment = fragments[index % fragments.length];
    const spread = 0.11 + random() * 0.2;
    const radial = Math.pow(random(), 1.5) * spread;
    const angle = random() * Math.PI * 2;
    positions[stride] = fragment[0] + Math.cos(angle) * radial;
    positions[stride + 1] = fragment[1] + Math.sin(angle) * radial * 0.62;
    positions[stride + 2] = fragment[2] + (random() - 0.5) * 0.3;
    color.copy(ice).lerp(cyan, 0.3 + random() * 0.58);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 47 === 0 ? 1.85 : 0.48 + random() * 0.72;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'Broken Semantic Processing Field';
  points.renderOrder = 3;
  return disposablePoints(points, geometry, material);
}

function createSemanticPulses(arcCount = 3) {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  const definitions = [
    { radius: 0.44, start: 2.28, length: 0.68, tilt: 0.1 },
    { radius: 0.52, start: 0.24, length: 0.54, tilt: -0.14 },
    { radius: 0.6, start: 5.12, length: 0.58, tilt: 0.18 },
    { radius: 0.5, start: 3.56, length: 0.46, tilt: -0.18 },
    { radius: 0.65, start: 1.32, length: 0.38, tilt: 0.12 }
  ].slice(0, arcCount);

  definitions.forEach((definition, layerIndex) => {
    const segments = 34 - layerIndex * 5;
    for (let index = 0; index < segments; index += 1) {
      if ((index + layerIndex) % 7 === 4 || index % 11 === 8) continue;
      const t0 = index / segments;
      const t1 = (index + 0.72) / segments;
      appendPulseVertex(positions, definition, t0);
      appendPulseVertex(positions, definition, t1);
    }
  });

  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: '#76dcff',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(geometry, material);

  lines.name = 'Output Processing Fragments';
  lines.rotation.x = 0.08;
  lines.rotation.z = -0.08;
  lines.renderOrder = 8;
  return {
    lines,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createCoreMicroParticles(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(MICRO_PARTICLE_COUNT * 3);
  const colors = new Float32Array(MICRO_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(MICRO_PARTICLE_COUNT);
  const phases = new Float32Array(MICRO_PARTICLE_COUNT);
  const random = seededRandom(155921);
  const cold = new THREE.Color('#c8f8ff');
  const blue = new THREE.Color('#3ebfe8');
  const color = new THREE.Color();

  for (let index = 0; index < MICRO_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const angle = random() * Math.PI * 2;
    let radius = 0.12 + random() * 0.68;
    if (radius > 0.18 && radius < 0.34 && index % 4 === 0) {
      radius = index % 8 === 0
        ? 0.12 + random() * 0.055
        : 0.38 + random() * 0.16;
    }
    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = (random() - 0.5) * 0.36;
    positions[stride + 2] = Math.sin(angle) * radius + (random() - 0.5) * 0.28;
    color.copy(cold).lerp(blue, random() * 0.72);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = index % 31 === 0 ? 1.66 : 0.62 + random() * 0.4;
    phases[index] = random() * Math.PI * 2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      uniform float uProgress;
      uniform float uTime;
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;

      void main() {
        float gather = mix(0.22, 1.0, uProgress);
        vec3 animated = position * gather;
        float stable = smoothstep(0.88, 1.0, uProgress);
        float orbit = uTime * 0.22 * stable + aPhase;
        animated.x += sin(orbit) * 0.018 * stable;
        animated.y += cos(orbit * 1.31) * 0.012 * stable;
        vec4 viewPosition = modelViewMatrix * vec4(animated, 1.0);
        vColor = color;
        gl_PointSize = aSize * (12.5 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;

      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a;
        if (alpha < 0.012) discard;
        gl_FragColor = vec4(vColor, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'Core Micro Particles';
  points.renderOrder = 6;
  return disposablePoints(points, geometry, material);
}

function appendPulseVertex(positions, definition, t, radialOffset = 0) {
  const angle = definition.start + definition.length * t;
  const radius = definition.radius * (1 + Math.sin(t * Math.PI * 3) * 0.025) + radialOffset;
  positions.push(
    Math.cos(angle) * radius,
    Math.sin(angle) * radius * 0.42 + definition.tilt * 0.16,
    Math.sin(angle * 1.3) * 0.12 + definition.tilt * 0.2
  );
}

function disposablePoints(points, geometry, material) {
  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createRadialTexture(size, stops) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  canvas.width = size;
  canvas.height = size;
  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function createHazeTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 256;

  canvas.width = size;
  canvas.height = size;
  context.clearRect(0, 0, size, size);
  const lobes = [
    [128, 125, 118, 'rgba(42,168,220,0.18)'],
    [92, 142, 72, 'rgba(31,104,178,0.13)'],
    [166, 102, 58, 'rgba(93,189,225,0.09)']
  ];
  lobes.forEach(([x, y, radius, color]) => {
    const gradient = context.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.45, color.replace(/0\.\d+\)/, '0.06)'));
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, size, size);
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function seededRandom(seed) {
  let value = seed >>> 0;
  return function random() {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

export function smootherstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / Math.max(edge1 - edge0, 0.0001), 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function lerp(start, end, value) {
  return start + (end - start) * value;
}
