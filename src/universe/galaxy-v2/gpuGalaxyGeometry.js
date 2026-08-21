import * as THREE from 'three';
import {
  GPU_GALAXY_V2_ARM_PROFILES,
  GPU_GALAXY_V2_DUST_FIELD
} from './galaxyV2Config.js';

const TAU = Math.PI * 2;
const ARM_PROFILES = GPU_GALAXY_V2_ARM_PROFILES;
const STAR_COLORS = Object.freeze({
  coreWhite: new THREE.Color(0.98, 0.92, 0.8),
  coreGold: new THREE.Color(0.84, 0.64, 0.42),
  warmNeutral: new THREE.Color(0.85, 0.79, 0.69),
  neutral: new THREE.Color(0.75, 0.8, 0.86),
  cold: new THREE.Color(0.48, 0.61, 0.78),
  halo: new THREE.Color(0.23, 0.31, 0.42)
});

export function createGpuGalaxyGeometry(config) {
  if (config.mode === 'support-stars') {
    return createSupportStarsGeometry(config);
  }

  const random = seededRandom(2874107);
  const stars = createStarAttributes(config.starCount);
  const dust = createDustAttributes(config.dustCount);
  let starIndex = 0;

  for (let index = 0; index < config.coreStarCount; index += 1) {
    writeCoreStar(stars, starIndex, config, random);
    starIndex += 1;
  }
  for (let index = 0; index < config.armStarCount; index += 1) {
    writeArmStar(stars, starIndex, index, config, random);
    starIndex += 1;
  }
  for (let index = 0; index < config.haloStarCount; index += 1) {
    writeHaloStar(stars, starIndex, config, random);
    starIndex += 1;
  }
  for (let index = 0; index < config.dustCount; index += 1) {
    writeDustParticle(dust, index, config, random);
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars.positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(stars.colors, 3));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(stars.sizes, 1));
  starGeometry.setAttribute('aLuminosity', new THREE.BufferAttribute(stars.luminosities, 1));
  starGeometry.setAttribute('aSeed', new THREE.BufferAttribute(stars.seeds, 1));
  starGeometry.setAttribute('aRadius', new THREE.BufferAttribute(stars.radii, 1));
  starGeometry.setAttribute('aType', new THREE.BufferAttribute(stars.types, 1));
  starGeometry.setAttribute('aDustAttenuation', new THREE.BufferAttribute(stars.dustAttenuation, 1));
  starGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.55);

  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust.positions, 3));
  dustGeometry.setAttribute('aSize', new THREE.BufferAttribute(dust.sizes, 1));
  dustGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(dust.opacities, 1));
  dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(dust.seeds, 1));
  dustGeometry.setAttribute('aRadius', new THREE.BufferAttribute(dust.radii, 1));
  dustGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.55);

  return {
    starGeometry,
    dustGeometry,
    counts: Object.freeze({
      core: config.coreStarCount,
      arms: config.armStarCount,
      halo: config.haloStarCount,
      dust: config.dustCount,
      total: config.particleCount
    })
  };
}

