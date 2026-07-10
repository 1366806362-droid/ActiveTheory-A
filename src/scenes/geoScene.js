import * as THREE from 'three';
import {
  createEnergyPlanet,
  createEnergyPlanetResources
} from '../universe/energyPlanet.js';

const CORE_POSITION = { x: 0.14, y: 0.04, z: 0 };
const ORBIT_SEGMENTS = 128;
const STAR_COUNT = 280;
const RING_PARTICLE_COUNT = 140;
const GEO_DEBUG = Object.freeze({
  showInternalPlanets: readDebugFlag('showInternalPlanets', true),
  showInternalOrbits: readDebugFlag('showInternalOrbits', true),
  showLabels: readDebugFlag('showLabels', true)
});

const PLANET_CONFIGS = [
  {
    name: 'AI ANSWER',
    color: '#8fd8ff',
    coreColor: '#e3fbff',
    radius: 1.06,
    size: 0.16,
    tiltX: 0.24,
    tiltZ: -0.22,
    speed: 0.028,
    phase: -0.58,
    verticalOffset: -0.3,
    labelY: -0.34,
    wireColor: '#bcefff',
    atmosphereColor: '#8fd8ff',
    glowColor: '#4ebdff',
    particleCount: 72,
    rotationSpeed: 0.16,
    pulseSpeed: 0.55,
    intensity: 0.88,
    seed: 2101
  },
  {
    name: 'AI CITATION',
    color: '#8f8cff',
    coreColor: '#f0efff',
    radius: 0.96,
    size: 0.15,
    tiltX: -0.28,
    tiltZ: 0.18,
    speed: -0.024,
    phase: 2.75,
    verticalOffset: 0.18,
    labelY: 0.33,
    wireColor: '#aaa4ff',
    atmosphereColor: '#9d7dff',
    glowColor: '#6655dd',
    particleCount: 58,
    rotationSpeed: 0.13,
    pulseSpeed: 0.48,
    intensity: 0.76,
    seed: 3109
  },
  {
    name: 'GEO KEYWORD',
    color: '#42f1df',
    coreColor: '#d9fff9',
    radius: 1.16,
    size: 0.145,
    tiltX: 0.48,
    tiltZ: -0.16,
    speed: 0.02,
    phase: -1,
    verticalOffset: 0.38,
    labelY: 0.32,
    wireColor: '#8ffff1',
    atmosphereColor: '#38daca',
    glowColor: '#1faeae',
    particleCount: 64,
    rotationSpeed: 0.14,
    pulseSpeed: 0.51,
    intensity: 0.8,
    seed: 4111
  }
];

export function createGeoScene() {
  const group = new THREE.Group();
  const background = createBackground();
  const energyResources = createEnergyPlanetResources();
  const core = createGeoCore(energyResources);
  const planets = PLANET_CONFIGS.map((config, index) => (
    createBusinessPlanet(config, index, energyResources)
  ));
  let revealProgress = 0;

  group.name = 'GeoScene';
  group.add(background.group, core.group);
  planets.forEach((planet) => group.add(planet.orbitGroup));
  core.setDebugVisibility(GEO_DEBUG.showInternalPlanets, GEO_DEBUG.showLabels);
  planets.forEach((planet) => planet.setDebugVisibility(
    GEO_DEBUG.showInternalPlanets,
    GEO_DEBUG.showInternalOrbits,
    GEO_DEBUG.showLabels
  ));

  function update(renderState, delta, time, galaxyOpenProgress = 1, journeyProgress = 1) {
    revealProgress = galaxyOpenProgress;
    energyResources.timeUniform.value = time;

    const backgroundReveal = smootherstep(0.52, 0.78, journeyProgress);
    const coreReveal = smootherstep(0.25, 0.76, revealProgress);
    const orbitReveal = smootherstep(0.08, 0.62, revealProgress);
    const labelReveal = smootherstep(0.78, 0.96, revealProgress);
    const coreLayers = createRevealLayers(revealProgress, 0.25, 0.76);
    const corePulse = 1 + Math.sin(time * 0.82) * 0.018;
    const compactViewport = window.innerWidth < 700;
    const sceneScale = compactViewport ? 0.6 : 0.92;

    group.position.set(
      lerp(0.08, compactViewport ? -0.52 : -0.08, coreReveal),
      lerp(-0.08, 0, coreReveal),
      lerp(-2.1, compactViewport ? -1.15 : -0.62, smootherstep(0.2, 0.82, revealProgress))
    );
    group.scale.setScalar(
      lerp(0.72, 1, smootherstep(0.2, 0.82, revealProgress)) * sceneScale
    );
    group.rotation.y = Math.sin(time * 0.035) * 0.018;

    background.update(delta, time, backgroundReveal);
    core.update(delta, time, coreLayers, labelReveal, corePulse);
    planets.forEach((planet, index) => {
      const starts = [0.53, 0.62, 0.7];
      const ends = [0.86, 0.94, 1];
      const planetLayers = createRevealLayers(
        revealProgress,
        starts[index],
        ends[index]
      );
      const planetReveal = planetLayers.core;
      const planetLabelReveal = smootherstep(
        starts[index] + 0.24,
        ends[index],
        revealProgress
      );

      planet.update(
        delta,
        time,
        orbitReveal,
        planetLayers,
        planetLabelReveal * labelReveal
      );
    });

    renderState.exposure += coreReveal * 0.025;
  }

  function dispose() {
    background.dispose();
    core.dispose();
    planets.forEach((planet) => planet.dispose());
    energyResources.dispose();
    group.clear();
  }

  return {
    name: 'GeoScene',
    group,
    update,
    dispose
  };
}

