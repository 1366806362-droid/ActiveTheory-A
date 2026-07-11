import * as THREE from 'three';
import { createGalaxyCoreCluster } from './galaxyCoreCluster.js';

const TAU = Math.PI * 2;
const DEBUG_MAIN_GALAXY_ONLY = readDebugFlag('debugMainGalaxyOnly', false);

export function createEnergyCore() {
  const group = new THREE.Group();
  const galaxyPlane = new THREE.Group();
  const particleTexture = createParticleTexture();
  const arms = createSpiralArms(particleTexture);
  const armNebula = createArmNebula(particleTexture);
  const dust = createGalaxyDust(particleTexture);
  const nodes = createStellarNodes(particleTexture);
  const core = createLuminousCore(particleTexture);
  const armGuides = createArmGuideLines();
  const armsLayer = new THREE.Group();
  const nebulaLayer = new THREE.Group();
  const dustLayer = new THREE.Group();
  const nodesLayer = new THREE.Group();
  const planeNormal = new THREE.Vector3(0, 0, 1);
  const heroViewNormal = new THREE.Vector3(-0.013, 0.311, 0.95).normalize();
  const localTiltAxis = new THREE.Vector3(1, 0, 0);
  const localSpinAxis = new THREE.Vector3(0, 0, 1);
  const facingQuaternion = new THREE.Quaternion().setFromUnitVectors(planeNormal, heroViewNormal);
  const tiltQuaternion = new THREE.Quaternion().setFromAxisAngle(
    localTiltAxis,
    THREE.MathUtils.degToRad(18)
  );
  const baseOrientation = facingQuaternion.clone().multiply(tiltQuaternion);
  const spinQuaternion = new THREE.Quaternion();
  let galaxyRotation = 0.06;

  group.name = 'ActiveTheoryBrandGalaxy';
  group.position.set(0.46, 0.04, 0);
  galaxyPlane.name = 'BrandGalaxySpiralPlane';
  armsLayer.name = 'BrandGalaxyArmsLayer';
  nebulaLayer.name = 'BrandGalaxyArmNebulaLayer';
  dustLayer.name = 'BrandGalaxyDustLayer';
  nodesLayer.name = 'BrandGalaxyNodesLayer';
  arms.points.visible = !DEBUG_MAIN_GALAXY_ONLY;
  dust.points.visible = !DEBUG_MAIN_GALAXY_ONLY;
  nodes.points.visible = !DEBUG_MAIN_GALAXY_ONLY;
  armGuides.group.visible = DEBUG_MAIN_GALAXY_ONLY;
  armsLayer.add(arms.points);
  nebulaLayer.add(armNebula.points);
  dustLayer.add(dust.points);
  nodesLayer.add(nodes.points);
  galaxyPlane.position.set(0.4, 0.4, 0);
  galaxyPlane.scale.setScalar(1.05);
  applyGalaxyOrientation();
  galaxyPlane.add(nebulaLayer, dustLayer, armsLayer, nodesLayer, core.group, armGuides.group);
  group.add(galaxyPlane);

  function update(delta, time, interaction) {
    const interactionProximity = interaction?.proximity ?? 0;
    const pulse = 0.5 + Math.sin(time * 0.42) * 0.5;
    const breathing = Math.sin(time * 0.18 + 0.7);

    group.position.set(0.46, 0.04, 0);
    group.scale.setScalar(1.14 + breathing * 0.01);
    group.rotation.y = 0;
    galaxyRotation -= delta * 0.026;
    applyGalaxyOrientation();
    arms.update(delta, time, pulse, interactionProximity);
    armNebula.update(delta, time, pulse);
    dust.update(delta, time, breathing);
    nodes.update(delta, time, pulse);
    core.update(delta, time, pulse, interactionProximity);
  }

  function applyGalaxyOrientation() {
    spinQuaternion.setFromAxisAngle(localSpinAxis, galaxyRotation);
    galaxyPlane.quaternion.copy(baseOrientation).multiply(spinQuaternion);
  }

  function dispose() {
    arms.dispose();
    armNebula.dispose();
    dust.dispose();
    nodes.dispose();
    core.dispose();
    armGuides.dispose();
    particleTexture.dispose();
    group.clear();
  }

  return {
    group,
    layers: {
      arms: armsLayer,
      nebula: nebulaLayer,
      dust: dustLayer,
      nodes: nodesLayer,
      core: core.group
    },
    update,
    dispose
  };
}