function createSupportStarsGeometry(config) {
  const random = seededRandom(4302197);
  const stars = createStarAttributes(config.starCount);
  const dust = createDustAttributes(config.dustCount);
  const layers = [
    { id: 'far', count: config.farStarCount, zMin: -0.035, zMax: -0.012, sizeMin: 0.08, sizeMax: 0.22, luminosityMin: 0.004, luminosityMax: 0.018, brightCount: 4 },
    { id: 'mid', count: config.midStarCount, zMin: 0.025, zMax: 0.075, sizeMin: 0.18, sizeMax: 0.46, luminosityMin: 0.018, luminosityMax: 0.075, brightCount: 8 },
    { id: 'near', count: config.nearStarCount, zMin: 0.14, zMax: 0.28, sizeMin: 0.34, sizeMax: 0.78, luminosityMin: 0.035, luminosityMax: 0.13, brightCount: 12 }
  ];
  let starIndex = 0;

  for (const layer of layers) {
    for (let index = 0; index < layer.count; index += 1) {
      writeSupportStar(stars, starIndex, index, layer, random);
      starIndex += 1;
    }
  }
  for (let index = 0; index < config.dustCount; index += 1) {
    writeSupportDust(dust, index, random);
  }

  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.BufferAttribute(stars.positions, 3));
  starGeometry.setAttribute('color', new THREE.BufferAttribute(stars.colors, 3));
  starGeometry.setAttribute('aSize', new THREE.BufferAttribute(stars.sizes, 1));
  starGeometry.setAttribute('aLuminosity', new THREE.BufferAttribute(stars.luminosities, 1));
  starGeometry.setAttribute('aSeed', new THREE.BufferAttribute(stars.seeds, 1));
  starGeometry.setAttribute('aRadius', new THREE.BufferAttribute(stars.radii, 1));
  starGeometry.setAttribute('aType', new THREE.BufferAttribute(stars.types, 1));
  starGeometry.setAttribute('aDustAttenuation', new THREE.BufferAttribute(stars.dustAttenuation, 1));
  starGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.55);

  const dustGeometry = new THREE.BufferGeometry();
  dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust.positions, 3));
  dustGeometry.setAttribute('aSize', new THREE.BufferAttribute(dust.sizes, 1));
  dustGeometry.setAttribute('aOpacity', new THREE.BufferAttribute(dust.opacities, 1));
  dustGeometry.setAttribute('aSeed', new THREE.BufferAttribute(dust.seeds, 1));
  dustGeometry.setAttribute('aRadius', new THREE.BufferAttribute(dust.radii, 1));
  dustGeometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1.55);

  return {
    starGeometry,
    dustGeometry,
    counts: Object.freeze({
      far: config.farStarCount,
      mid: config.midStarCount,
      near: config.nearStarCount,
      dust: config.dustCount,
      total: config.particleCount
    })
  };
}

const SUPPORT_PATCHES = Object.freeze([
  Object.freeze({ x: -0.7, y: 0.28, spreadX: 0.2, spreadY: 0.12 }),
  Object.freeze({ x: -0.22, y: -0.4, spreadX: 0.25, spreadY: 0.11 }),
  Object.freeze({ x: -0.08, y: 0.43, spreadX: 0.3, spreadY: 0.1 }),
  Object.freeze({ x: 0.46, y: 0.38, spreadX: 0.25, spreadY: 0.12 }),
  Object.freeze({ x: 0.72, y: -0.34, spreadX: 0.24, spreadY: 0.13 }),
  Object.freeze({ x: 1.02, y: 0.08, spreadX: 0.16, spreadY: 0.19 })
]);

function writeSupportStar(attributes, index, layerIndex, layer, random) {
  const point = sampleSupportPoint(random, layer.id === 'near' ? 0.7 : 1);
  const depthMix = random();
  const bright = layerIndex < layer.brightCount;
  const color = new THREE.Color().lerpColors(
    STAR_COLORS.neutral,
    STAR_COLORS.cold,
    0.38 + random() * 0.42
  );
  const size = bright
    ? 0.92 + random() * 0.42
    : mix(layer.sizeMin, layer.sizeMax, Math.pow(random(), 1.35));
  const luminosity = bright
    ? 0.22 + random() * 0.12
    : mix(layer.luminosityMin, layer.luminosityMax, Math.pow(random(), 1.8));

  writeStar(attributes, index, {
    x: point.x,
    y: point.y,
    z: mix(layer.zMin, layer.zMax, depthMix),
    color,
    size,
    luminosity,
    seed: random(),
    radius: Math.hypot(point.x, point.y),
    type: bright ? 1 : layer.id === 'near' ? 0 : 2,
    dustAttenuation: 0
  });
}

function writeSupportDust(attributes, index, random) {
  const point = sampleSupportPoint(random, 1.25);
  const stride = index * 3;
  attributes.positions[stride] = point.x;
  attributes.positions[stride + 1] = point.y;
  attributes.positions[stride + 2] = mix(-0.03, 0.09, random());
  attributes.sizes[index] = 0.65 + random() * 1.15;
  attributes.opacities[index] = 0.003 + random() * 0.009;
  attributes.seeds[index] = random();
  attributes.radii[index] = Math.hypot(point.x, point.y);
}

function sampleSupportPoint(random, spreadScale) {
  const patch = SUPPORT_PATCHES[Math.floor(random() * SUPPORT_PATCHES.length)];
  let x = patch.x + gaussian(random) * patch.spreadX * spreadScale;
  let y = patch.y + gaussian(random) * patch.spreadY * spreadScale;

  if (Math.pow((x - 0.28) / 0.3, 2) + Math.pow(y / 0.2, 2) < 1) {
    y += (y < 0 ? -1 : 1) * (0.2 + random() * 0.13);
  }
  x = clamp(x, -1.08, 1.22);
  y = clamp(y, -0.66, 0.66);
  return { x, y };
}