function createBackground() {
  const group = new THREE.Group();
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(STAR_COUNT * 3);
  const starSizes = new Float32Array(STAR_COUNT);
  const glowTexture = createGlowTexture('#4aaeff');
  const hazeTexture = createHazeTexture();
  const deepSpace = createGeoDeepSpace();
  const depthParticles = createDepthParticles(glowTexture);

  for (let index = 0; index < STAR_COUNT; index += 1) {
    const stride = index * 3;
    const angle = index * 2.399963 + Math.sin(index * 0.37) * 0.38;
    const radius = 3.4 + pseudoRandom(index * 7.13) * 7.2;

    starPositions[stride] = Math.cos(angle) * radius;
    starPositions[stride + 1] = (pseudoRandom(index * 11.7) - 0.5) * 6.8;
    starPositions[stride + 2] = -2.4 - pseudoRandom(index * 5.91) * 7.6;
    starSizes[index] = 0.7 + pseudoRandom(index * 3.17) * 1.3;
  }

  starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(starSizes, 1));

  const starMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color('#8cc8ff') },
      uPointTexture: { value: glowTexture }
    },
    vertexShader: `
      attribute float aSize;
      varying float vDepth;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vDepth = clamp((-viewPosition.z - 3.0) / 10.0, 0.0, 1.0);
        gl_PointSize = aSize * (54.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform vec3 uColor;
      uniform sampler2D uPointTexture;
      varying float vDepth;

      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a;
        gl_FragColor = vec4(uColor, alpha * uOpacity * mix(0.8, 0.28, vDepth));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  const hazeMaterialA = new THREE.SpriteMaterial({
    map: hazeTexture,
    color: '#0b4b86',
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const hazeMaterialB = hazeMaterialA.clone();
  const hazeA = new THREE.Sprite(hazeMaterialA);
  const hazeB = new THREE.Sprite(hazeMaterialB);

  hazeMaterialB.color.set('#192860');
  deepSpace.mesh.renderOrder = -10;
  hazeA.renderOrder = -8;
  hazeB.renderOrder = -8;
  stars.renderOrder = -4;
  hazeA.position.set(-2.2, 0.8, -4.8);
  hazeA.scale.set(6.5, 4.2, 1);
  hazeB.position.set(3.2, -1.1, -6.5);
  hazeB.scale.set(7.2, 4.6, 1);
  group.add(deepSpace.mesh, hazeA, hazeB, stars, depthParticles.group);

  return {
    group,
    update(delta, time, reveal) {
      starMaterial.uniforms.uOpacity.value = reveal * 0.3;
      hazeMaterialA.opacity = reveal * 0.1;
      hazeMaterialB.opacity = reveal * 0.075;
      stars.rotation.y = time * 0.003;
      hazeA.material.rotation = time * 0.002;
      hazeB.material.rotation = -time * 0.0015;
      deepSpace.update(time, reveal);
      depthParticles.update(delta, time, reveal);
    },
    dispose() {
      starGeometry.dispose();
      starMaterial.dispose();
      hazeMaterialA.dispose();
      hazeMaterialB.dispose();
      deepSpace.dispose();
      depthParticles.dispose();
      glowTexture.dispose();
      hazeTexture.dispose();
      group.clear();
    }
  };
}

function createGeoDeepSpace() {
  const geometry = new THREE.SphereGeometry(18, 28, 18);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uDeep: { value: new THREE.Color('#031329') },
      uBlue: { value: new THREE.Color('#07527a') },
      uCyan: { value: new THREE.Color('#087788') },
      uViolet: { value: new THREE.Color('#332a6e') }
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
      uniform vec3 uViolet;
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
          mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
          mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y),
          f.z
        );
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float largeCloud = noise(direction * 2.7 + vec3(uTime * 0.003, 0.0, -uTime * 0.002));
        float detail = noise(direction * 6.4 - vec3(0.0, uTime * 0.004, 0.0));
        float nebula = smoothstep(0.42, 0.82, largeCloud * 0.72 + detail * 0.28);
        float horizon = smoothstep(-0.7, 0.8, direction.y);
        vec3 color = mix(uDeep, uBlue, nebula * 0.7);
        color = mix(color, uCyan, nebula * nebula * 0.24);
        color = mix(color, uViolet, (1.0 - horizon) * nebula * 0.25);
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  return {
    mesh,
    update(time, reveal) {
      material.uniforms.uTime.value = time;
      material.uniforms.uOpacity.value = reveal * 0.78;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createDepthParticles(texture) {
  const group = new THREE.Group();
  const mid = createParticleLayer(72, 4.8, 3.2, -3.8, 0.03, texture, '#4ebee8', 1931);
  const near = createParticleLayer(22, 3.8, 2.5, -1.2, 0.075, texture, '#82eaff', 4079, true);

  group.add(mid.points, near.points);

  return {
    group,
    update(delta, time, reveal) {
      const passage = Math.sin(smootherstep(0.18, 0.78, reveal) * Math.PI);

      mid.points.rotation.y = -time * 0.006;
      mid.points.position.x = -reveal * 0.16;
      mid.material.opacity = reveal * 0.12;
      near.points.position.z = lerp(-1.4, 0.7, reveal);
      near.points.position.x = reveal * 0.22;
      near.points.rotation.z += delta * 0.012;
      near.material.opacity = passage * 0.13;
    },
    dispose() {
      mid.dispose();
      near.dispose();
      group.clear();
    }
  };
}

function createParticleLayer(count, width, height, depth, size, texture, color, seed, edgeWeighted = false) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const side = index % 2 === 0 ? -1 : 1;
    const horizontal = edgeWeighted
      ? side * (width * 0.28 + pseudoRandom(seed + index * 2.13) * width * 0.22)
      : (pseudoRandom(seed + index * 2.13) - 0.5) * width;

    positions[stride] = horizontal;
    positions[stride + 1] = (pseudoRandom(seed + index * 4.27) - 0.5) * height;
    positions[stride + 2] = depth + pseudoRandom(seed + index * 6.71) * 3.2;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    color,
    size,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);

  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createGeoCore(resources) {
  const group = new THREE.Group();
  const energy = createEnergyPlanet({
    name: 'GeoSignalEnergyPlanet',
    radius: 0.5,
    coreColor: '#bcefff',
    wireColor: '#63d7ff',
    atmosphereColor: '#3bcde8',
    glowColor: '#167fb2',
    particleCount: 214,
    rotationSpeed: 0.11,
    pulseSpeed: 0.42,
    intensity: 1,
    seed: 1103
  }, resources);
  const wireLayers = energy.group.children.filter((child) => child.isLineSegments);
  const glowTexture = createGlowTexture('#7ee8ff');
  const ring = createCoreParticleRing(glowTexture);
  const label = createLabelSprite('GEO SIGNAL CORE', 'GEO \u4fe1\u53f7\u6838\u5fc3', '#9be8ff', 1.88);

  group.name = 'GeoSignalCore';
  group.position.set(CORE_POSITION.x, CORE_POSITION.y, CORE_POSITION.z);
  label.sprite.scale.set(1.56, 0.39, 1);
  label.sprite.position.set(0, -0.67, 0.08);
  group.add(energy.group, ring.group, label.sprite);

  return {
    group,
    setDebugVisibility(showPlanet, showLabel) {
      energy.group.visible = showPlanet;
      ring.group.visible = showPlanet;
      label.sprite.visible = showLabel;
    },
    update(delta, time, revealLayers, labelReveal, pulse) {
      group.scale.setScalar(lerp(0.38, 0.84, revealLayers.core));
      energy.update(time, revealLayers);
      // Preserve the three wire layers while allowing the interior energy to read first.
      if (wireLayers[1]) wireLayers[1].material.opacity *= 0.82;
      if (wireLayers[2]) wireLayers[2].material.opacity *= 0.52;
      ring.update(time, revealLayers.glow);
      label.material.opacity = labelReveal * 0.88;
    },
    dispose() {
      energy.dispose();
      glowTexture.dispose();
      ring.dispose();
      label.dispose();
      group.clear();
    }
  };
}

function createBusinessPlanet(config, index, resources) {
  const orbitGroup = new THREE.Group();
  const planetGroup = new THREE.Group();
  const energy = createEnergyPlanet({
    name: `${config.name} Energy Planet`,
    radius: config.size,
    coreColor: config.coreColor,
    wireColor: config.wireColor,
    atmosphereColor: config.atmosphereColor,
    glowColor: config.glowColor,
    particleCount: config.particleCount,
    rotationSpeed: config.rotationSpeed,
    pulseSpeed: config.pulseSpeed,
    intensity: config.intensity,
    seed: config.seed
  }, resources);
  const label = createLabelSprite(config.name, '', config.color, 1.14);
  const orbit = createOrbit(config);
  const connection = createConnection(config.color);
  let angle = config.phase;

  orbitGroup.name = `${config.name} Orbit`;
  orbitGroup.position.set(CORE_POSITION.x, CORE_POSITION.y, CORE_POSITION.z);
  orbitGroup.rotation.x = config.tiltX;
  orbitGroup.rotation.z = config.tiltZ;
  label.sprite.scale.set(0.92, 0.23, 1);
  label.sprite.position.set(0, config.labelY, 0.05);
  planetGroup.add(energy.group, label.sprite);
  orbitGroup.add(orbit.line, connection.line, planetGroup);

  return {
    orbitGroup,
    setDebugVisibility(showPlanet, showOrbit, showLabel) {
      planetGroup.visible = showPlanet;
      orbit.line.visible = showOrbit;
      connection.line.visible = showOrbit;
      label.sprite.visible = showLabel;
    },
    update(delta, time, orbitReveal, revealLayers, labelReveal) {
      const reveal = revealLayers.core;
      const entranceAngle = config.phase - (1 - reveal) * (0.42 + index * 0.1);

      angle += delta * config.speed;
      const activeAngle = lerp(entranceAngle, angle, reveal);
      const radius = config.radius * lerp(0.16, 1, reveal);
      const x = Math.cos(activeAngle) * radius;
      const z = Math.sin(activeAngle) * radius;

      planetGroup.position.set(x, config.verticalOffset, z);
      planetGroup.scale.setScalar(lerp(0.18, 1, reveal));
      energy.update(time, revealLayers);
      label.material.opacity = labelReveal * 0.9;
      orbit.geometry.setDrawRange(0, Math.max(2, Math.floor(ORBIT_SEGMENTS * orbitReveal)));
      orbit.material.opacity = orbitReveal * 0.085;
      connection.positions[3] = x;
      connection.positions[4] = config.verticalOffset;
      connection.positions[5] = z;
      connection.geometry.attributes.position.needsUpdate = true;
      connection.material.opacity = labelReveal * 0.045;
    },
    dispose() {
      energy.dispose();
      orbit.dispose();
      connection.dispose();
      label.dispose();
      orbitGroup.clear();
    }
  };
}

function createOrbit(config) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array((ORBIT_SEGMENTS + 1) * 3);

  for (let index = 0; index <= ORBIT_SEGMENTS; index += 1) {
    const angle = index / ORBIT_SEGMENTS * Math.PI * 2;
    const stride = index * 3;
    positions[stride] = Math.cos(angle) * config.radius;
    positions[stride + 1] = Math.sin(angle * 3 + config.phase) * 0.018;
    positions[stride + 2] = Math.sin(angle) * config.radius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setDrawRange(0, 0);
  const material = new THREE.LineBasicMaterial({
    color: config.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const line = new THREE.Line(geometry, material);

  return {
    line,
    geometry,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createConnection(color) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(6);
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const line = new THREE.Line(geometry, material);

  return {
    line,
    geometry,
    material,
    positions,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createCoreParticleRing(texture) {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(RING_PARTICLE_COUNT * 3);

  for (let index = 0; index < RING_PARTICLE_COUNT; index += 1) {
    const angle = index / RING_PARTICLE_COUNT * Math.PI * 2;
    const radius = 0.68 + (pseudoRandom(index * 2.71) - 0.5) * 0.1;
    const stride = index * 3;

    positions[stride] = Math.cos(angle) * radius;
    positions[stride + 1] = (pseudoRandom(index * 4.37) - 0.5) * 0.08;
    positions[stride + 2] = Math.sin(angle) * radius;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    color: '#78e6ff',
    size: 0.029,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);

  group.rotation.x = 0.46;
  group.rotation.z = -0.25;
  group.add(points);

  return {
    group,
    update(time, reveal) {
      group.rotation.y = time * 0.07;
      points.rotation.y = -time * 0.035;
      material.opacity = reveal * 0.44;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      group.clear();
    }
  };
}

function createLabelSprite(title, subtitle, color, width) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  canvas.width = 512;
  canvas.height = 128;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.shadowColor = color;
  context.shadowBlur = 8;
  context.fillStyle = '#dff8ff';
  context.font = '600 31px Arial, sans-serif';
  context.fillText(title, 256, subtitle ? 43 : 63);

  if (subtitle) {
    context.shadowBlur = 6;
    context.fillStyle = color;
    context.font = '400 22px Arial, sans-serif';
    context.fillText(subtitle, 256, 87);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
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
    dispose() {
      texture.dispose();
      material.dispose();
    }
  };
}

function createGlowTexture(color) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 128;
  const gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, '#ffffff');
  gradient.addColorStop(0.18, color);
  gradient.addColorStop(0.52, `${color}55`);
  gradient.addColorStop(1, `${color}00`);
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function createHazeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(128, 128, 0, 128, 128, 128);
  gradient.addColorStop(0, 'rgba(72, 160, 255, 0.34)');
  gradient.addColorStop(0.38, 'rgba(38, 92, 174, 0.18)');
  gradient.addColorStop(0.72, 'rgba(25, 47, 112, 0.06)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 256, 256);

  return new THREE.CanvasTexture(canvas);
}

function smootherstep(edge0, edge1, value) {
  const x = clamp((value - edge0) / (edge1 - edge0), 0, 1);

  return x * x * x * (x * (x * 6 - 15) + 10);
}

function pseudoRandom(seed) {
  return Math.abs(Math.sin(seed * 12.9898 + 78.233) * 43758.5453) % 1;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(start, end, value) {
  return start + (end - start) * value;
}

function createRevealLayers(progress, start, end) {
  const duration = Math.max(end - start, 0.001);

  return {
    core: smootherstep(start, start + duration * 0.52, progress),
    wire: smootherstep(start + duration * 0.2, start + duration * 0.74, progress),
    atmosphere: smootherstep(start + duration * 0.44, start + duration * 0.9, progress),
    glow: smootherstep(start + duration * 0.64, end, progress)
  };
}

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);

  if (!params.has(name)) {
    return fallback;
  }

  return params.get(name) !== '0' && params.get(name) !== 'false';
}

export const geoSceneManager = {
  createGeoScene
};
