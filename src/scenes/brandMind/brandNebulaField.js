import * as THREE from 'three';
import {
  createMindPointsMaterial,
  seededRandom,
  smootherstep
} from './brandCognitionCore.js';

const CLOUD_PARTICLE_COUNT = 240;

const NEBULA_REGIONS = Object.freeze([
  { name: 'Core Rear Memory Nebula', position: [0.04, 0.06, -1.02], scale: [2.55, 1.72], color: '#56368c', opacity: 0.075, phase: 0.2, rotation: 0.03 },
  { name: 'Awareness Cognition Bridge', position: [-0.76, 0.38, -0.48], scale: [1.8, 0.48], color: '#624a9d', opacity: 0.065, phase: 1.1, rotation: -0.3 },
  { name: 'Association Semantic Nebula', position: [1.36, 0.08, -0.12], scale: [2.15, 0.95], color: '#704bb5', opacity: 0.08, phase: 2.2, rotation: 0.12 },
  { name: 'Preference Foreground Memory', position: [0.96, -0.82, 0.6], scale: [1.8, 0.72], color: '#7652b8', opacity: 0.052, phase: 3.5, rotation: -0.28 },
  { name: 'Loyalty Deep Tail', position: [-1.54, -0.9, -0.32], scale: [1.72, 0.5], color: '#4d3c7a', opacity: 0.048, phase: 4.8, rotation: 0.2 }
]);

export function createBrandNebulaField(resources) {
  const group = new THREE.Group();
  const sprites = NEBULA_REGIONS.map((region, index) => createNebulaSprite(region, index, resources));
  const cloud = createCloudParticles(resources.pointTexture);

  group.name = 'Local Semantic Nebula Field';
  sprites.forEach((entry) => group.add(entry.sprite));
  group.add(cloud.points);

  return {
    group,
    regionCount: NEBULA_REGIONS.length,
    particleCount: CLOUD_PARTICLE_COUNT,
    update(time, progress) {
      const reveal = smootherstep(0.1, 0.82, progress);
      const stable = smootherstep(0.88, 1, progress);
      sprites.forEach((entry) => {
        entry.material.opacity = reveal * entry.region.opacity;
        entry.material.rotation = entry.region.rotation + Math.sin(time * 0.016 + entry.region.phase) * 0.014;
        entry.sprite.position.x = entry.baseX + Math.sin(time * 0.014 + entry.region.phase) * 0.01 * stable;
        entry.sprite.position.y = entry.baseY + Math.cos(time * 0.012 + entry.region.phase) * 0.008 * stable;
      });
      cloud.material.uniforms.uOpacity.value = reveal * 0.17;
      cloud.points.rotation.y = Math.sin(time * 0.01) * 0.014 * stable;
    },
    dispose() {
      sprites.forEach((entry) => entry.material.dispose());
      cloud.dispose();
      group.clear();
    }
  };
}

function createNebulaSprite(region, index, resources) {
  const material = new THREE.SpriteMaterial({
    map: resources.hazeTexture,
    color: region.color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const sprite = new THREE.Sprite(material);
  sprite.name = region.name;
  sprite.position.set(...region.position);
  sprite.scale.set(region.scale[0], region.scale[1], 1);
  sprite.renderOrder = index === 3 ? 10 : -2;
  return { sprite, material, region, baseX: region.position[0], baseY: region.position[1] };
}

function createCloudParticles(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(CLOUD_PARTICLE_COUNT * 3);
  const colors = new Float32Array(CLOUD_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(CLOUD_PARTICLE_COUNT);
  const random = seededRandom(14327);
  const regionColors = NEBULA_REGIONS.map((region) => new THREE.Color(region.color));

  for (let index = 0; index < CLOUD_PARTICLE_COUNT; index += 1) {
    const regionIndex = index % NEBULA_REGIONS.length;
    const region = NEBULA_REGIONS[regionIndex];
    const stride = index * 3;
    const angle = random() * Math.PI * 2;
    const radial = Math.pow(random(), 1.6);
    positions[stride] = region.position[0] + Math.cos(angle) * region.scale[0] * 0.34 * radial;
    positions[stride + 1] = region.position[1] + Math.sin(angle) * region.scale[1] * 0.34 * radial;
    positions[stride + 2] = region.position[2] + (random() - 0.5) * 0.52;
    colors[stride] = regionColors[regionIndex].r;
    colors[stride + 1] = regionColors[regionIndex].g;
    colors[stride + 2] = regionColors[regionIndex].b;
    sizes[index] = 0.52 + random() * 0.72;
  }
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createMindPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);
  points.name = 'Semantic Nebula Micro Particles';
  points.renderOrder = -1;
  return {
    points,
    material,
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}