function createArmGuideLines() {
  const group = new THREE.Group();
  const lines = [];
  const pointCount = 200;
  const innerRadius = 0.055;
  const outerRadius = 0.68;
  const turns = 0.54;
  const radiusExponent = 1.05;
  const globalArmPhase = 0.32;
  const colors = [0xf2fcff, 0xaedfff];

  group.name = 'BrandGalaxyArmGuides';

  for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
    const positions = new Float32Array(pointCount * 3);
    const baseAngle = branchIndex * Math.PI + globalArmPhase;

    for (let i = 0; i < pointCount; i += 1) {
      const i3 = i * 3;
      const t = i / (pointCount - 1);
      const radius = innerRadius
        + (outerRadius - innerRadius) * Math.pow(t, radiusExponent);
      const angle = baseAngle + t * TAU * turns;

      positions[i3] = Math.cos(angle) * radius;
      positions[i3 + 1] = Math.sin(angle) * radius * 0.78;
      positions[i3 + 2] = 0.004;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
      color: colors[branchIndex],
      transparent: true,
      opacity: 0.9,
      blending: THREE.NormalBlending,
      depthWrite: false,
      toneMapped: false
    });
    const line = new THREE.Line(geometry, material);

    line.name = `BrandGalaxyArmGuide${branchIndex + 1}`;
    lines.push(line);
    group.add(line);
  }

  function dispose() {
    lines.forEach((line) => {
      line.geometry.dispose();
      line.material.dispose();
    });
  }

  return { group, dispose };
}