function createStarAttributes(count) {
  return {
    positions: new Float32Array(count * 3),
    colors: new Float32Array(count * 3),
    sizes: new Float32Array(count),
    luminosities: new Float32Array(count),
    seeds: new Float32Array(count),
    radii: new Float32Array(count),
    types: new Float32Array(count),
    dustAttenuation: new Float32Array(count)
  };
}

function createDustAttributes(count) {
  return {
    positions: new Float32Array(count * 3),
    sizes: new Float32Array(count),
    opacities: new Float32Array(count),
    seeds: new Float32Array(count),
    radii: new Float32Array(count)
  };
}

function writeCoreStar(attributes, index, config, random) {
  const layer = random();
  const radius = layer < 0.08
    ? config.coreRadius * 0.17 * Math.sqrt(random())
    : layer < 0.56
      ? config.coreRadius * (0.13 + Math.pow(random(), 0.82) * 0.52)
      : config.coreRadius * (0.48 + Math.pow(random(), 0.72) * 0.74);
  const angle = random() * TAU + Math.sin(radius * 29) * 0.08;
  const progress = clamp(radius / config.coreRadius, 0, 1);
  const thickness = mix(0.132, 0.052, progress);
  const z = clamp(gaussian(random), -2.05, 2.05) * thickness;
  const bright = layer < 0.08 ? random() > 0.965 : random() > 0.996;
  const color = new THREE.Color().lerpColors(
    STAR_COLORS.coreWhite,
    progress < 0.62 ? STAR_COLORS.coreGold : STAR_COLORS.warmNeutral,
    Math.min(1, progress * 0.72 + random() * 0.12)
  );
  const coreLuminosity = layer < 0.08
    ? 0.7 + random() * 0.28
    : layer < 0.56
      ? 0.32 + random() * 0.32
      : 0.14 + random() * 0.24;

  writeStar(attributes, index, {
    x: Math.cos(angle) * radius * (0.9 + random() * 0.2),
    y: Math.sin(angle) * radius * (0.9 + random() * 0.2),
    z,
    color,
    size: bright ? 1.4 + random() * 0.62 : mix(0.74, 0.38, progress) + random() * 0.48,
    luminosity: bright ? 1.12 + random() * 0.26 : coreLuminosity,
    seed: random(),
    radius,
    type: bright ? 1 : 3,
    dustAttenuation: computeCoreDustAttenuation(radius, angle, config, random())
  });
}

