import * as THREE from 'three';
import {
  createSignalPointsMaterial,
  seededRandom,
  smootherstep
} from './geoSignalCore.js';

const CLOUD_PARTICLE_COUNT = 220;

const NEBULA_REGIONS = Object.freeze([
  { name: 'Core Rear Nebula', position: [0.1, 0.05, -1], scale: [2.55, 1.55], color: '#0b79a4', opacity: 0.064, phase: 0.2, rotation: 0.02 },
  { name: 'Answer Connection Nebula', position: [0.66, -0.11, -0.18], scale: [1.92, 0.46], color: '#168fbd', opacity: 0.058, phase: 1.1, rotation: -0.24 },
  { name: 'Citation Connection Nebula', position: [-0.48, 0.16, -0.62], scale: [1.72, 0.42], color: '#185582', opacity: 0.043, phase: 2.4, rotation: 0.18 },
  { name: 'Keyword Deep Tail Nebula', position: [0.72, 0.78, -0.42], scale: [1.86, 0.48], color: '#078f9d', opacity: 0.066, phase: 3.6, rotation: 0.32 },
  { name: 'Foreground Broken Signal Mist', position: [0.85, -0.5, 0.82], scale: [1.42, 0.42], color: '#1b87a7', opacity: 0.021, phase: 4.8, rotation: -0.38 }
]);

export function createGeoNebulaField(resources) {
  const group = new THREE.Group();
  const sprites = NEBULA_REGIONS.map((region, index) => createNebulaSprite(region, index, resources));
  const cloud = createCloudParticles(resources.pointTexture);

  group.name = 'GEO Local Nebula Field';
  sprites.forEach((sprite) => group.add(sprite.sprite));
  group.add(cloud.points);

  return {
    group,
    regionCount: NEBULA_REGIONS.length,
    particleCount: CLOUD_PARTICLE_COUNT,
    update(time, progress) {
      const reveal = smootherstep(0.12, 0.82, progress);
      const stable = smootherstep(0.86, 1, progress);

      sprites.forEach(({ sprite, material, region, baseX, baseY }) => {
        material.opacity = reveal * region.opacity;
        material.rotation = region.rotation + Math.sin(time * 0.018 + region.phase) * 0.018;
        sprite.position.x = baseX + Math.sin(time * 0.017 + region.phase) * 0.012 * stable;
        sprite.position.y = baseY + Math.cos(time * 0.014 + region.phase) * 0.008 * stable;
      });
      cloud.material.uniforms.uOpacity.value = reveal * 0.14;
      cloud.points.rotation.y = Math.sin(time * 0.012) * 0.018 * stable;
    },
    dispose() {
      sprites.forEach(({ material }) => material.dispose());
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
  sprite.renderOrder = index === NEBULA_REGIONS.length - 1 ? 9 : -2;
  return {
    sprite,
    material,
    region,
    baseX: region.position[0],
    baseY: region.position[1]
  };
}

function createCloudParticles(texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(CLOUD_PARTICLE_COUNT * 3);
  const colors = new Float32Array(CLOUD_PARTICLE_COUNT * 3);
  const sizes = new Float32Array(CLOUD_PARTICLE_COUNT);
  const random = seededRandom(6719);
  const colorsByRegion = NEBULA_REGIONS.map((region) => new THREE.Color(region.color));

  for (let index = 0; index < CLOUD_PARTICLE_COUNT; index += 1) {
    const regionIndex = index % NEBULA_REGIONS.length;
    const region = NEBULA_REGIONS[regionIndex];
    const stride = index * 3;
    const angle = random() * Math.PI * 2;
    const radial = Math.pow(random(), 1.65);
    positions[stride] = region.position[0]
      + Math.cos(angle) * region.scale[0] * 0.34 * radial;
    positions[stride + 1] = region.position[1]
      + Math.sin(angle) * region.scale[1] * 0.34 * radial;
    positions[stride + 2] = region.position[2] + (random() - 0.5) * 0.48;
    colors[stride] = colorsByRegion[regionIndex].r;
    colors[stride + 1] = colorsByRegion[regionIndex].g;
    colors[stride + 2] = colorsByRegion[regionIndex].b;
    sizes[index] = 0.55 + random() * 0.75;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const material = createSignalPointsMaterial(texture, 0);
  const points = new THREE.Points(geometry, material);

  points.name = 'GEO Nebula Micro Particles';
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