function createSpiralArms(texture) {
  const mainArmCount = 1116;
  const auxiliaryArmCount = 0;
  const count = mainArmCount * 2 + auxiliaryArmCount;
  const random = seededRandom(74051);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacity = new Float32Array(count);
  const innerColor = new THREE.Color(0xe8fbff);
  const coldWhite = new THREE.Color(0xdff6ff);
  const iceBlue = new THREE.Color(0x78c8ff);
  const cyanBlue = new THREE.Color(0x32acd8);
  const paleViolet = new THREE.Color(0x9a82f2);
  const armColor = new THREE.Color(0x56baff);
  const outerColor = new THREE.Color(0x334fa8);
  const violetColor = new THREE.Color(0x7a62d8);
  const warmColor = new THREE.Color(0xffdcae);
  const particleColor = new THREE.Color();
  const radialColor = new THREE.Color();
  const armLayers = [
    { count: 720, baseWidth: 0.025, widthGrowth: 0.089, opacity: 0.92, size: 1.22, brightness: 1.06, dropout: 0.012 },
    { count: 344, baseWidth: 0.039, widthGrowth: 0.15, opacity: 0.34, size: 0.7, brightness: 0.62, dropout: 0.1 },
    { count: 52, baseWidth: 0.034, widthGrowth: 0.13, opacity: 0.06, size: 0.46, brightness: 0.28, dropout: 0.5 }
  ];
  const innerRadius = 0.055;
  const outerRadius = 0.68;
  const turns = 0.54;
  const radiusExponent = 1.05;
  const globalArmPhase = 0.32;
  let particleIndex = 0;

  for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
    const branchAngle = branchIndex * Math.PI + globalArmPhase;

    for (let layerIndex = 0; layerIndex < armLayers.length; layerIndex += 1) {
      const layer = armLayers[layerIndex];

      for (let localIndex = 0; localIndex < layer.count; localIndex += 1) {
        const linearProgress = Math.min((localIndex + random() * 0.82) / layer.count, 1);
        const branchProgress = layerIndex === 0
          ? remapTrunkProgress(linearProgress)
          : linearProgress;
        const radius = innerRadius
          + (outerRadius - innerRadius) * Math.pow(branchProgress, radiusExponent);
        const radiusRatio = (radius - innerRadius) / (outerRadius - innerRadius);
        const spinAngle = branchProgress * TAU * turns;
        const clusterWave = Math.sin(branchProgress * 8.4 + branchIndex * 2.1) * 0.5 + 0.5;
        const secondaryCluster = Math.sin(branchProgress * 15.2 + branchIndex * 4.3) * 0.5 + 0.5;
        const isInnerArm = branchProgress < 0.42;
        const isMidArm = branchProgress >= 0.35 && branchProgress <= 0.72;
        const rootNoiseTaper = 0.18 + Math.min(radiusRatio / 0.42, 1) * 0.82;
        const armWidth = layer.baseWidth * (0.28 + Math.pow(radiusRatio, 0.82) * 0.72)
          + radius * layer.widthGrowth;
        const innerDiffuseTightening = layerIndex === 1
          && branchProgress >= 0.08
          && branchProgress <= 0.36
          ? 0.9
          : 1;
        const widthBoost = (isMidArm ? 1.12 : 1) * innerDiffuseTightening;
        const widthVariation = 0.74 + clusterWave * 0.52;
        const perpendicularOffset = clampGaussian(gaussianRandom(random))
          * armWidth
          * widthBoost
          * widthVariation
          * rootNoiseTaper
          * (isInnerArm ? 0.34 : 1);
        const radialOffset = clampGaussian(gaussianRandom(random))
          * armWidth
          * (layerIndex === 0 ? 0.24 : 0.46)
          * rootNoiseTaper;
        const angularNoise = (random() - 0.5)
          * (0.004 + radiusRatio * (0.018 + layerIndex * 0.026))
          * (isInnerArm ? 0.3 : 1);
        const angle = branchAngle + spinAngle + angularNoise;
        const noisyRadius = Math.max(0.025, radius + radialOffset);
        const diskX = Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicularOffset;
        const diskY = Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicularOffset;
        const baseThickness = 0.12 * (1 - radiusRatio * 0.55);
        const verticalThickness = (baseThickness + layerIndex * 0.014) * (0.76 + secondaryCluster * 0.38);
        const outerDropout = branchProgress > 0.78
          ? ((branchProgress - 0.78) / 0.22) * 0.5
          : 0;
        const isGap = isInnerArm
          ? false
          : (
            (clusterWave < 0.06 && random() < 0.18)
            || random() < layer.dropout + outerDropout
          );

        writeArmParticle({
          index: particleIndex,
          x: diskX,
          y: diskY * 0.78,
          z: (random() - 0.5) * verticalThickness,
          progress: branchProgress,
          layer,
          clusterWave,
          secondaryCluster,
          isGap,
          isAuxiliary: false
        });
        particleIndex += 1;
      }
    }
  }

  for (let localIndex = 0; localIndex < auxiliaryArmCount; localIndex += 1) {
    const branchProgress = 0.18 + ((localIndex + random() * 0.8) / auxiliaryArmCount) * 0.56;
    const radiusLimit = 0.68;
    const radius = 0.04 + Math.pow(branchProgress, 0.58) * radiusLimit;
    const radiusRatio = radius / radiusLimit;
    const angle = 1.28 + radius * 3.35 + radius * radius * 0.3 + (random() - 0.5) * 0.11;
    const clusterWave = Math.sin(branchProgress * 24.5 + 1.8) * 0.5 + 0.5;
    const secondaryCluster = Math.sin(branchProgress * 11.8 + 4.1) * 0.5 + 0.5;
    const armWidth = 0.024 + radius * 0.1;
    const perpendicularOffset = clampGaussian(gaussianRandom(random)) * armWidth;
    const noisyRadius = radius + clampGaussian(gaussianRandom(random)) * armWidth * 0.38;
    const isGap = clusterWave < 0.32 || random() < 0.44 || branchProgress > 0.67 && random() < 0.62;

    writeArmParticle({
      index: particleIndex,
      x: Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicularOffset,
      y: (Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicularOffset) * 0.76,
      z: (random() - 0.5) * (0.05 + (1 - radiusRatio) * 0.1),
      progress: branchProgress,
      layer: { opacity: DEBUG_MAIN_GALAXY_ONLY ? 0 : 0.05, size: 0.48, brightness: 0.34 },
      clusterWave,
      secondaryCluster,
      isGap,
      isAuxiliary: true
    });
    particleIndex += 1;
  }

  function writeArmParticle({
    index,
    x,
    y,
    z,
    progress,
    layer,
    clusterWave,
    secondaryCluster,
    isGap,
    isAuxiliary
  }) {
    const i3 = index * 3;
    const radialFade = 1 - Math.min(progress, 1);
    const outerOpacity = progress > 0.78
      ? 1 - Math.min((progress - 0.78) / 0.22, 1) * 0.96
      : 1;

    positions[i3] = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    radialColor.copy(innerColor).lerp(armColor, Math.min(progress * 1.2, 1));
    radialColor.lerp(outerColor, Math.max((progress - 0.5) / 0.5, 0));

    if (DEBUG_MAIN_GALAXY_ONLY) {
      particleColor.set(progress < 0.5 ? 0xeafaff : 0xaedfff);
    } else {
      const colorRoll = random();

      if (colorRoll < 0.25) {
        particleColor.copy(coldWhite);
      } else if (colorRoll < 0.55) {
        particleColor.copy(iceBlue);
      } else if (colorRoll < 0.75) {
        particleColor.copy(cyanBlue);
      } else if (colorRoll < 0.93) {
        particleColor.copy(paleViolet);
      } else {
        particleColor.copy(warmColor);
      }
      particleColor.lerp(radialColor, colorRoll < 0.75 ? 0.48 : 0.22);
    }

    const brightnessVariation = 0.84 + random() * 0.26;
    const rootBrightness = 0.68 + smoothstepNumber(0.03, 0.22, progress) * 0.32;
    const brightness = (DEBUG_MAIN_GALAXY_ONLY ? 1.12 : layer.brightness)
      * brightnessVariation
      * (0.78 + clusterWave * 0.28 + secondaryCluster * 0.1)
      * rootBrightness;

    colors[i3] = particleColor.r * brightness;
    colors[i3 + 1] = particleColor.g * brightness;
    colors[i3 + 2] = particleColor.b * brightness;
    sizes[index] = layer.size * (0.82 + random() * 0.44 + clusterWave * 0.12);
    opacity[index] = isGap
      ? layer.opacity * 0.08
      : layer.opacity
        * (0.72 + radialFade * 0.28)
        * (0.82 + clusterWave * 0.24)
        * (0.76 + smoothstepNumber(0.03, 0.2, progress) * 0.24)
        * outerOpacity;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacity, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0.78 },
      uPointScale: { value: 1 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;
      uniform float uPointScale;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vOpacity = aOpacity;
        gl_PointSize = aSize * uPointScale * (7.2 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        float alpha = texture2D(uTexture, gl_PointCoord).a;
        gl_FragColor = vec4(vColor, alpha * vOpacity * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: DEBUG_MAIN_GALAXY_ONLY ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandGalaxySpiralArms';

  function update(delta, time, pulse, interactionProximity) {
    material.uniforms.uOpacity.value = DEBUG_MAIN_GALAXY_ONLY
      ? 0.86
      : 0.84 + pulse * 0.1 + interactionProximity * 0.025;
    material.uniforms.uPointScale.value = DEBUG_MAIN_GALAXY_ONLY
      ? 1
      : 1.02 + pulse * 0.035;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createArmNebula(texture) {
  const particlesPerArm = 180;
  const count = particlesPerArm * 2;
  const random = seededRandom(118903);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const opacity = new Float32Array(count);
  const iceBlue = new THREE.Color(0x70ccff);
  const cyanBlue = new THREE.Color(0x2f9fcf);
  const paleViolet = new THREE.Color(0x8d78d8);
  const color = new THREE.Color();
  const innerRadius = 0.055;
  const outerRadius = 0.68;
  const turns = 0.54;
  const radiusExponent = 1.05;
  const globalArmPhase = 0.32;

  for (let branchIndex = 0; branchIndex < 2; branchIndex += 1) {
    const baseAngle = branchIndex * Math.PI + globalArmPhase;

    for (let localIndex = 0; localIndex < particlesPerArm; localIndex += 1) {
      const index = branchIndex * particlesPerArm + localIndex;
      const stride = index * 3;
      const t = Math.min((localIndex + random() * 0.82) / particlesPerArm, 1);
      const radius = innerRadius + (outerRadius - innerRadius) * Math.pow(t, radiusExponent);
      const angle = baseAngle + t * TAU * turns + (random() - 0.5) * (0.025 + t * 0.07);
      const width = (0.0145 + radius * 0.096) * (0.56 + Math.sin(t * 12.0 + branchIndex) * 0.12);
      const perpendicular = gaussianRandom(random) * width * 0.48;
      const radialOffset = gaussianRandom(random) * width * 0.18;
      const noisyRadius = Math.max(0.04, radius + radialOffset);
      const diskX = Math.cos(angle) * noisyRadius - Math.sin(angle) * perpendicular;
      const diskY = Math.sin(angle) * noisyRadius + Math.cos(angle) * perpendicular;
      const coreFade = smoothstepNumber(0.04, 0.2, t);
      const outerFade = 1 - smoothstepNumber(0.68, 1, t);
      const cluster = 0.68 + Math.sin(t * 15.4 + branchIndex * 1.7) * 0.2;

      positions[stride] = diskX;
      positions[stride + 1] = diskY * 0.78;
      positions[stride + 2] = (random() - 0.5) * (0.08 + (1 - t) * 0.08);
      color.copy(iceBlue).lerp(cyanBlue, Math.min(t * 1.15, 1));
      color.lerp(paleViolet, smoothstepNumber(0.42, 0.92, t) * 0.58);
      colors[stride] = color.r * cluster;
      colors[stride + 1] = color.g * cluster;
      colors[stride + 2] = color.b * cluster;
      sizes[index] = 1.2 + random() * 1.36 + (1 - t) * 0.36;
      opacity[index] = (0.42 + random() * 0.24) * coreFade * outerFade;
    }
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aOpacity', new THREE.BufferAttribute(opacity, 1));
  geometry.computeBoundingSphere();

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uOpacity: { value: 0.18 }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aOpacity;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vOpacity = aOpacity;
        gl_PointSize = aSize * (17.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uTexture;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vOpacity;

      void main() {
        float alpha = texture2D(uTexture, gl_PointCoord).a;
        gl_FragColor = vec4(vColor, alpha * vOpacity * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: true
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandGalaxyArmNebula';
  points.renderOrder = -1;

  function update(delta, time, pulse) {
    material.uniforms.uOpacity.value = 0.1 + pulse * 0.02;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createGalaxyDust(texture) {
  const count = 72;
  const random = seededRandom(90317);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const blue = new THREE.Color(0x245ca8);
  const violet = new THREE.Color(0x5b3d9a);
  const color = new THREE.Color();

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const branchIndex = i % 2;
    const branchProgress = 0.66 + random() * 0.34;
    const radius = 0.055 + (0.68 - 0.055) * Math.pow(branchProgress, 1.05);
    const branchAngle = branchIndex * Math.PI + 0.32;
    const angle = branchAngle
      + branchProgress * TAU * 0.54
      + (random() - 0.5) * 0.26;
    const radialScatter = clampGaussian(gaussianRandom(random)) * (0.045 + branchProgress * 0.05);
    const scatteredRadius = Math.max(0.2, radius + radialScatter);
    const diskFalloff = 1 - branchProgress;

    positions[i3] = Math.cos(angle) * scatteredRadius;
    positions[i3 + 1] = Math.sin(angle) * scatteredRadius * 0.78;
    positions[i3 + 2] = (random() - 0.5) * (0.1 + diskFalloff * 0.16);
    color.copy(blue).lerp(violet, random() * 0.48);
    colors[i3] = color.r * (0.38 + diskFalloff * 0.4);
    colors[i3 + 1] = color.g * (0.42 + diskFalloff * 0.34);
    colors[i3 + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();

  const material = new THREE.PointsMaterial({
    size: 0.011,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.01,
    vertexColors: true,
    transparent: true,
    opacity: 0.16,
    blending: DEBUG_MAIN_GALAXY_ONLY ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandGalaxyDust';

  function update(delta, time, breathing) {
    points.rotation.y = Math.sin(time * 0.02) * 0.04;
    material.opacity = 0.02 + breathing * 0.009;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createStellarNodes(texture) {
  const count = 12;
  const random = seededRandom(12791);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const i3 = i * 3;
    const arm = i % 2;
    const branchProgress = 0.08 + random() * 0.84;
    const radius = 0.055 + (0.68 - 0.055) * Math.pow(branchProgress, 1.05);
    const baseAngle = arm * Math.PI + 0.32;
    const angle = baseAngle
      + branchProgress * TAU * 0.54
      + (random() - 0.5) * 0.18;
    const warmNode = i % 9 === 0;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle) * radius * 0.78;
    positions[i3 + 2] = (random() - 0.5) * 0.08;
    colors[i3] = warmNode ? 1 : 0.62;
    colors[i3 + 1] = warmNode ? 0.9 : 0.88;
    colors[i3 + 2] = 1;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 0.047,
    sizeAttenuation: true,
    map: texture,
    alphaTest: 0.015,
    vertexColors: true,
    transparent: true,
    opacity: 0.72,
    blending: DEBUG_MAIN_GALAXY_ONLY ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'BrandGalaxyStellarNodes';

  function update(delta, time, pulse) {
    material.opacity = 0.68 + pulse * 0.24;
    material.size = 0.046 + pulse * 0.011;
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { points, update, dispose };
}

function createLuminousCore(particleTexture) {
  const group = new THREE.Group();
  const pointCount = 700;
  const planetCluster = createGalaxyCoreCluster({
    name: 'BrandGalaxyCoreCluster',
    starCount: 576,
    highlightCount: 7,
    radius: 0.12,
    coreColor: 0xf2fcff,
    secondaryColors: [0xbdeaff, 0x67d8ff, 0xa99cff, 0xffefd6],
    depthRange: 0.16,
    bloomIntensity: 0.96,
    pulseSpeed: 0.28,
    starOpacity: 0.98,
    highlightOpacity: 0.98,
    hazeOpacity: 0.11,
    seed: 314159
  });
  const random = seededRandom(48151);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);

  for (let i = 0; i < pointCount; i += 1) {
    const i3 = i * 3;
    const radius = Math.pow(random(), 2.1) * 0.42;
    const angle = random() * TAU;

    positions[i3] = Math.cos(angle) * radius;
    positions[i3 + 1] = Math.sin(angle) * radius * 0.58;
    positions[i3 + 2] = (random() - 0.5) * (0.08 + (1 - radius / 0.42) * 0.08);
    const warmCore = random() > 0.96;
    const violetCore = random() > 0.9;

    colors[i3] = (warmCore ? 1 : violetCore ? 0.78 : 0.72 + random() * 0.28) * 0.66;
    colors[i3 + 1] = (warmCore ? 0.92 : violetCore ? 0.82 : 0.9 + random() * 0.1) * 0.7;
    colors[i3 + 2] = 0.74;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const pointMaterial = new THREE.PointsMaterial({
    size: 0.014,
    sizeAttenuation: true,
    map: particleTexture,
    alphaTest: 0.02,
    vertexColors: true,
    transparent: true,
    opacity: 0.34,
    blending: DEBUG_MAIN_GALAXY_ONLY ? THREE.NormalBlending : THREE.AdditiveBlending,
    depthWrite: false,
    fog: false
  });
  const points = new THREE.Points(geometry, pointMaterial);

  group.name = 'BrandGalaxyLuminousCore';
  group.scale.set(1.05, 0.95, 1);
  if (DEBUG_MAIN_GALAXY_ONLY) {
    planetCluster.group.traverse((object) => {
      if (object.material) {
        object.material.blending = THREE.NormalBlending;
        object.material.needsUpdate = true;
      }
    });
  }
  group.add(points, planetCluster.group);

  function update(delta, time, pulse, interactionProximity) {
    group.rotation.z -= delta * 0.004;
    pointMaterial.opacity = 0.38 + pulse * 0.025;
    planetCluster.update(delta, time, pulse, 1, interactionProximity, 1);
  }

  function dispose() {
    geometry.dispose();
    pointMaterial.dispose();
    planetCluster.dispose();
  }

  return { group, update, dispose };
}

function createParticleTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 64;
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.24, 'rgba(190,235,255,0.94)');
  gradient.addColorStop(0.62, 'rgba(80,155,255,0.32)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;

  return texture;
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

function gaussianRandom(random) {
  const u = Math.max(random(), Number.EPSILON);
  const v = Math.max(random(), Number.EPSILON);

  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v);
}

function remapTrunkProgress(progress) {
  if (progress < 0.08) {
    return progress;
  }

  if (progress < 0.41) {
    return 0.08 + ((progress - 0.08) / 0.33) * 0.28;
  }

  if (progress < 0.8) {
    return 0.36 + ((progress - 0.41) / 0.39) * 0.42;
  }

  return 0.78 + ((progress - 0.8) / 0.2) * 0.22;
}

function clampGaussian(value) {
  return Math.max(-2.4, Math.min(2.4, value));
}

function smoothstepNumber(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * (3 - 2 * t);
}

function readDebugFlag(name, fallback) {
  const params = new URLSearchParams(window.location.search);

  if (!params.has(name)) {
    return fallback;
  }

  return params.get(name) !== '0' && params.get(name) !== 'false';
}