function writeArmStar(attributes, index, armParticleIndex, config, random) {
  const armIndex = selectArmIndex(armParticleIndex, config.armStarCount);
  const profile = ARM_PROFILES[armIndex];
  const innerRadius = config.coreRadius * 0.54;
  let radius = 0;
  let density = 0;
  let clump = 0;
  let attempts = 0;

  do {
    radius = innerRadius + Math.pow(random(), 0.86) * (profile.reach - innerRadius);
    const progress = (radius - innerRadius) / (profile.reach - innerRadius);
    const clumpA = 0.5 + Math.sin(radius * 31 + armIndex * 1.91) * 0.5;
    const clumpB = 0.5 + Math.sin(radius * 67 - armIndex * 2.37) * 0.5;
    clump = Math.pow(clumpA * 0.62 + clumpB * 0.38, 1.35);
    const gap = profile.gap < 0
      ? 0
      : Math.exp(-Math.pow((progress - profile.gap) / profile.gapWidth, 4));
    const endingBreakup = smoothstep(0.72, 1, progress)
      * (0.24 + Math.sin(progress * 58 + armIndex * 3.4) * 0.22);
    density = (0.12 + clump * 0.88) * profile.strength * (1 - gap * 0.94) * (1 - endingBreakup);
    attempts += 1;
  } while (random() > density && attempts < 12);

  const progress = (radius - innerRadius) / (profile.reach - innerRadius);
  const branch = progress > 0.42 && random() < profile.branchRate;
  const armWidth = mix(0.014, 0.068, progress)
    * profile.widthScale
    * (0.58 + random() * 0.68);
  const angleNoise = gaussian(random) * armWidth / Math.max(radius, 0.12);
  const radialNoise = gaussian(random) * mix(0.006, 0.027, progress);
  const baseAngle = getArmAngle(profile, progress, config)
    + Math.sin(radius * 9.4 + armIndex) * 0.035;
  const angle = baseAngle
    + angleNoise
    + (branch ? profile.branchDirection * (0.11 + progress * 0.19 + gaussian(random) * 0.025) : 0);
  const noisyRadius = Math.max(0.08, radius + radialNoise);
  const thickness = (progress < 0.22
    ? mix(0.064, 0.04, progress / 0.22)
    : mix(0.04, 0.017, (progress - 0.22) / 0.78)) * profile.zScale;
  const verticalScatter = random() > 0.985 ? 1.8 + random() * 0.8 : 1;
  const sideDepth = Math.sin(angle + 0.28) * mix(0.036, 0.014, progress) * profile.zScale;
  const z = clamp(gaussian(random), -2.3, 2.3) * thickness * verticalScatter + sideDepth;
  const bright = random() > mix(0.993, 0.997, progress) - clump * 0.002;
  const microDust = !bright && random() < mix(0.72, 0.54, progress);
  const globalProgress = radius / config.outerRadius;
  const sourceColor = globalProgress < 0.34 ? STAR_COLORS.warmNeutral : STAR_COLORS.neutral;
  const coldMix = smoothstep(0.38, 1.02, globalProgress) * (0.66 + random() * 0.2);
  const color = new THREE.Color().lerpColors(
    sourceColor,
    STAR_COLORS.cold,
    coldMix
  );
  const dustAttenuation = branch
    ? 0
    : computeDustAttenuation(radius, angle - baseAngle, random(), progress, profile);
  const regularSize = 0.36 + random() * 0.7 + clump * 0.18;
  const regularLuminosity = (0.24 + clump * 0.66) * profile.strength * (branch ? 0.72 : 1);

  writeStar(attributes, index, {
    x: Math.cos(angle) * noisyRadius,
    y: Math.sin(angle) * noisyRadius,
    z,
    color,
    size: bright ? 1.45 + random() * 0.8 : microDust ? 0.76 + random() * 0.64 : regularSize,
    luminosity: bright ? 1.08 + random() * 0.32 : microDust ? regularLuminosity * 0.62 : regularLuminosity,
    seed: random(),
    radius,
    type: bright ? 1 : microDust ? 4 : 0,
    dustAttenuation
  });
}

function writeHaloStar(attributes, index, config, random) {
  const spill = index < Math.floor(config.haloStarCount * 0.36);
  const profile = ARM_PROFILES[index % 3 === 2 ? 3 : index % 2];
  const radius = spill
    ? profile.reach + Math.abs(gaussian(random)) * 0.055 + random() * 0.12
    : 0.2 + Math.pow(random(), 0.68) * 1.12;
  const progress = clamp((radius - config.coreRadius * 0.54) / (profile.reach - config.coreRadius * 0.54), 0, 1.18);
  const angle = spill
    ? getArmAngle(profile, progress, config) + profile.branchDirection * 0.05 + gaussian(random) * 0.055
    : random() * TAU;
  const thickness = spill ? 0.04 : mix(0.19, 0.09, Math.min(radius, 1));
  const z = clamp(gaussian(random), -2.55, 2.55) * thickness;
  const color = new THREE.Color().lerpColors(
    STAR_COLORS.halo,
    STAR_COLORS.cold,
    random() * 0.44
  );
  const bright = spill && random() > 0.992;

  writeStar(attributes, index, {
    x: Math.cos(angle) * radius * (0.82 + random() * 0.3),
    y: Math.sin(angle) * radius * (0.82 + random() * 0.3),
    z,
    color,
    size: bright ? 1.15 + random() * 0.42 : 0.22 + random() * 0.58,
    luminosity: bright ? 0.82 + random() * 0.2 : (spill ? 0.09 : 0.045) + random() * (spill ? 0.16 : 0.1),
    seed: random(),
    radius,
    type: bright ? 1 : 2,
    dustAttenuation: 0
  });
}

