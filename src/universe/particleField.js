import * as THREE from 'three';

const LAYERS = [
  {
    name: 'near',
    count: 52,
    width: 18,
    height: 10,
    zMin: 1.6,
    zMax: 8,
    size: 0.046,
    opacity: 0.1,
    speed: 0.006,
    interaction: 0.42,
    fieldRadius: 3.4,
    gravity: 0.72,
    recover: 4.6,
    trailForce: 2.4,
    drag: 5.2
  },
  {
    name: 'mid',
    count: 300,
    width: 24,
    height: 13,
    zMin: -16,
    zMax: 2,
    size: 0.02,
    opacity: 0.12,
    speed: 0.014,
    interaction: 0.22,
    fieldRadius: 5.2,
    gravity: 0.34,
    recover: 3.4,
    trailForce: 1.15,
    drag: 4.2
  },
  {
    name: 'far',
    count: 2200,
    width: 68,
    height: 36,
    zMin: -44,
    zMax: -14,
    size: 0.0055,
    opacity: 0.08,
    speed: 0.01,
    interaction: 0.08,
    fieldRadius: 7.4,
    gravity: 0.12,
    recover: 2.4,
    trailForce: 0.34,
    drag: 3.5
  }
];

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export function createParticleField() {
  const group = new THREE.Group();
  const layers = LAYERS.map((layer, index) => createParticleLayer(layer, 20260707 + index * 101));
  const count = layers.reduce((total, layer) => total + layer.count, 0);

  group.name = 'ActiveTheoryParticleField';

  layers.forEach((layer) => {
    group.add(layer.points);
  });

  function update(delta, time, interaction) {
    layers.forEach((layer, index) => {
      layer.update(delta, time, interaction, index);
    });
  }

  function dispose() {
    layers.forEach((layer) => {
      layer.dispose();
    });
  }

  return {
    group,
    points: group,
    count,
    update,
    dispose
  };
}

