import * as THREE from 'three';

const ATMOSPHERE_PARTICLE_COUNT = 180;

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1103515245 + 12345) % 2147483648;
    return value / 2147483648;
  };
}

export function createAtmosphereLayer() {
  const random = seededRandom(9072026);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(ATMOSPHERE_PARTICLE_COUNT * 3);
  const colors = new Float32Array(ATMOSPHERE_PARTICLE_COUNT * 3);
  const baseColor = new THREE.Color(0x031126);
  const hazeColor = new THREE.Color(0x0b3157);
  const color = new THREE.Color();

  for (let i = 0; i < ATMOSPHERE_PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const layer = random();
    const width = 16 + layer * 18;
    const height = 8 + layer * 10;

    positions[i3] = (random() - 0.5) * width;
    positions[i3 + 1] = 0.8 + (random() - 0.5) * height;
    positions[i3 + 2] = -4 - random() * 24;

    color.copy(baseColor).lerp(hazeColor, random() * 0.45);
    const depthFade = 0.18 + layer * 0.28;
    colors[i3] = color.r * depthFade;
    colors[i3 + 1] = color.g * depthFade;
    colors[i3 + 2] = color.b * depthFade;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 1.45,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.13,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'ActiveTheoryAtmosphereLayer';
  points.position.set(0, 0.4, -2);

  function update(delta, time) {
    points.rotation.y += delta * 0.006;
    points.rotation.z = Math.sin(time * 0.025) * 0.018;
    points.position.x = Math.sin(time * 0.018) * 0.42;
    material.opacity = 0.105 + Math.sin(time * 0.06) * 0.018;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    points,
    update,
    dispose
  };
}

export const atmosphereLayerManager = {
  createAtmosphereLayer
};