function writeDustParticle(attributes, index, config, random) {
  const armIndex = selectArmIndex(index, config.dustCount);
  const profile = ARM_PROFILES[armIndex];
  const innerRadius = config.coreRadius * 0.48;
  const radius = innerRadius + Math.pow(random(), 0.92) * (profile.reach * 0.92 - innerRadius);
  const progress = (radius - innerRadius) / (profile.reach * 0.92 - innerRadius);
  const brokenSection = 0.5 + Math.sin(radius * 43 + armIndex * 2.8) * 0.5;
  const bandOffset = -0.052 + Math.sin(radius * 12.6 + armIndex) * 0.012;
  const angle = getArmAngle(profile, progress, config)
    + bandOffset
    + gaussian(random) * mix(0.022, 0.052, progress);
  const noisyRadius = radius + gaussian(random) * mix(0.01, 0.033, progress);
  const thickness = mix(0.052, 0.018, progress);
  const stride = index * 3;

  attributes.positions[stride] = Math.cos(angle) * noisyRadius;
  attributes.positions[stride + 1] = Math.sin(angle) * noisyRadius;
  attributes.positions[stride + 2] = clamp(gaussian(random), -2, 2) * thickness + (index % 2 === 0 ? 0.012 : -0.008);
  attributes.sizes[index] = 2.1 + random() * 3.5;
  attributes.opacities[index] = (0.032 + brokenSection * 0.09)
    * profile.dustStrength
    * (0.62 + random() * 0.56);
  attributes.seeds[index] = random();
  attributes.radii[index] = radius;
}

function writeStar(attributes, index, star) {
  const stride = index * 3;
  attributes.positions[stride] = star.x;
  attributes.positions[stride + 1] = star.y;
  attributes.positions[stride + 2] = star.z;
  attributes.colors[stride] = star.color.r;
  attributes.colors[stride + 1] = star.color.g;
  attributes.colors[stride + 2] = star.color.b;
  attributes.sizes[index] = star.size;
  attributes.luminosities[index] = star.luminosity;
  attributes.seeds[index] = star.seed;
  attributes.radii[index] = star.radius;
  attributes.types[index] = star.type;
  attributes.dustAttenuation[index] = star.dustAttenuation;
}

function computeDustAttenuation(radius, armOffset, seed, progress, profile) {
  const laneCenter = GPU_GALAXY_V2_DUST_FIELD.laneCenter
    + Math.sin(radius * 12.6) * GPU_GALAXY_V2_DUST_FIELD.laneWobble;
  const lane = Math.exp(-Math.pow(
    (armOffset - laneCenter)
      * mix(GPU_GALAXY_V2_DUST_FIELD.innerSharpness, GPU_GALAXY_V2_DUST_FIELD.outerSharpness, progress),
    2
  ));
  const breakup = 0.5 + Math.sin(radius * 43 + seed * 7.1) * 0.5;
  return lane
    * smoothstep(0.22, 0.64, breakup)
    * (1 - smoothstep(0.84, 1, progress) * 0.42)
    * profile.dustStrength;
}

function computeCoreDustAttenuation(radius, angle, config, seed) {
  if (radius < config.coreRadius * 0.13) return 0;

  let nearestOffset = Math.PI;
  const progress = clamp(radius / config.coreRadius, 0, 1);
  for (const profile of ARM_PROFILES) {
    const coreAngle = profile.phase + Math.log1p(progress * 2.2) * 0.62;
    const offset = wrapAngle(angle - coreAngle);
    if (Math.abs(offset) < Math.abs(nearestOffset)) nearestOffset = offset;
  }
  const lane = Math.exp(-Math.pow((nearestOffset + 0.075) * 7.5, 2));
  const breakup = 0.5 + Math.sin(radius * 54 + seed * 9.2) * 0.5;
  return lane * smoothstep(0.2, 0.72, breakup) * 0.78;
}

function selectArmIndex(index, count) {
  const progress = (index + 0.5) / count;
  let accumulated = 0;

  for (let armIndex = 0; armIndex < ARM_PROFILES.length; armIndex += 1) {
    accumulated += ARM_PROFILES[armIndex].weight;
    if (progress < accumulated) return armIndex;
  }
  return ARM_PROFILES.length - 1;
}

function getArmAngle(profile, progress, config) {
  return profile.phase + Math.log1p(Math.max(progress, 0) * 7) * config.turns * 1.82;
}

function wrapAngle(angle) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

function gaussian(random) {
  const u = Math.max(random(), 1e-6);
  const v = Math.max(random(), 1e-6);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function mix(start, end, amount) {
  return start + (end - start) * Math.min(Math.max(amount, 0), 1);
}

function smoothstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function clamp(value, minimum, maximum) {
  return Math.min(Math.max(value, minimum), maximum);
}

function seededRandom(seed) {
  let state = seed >>> 0;

  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}