function createParticleLayer(layer, seed) {
  const random = seededRandom(seed);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(layer.count * 3);
  const basePositions = new Float32Array(layer.count * 3);
  const offsets = new Float32Array(layer.count * 3);
  const velocities = new Float32Array(layer.count * 3);
  const colors = new Float32Array(layer.count * 3);
  const phases = new Float32Array(layer.count);
  const color = new THREE.Color();
  const baseColor = new THREE.Color(0x102b4c);
  const accentColor = new THREE.Color(0x00ccff);
  const hazeColor = new THREE.Color(0x4f7fa8);
  const particleTexture = createSoftParticleTexture();

  for (let i = 0; i < layer.count; i += 1) {
    const i3 = i * 3;
    const depth = random();
    const cluster = layer.name === 'mid' ? Math.pow(random(), 3.1) : Math.pow(random(), 4.6);
    const spread = layer.name === 'far' ? 0.96 + random() * 0.72 : 0.5 + random() * 0.65;
    const x = (random() - 0.5) * layer.width * spread;
    const y = (random() - 0.5) * layer.height * spread;

    positions[i3] = x + Math.sin(depth * Math.PI * 7) * cluster * (layer.name === 'mid' ? 2.0 : 1.55);
    positions[i3 + 1] = y + Math.cos(depth * Math.PI * 5) * cluster * (layer.name === 'mid' ? 1.0 : 0.8);
    positions[i3 + 2] = layer.zMin + random() * (layer.zMax - layer.zMin);
    basePositions[i3] = positions[i3];
    basePositions[i3 + 1] = positions[i3 + 1];
    basePositions[i3 + 2] = positions[i3 + 2];
    phases[i] = random() * Math.PI * 2;

    color.copy(baseColor).lerp(hazeColor, random() * 0.3);

    if (layer.name === 'near' && random() > 0.9) {
      color.lerp(accentColor, 0.28 + random() * 0.24);
    } else if (random() > 0.94) {
      color.lerp(accentColor, 0.12 + random() * 0.14);
    }

    const depthFade = layer.name === 'far' ? 0.045 + depth * 0.085 : layer.name === 'near' ? 0.18 + depth * 0.3 : 0.1 + depth * 0.18;
    colors[i3] = color.r * depthFade;
    colors[i3 + 1] = color.g * depthFade;
    colors[i3 + 2] = color.b * depthFade;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: layer.size,
    sizeAttenuation: true,
    map: particleTexture,
    vertexColors: true,
    transparent: true,
    opacity: layer.opacity,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.position.set(0, 1.2, -5);
  points.rotation.set(-0.08, 0.08, 0.03);

  function update(delta, time, interaction, index) {
    const influenceX = interaction?.parallaxX ?? 0;
    const influenceY = interaction?.parallaxY ?? 0;
    const influenceStrength = interaction?.strength ?? 0;
    const active = interaction?.active ?? 0;
    const trailX = interaction?.trailX;
    const trailY = interaction?.trailY;
    const trailLife = interaction?.trailLife;
    const trailLength = interaction?.trailLength ?? 0;
    const fieldX = influenceX * layer.width * 0.2;
    const fieldY = influenceY * layer.height * 0.18;
    const fieldPower = layer.interaction * layer.gravity * active * (0.42 + influenceStrength * 0.58);
    const fieldRadius = layer.fieldRadius;
    const fieldRadiusSq = fieldRadius * fieldRadius;
    const positionAttribute = geometry.attributes.position;
    const positionArray = positionAttribute.array;
    const offsetFollow = damping(8.5, delta);
    const recoverFollow = damping(layer.recover, delta);
    const drag = Math.exp(-layer.drag * delta);

    points.rotation.y += delta * layer.speed;
    points.rotation.x = -0.08 + Math.sin(time * (0.06 + index * 0.02)) * 0.014 + influenceY * layer.interaction * 0.035;
    points.rotation.z = 0.03 + Math.sin(time * (0.045 + index * 0.012)) * 0.012 + influenceX * layer.interaction * 0.055;
    points.position.x = Math.sin(time * (0.035 + index * 0.01)) * 0.24 + influenceX * layer.interaction * 0.38;
    points.position.y = 1.2 + Math.sin(time * (0.028 + index * 0.008)) * 0.1 + influenceY * layer.interaction * 0.2;
    points.position.z = -5 + Math.sin(time * (0.022 + index * 0.006)) * (0.45 + index * 0.18);
    material.opacity = layer.opacity + active * layer.interaction * 0.025;

    for (let i = 0; i < layer.count; i += 1) {
      const i3 = i * 3;
      const baseX = basePositions[i3];
      const baseY = basePositions[i3 + 1];
      const baseZ = basePositions[i3 + 2];
      const currentX = baseX + offsets[i3];
      const currentY = baseY + offsets[i3 + 1];
      const dx = fieldX - currentX;
      const dy = fieldY - currentY;
      const distanceSq = dx * dx + dy * dy;
      const falloff = Math.max(0, 1 - distanceSq / fieldRadiusSq);
      const field = falloff * falloff * fieldPower;
      const swirl = time * (0.42 + index * 0.12) + phases[i];
      const distance = Math.sqrt(distanceSq) + 0.0001;
      const attractX = (dx / distance) * field * 0.72;
      const attractY = (dy / distance) * field * 0.46;
      const attractZ = Math.sin(swirl * 0.72) * field * 0.82;
      const swirlX = Math.sin(swirl + dy * 0.14) * field * 0.24;
      const swirlY = Math.cos(swirl + dx * 0.12) * field * 0.2;
      const targetOffsetX = attractX + swirlX;
      const targetOffsetY = attractY + swirlY;
      const targetOffsetZ = attractZ;
      let trailForceX = 0;
      let trailForceY = 0;
      let trailForceZ = 0;
      let maxTrailField = 0;

      offsets[i3] += (targetOffsetX - offsets[i3]) * offsetFollow;
      offsets[i3 + 1] += (targetOffsetY - offsets[i3 + 1]) * offsetFollow;
      offsets[i3 + 2] += (targetOffsetZ - offsets[i3 + 2]) * offsetFollow;

      for (let j = 0; j < trailLength; j += 1) {
        const life = trailLife[j];

        if (life < 0.01) {
          continue;
        }

        const trailFieldX = trailX[j] * layer.width * 0.22;
        const trailFieldY = trailY[j] * layer.height * 0.2;
        const trailDx = trailFieldX - currentX;
        const trailDy = trailFieldY - currentY;
        const trailDistanceSq = trailDx * trailDx + trailDy * trailDy;
        const trailFalloff = Math.max(0, 1 - trailDistanceSq / fieldRadiusSq);
        const trailField = trailFalloff * trailFalloff * life * layer.trailForce;

        if (trailField <= 0) {
          continue;
        }

        const trailDistance = Math.sqrt(trailDistanceSq) + 0.0001;
        const trailSwirl = phases[i] + time * (0.26 + index * 0.08) + j * 0.37;

        maxTrailField = Math.max(maxTrailField, trailField);
        trailForceX += (trailDx / trailDistance) * trailField * 0.34 + Math.sin(trailSwirl) * trailField * 0.12;
        trailForceY += (trailDy / trailDistance) * trailField * 0.22 + Math.cos(trailSwirl) * trailField * 0.1;
        trailForceZ += Math.sin(trailSwirl * 0.76) * trailField * 0.42;
      }

      velocities[i3] = velocities[i3] * drag + trailForceX * delta;
      velocities[i3 + 1] = velocities[i3 + 1] * drag + trailForceY * delta;
      velocities[i3 + 2] = velocities[i3 + 2] * drag + trailForceZ * delta;
      offsets[i3] += velocities[i3];
      offsets[i3 + 1] += velocities[i3 + 1];
      offsets[i3 + 2] += velocities[i3 + 2];

      if (active < 0.02 || (field < 0.0001 && maxTrailField < 0.0001)) {
        offsets[i3] += (0 - offsets[i3]) * recoverFollow;
        offsets[i3 + 1] += (0 - offsets[i3 + 1]) * recoverFollow;
        offsets[i3 + 2] += (0 - offsets[i3 + 2]) * recoverFollow;
      }

      positionArray[i3] = baseX + offsets[i3];
      positionArray[i3 + 1] = baseY + offsets[i3 + 1];
      positionArray[i3 + 2] = baseZ + offsets[i3 + 2];
    }

    positionAttribute.needsUpdate = true;
  }

  function damping(speed, delta) {
    return 1 - Math.exp(-speed * delta);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
    particleTexture.dispose();
  }

  return {
    points,
    count: layer.count,
    update,
    dispose
  };
}

function createSoftParticleTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 64;
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(255,255,255,0.82)');
  gradient.addColorStop(0.22, 'rgba(190,245,255,0.48)');
  gradient.addColorStop(0.55, 'rgba(88,202,255,0.14)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.needsUpdate = true;

  return texture;
}

export const particleFieldManager = {
  createParticleField
};
