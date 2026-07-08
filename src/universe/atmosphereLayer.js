import * as THREE from 'three';

const ATMOSPHERE_PARTICLE_COUNT = 340;

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
  const hazeColor = new THREE.Color(0x0d3b68);
  const color = new THREE.Color();

  for (let i = 0; i < ATMOSPHERE_PARTICLE_COUNT; i += 1) {
    const i3 = i * 3;
    const layer = random();
    const width = 20 + layer * 32;
    const height = 10 + layer * 18;

    positions[i3] = (random() - 0.5) * width + Math.sin(layer * Math.PI * 4) * 1.5;
    positions[i3 + 1] = 0.9 + (random() - 0.5) * height;
    positions[i3 + 2] = -4.5 - Math.pow(random(), 0.68) * 42;

    color.copy(baseColor).lerp(hazeColor, random() * 0.58);
    const depthFade = 0.16 + layer * 0.36;
    colors[i3] = color.r * depthFade;
    colors[i3 + 1] = color.g * depthFade;
    colors[i3 + 2] = color.b * depthFade;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 2.15,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.14,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'ActiveTheoryAtmosphereLayer';
  points.position.set(0, 0.55, -3.4);

  function update(delta, time) {
    points.rotation.y += delta * 0.0045;
    points.rotation.x = Math.sin(time * 0.014) * 0.012;
    points.rotation.z = Math.sin(time * 0.021) * 0.016;
    points.position.x = Math.sin(time * 0.014) * 0.5;
    points.position.z = -3.4 + Math.sin(time * 0.01) * 1;
    material.opacity = 0.12 + Math.sin(time * 0.046) * 0.018;
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
