import * as THREE from 'three';

const TAU = Math.PI * 2;
const TEXTURE_SIZE = 768;
const DEFAULT_PARAMETERS = Object.freeze({
  innerRadius: 0.07,
  outerRadius: 0.78,
  turns: 0.88,
  radiusExponent: 1.12
});

export function createCinematicGalaxyShell(parameters = DEFAULT_PARAMETERS) {
  const config = { ...DEFAULT_PARAMETERS, ...parameters };
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(2, 2, 1, 1);
  const mainTexture = createShellTexture(config, 'main');
  const nebulaTexture = createShellTexture(config, 'nebula');
  const dustTexture = createShellTexture(config, 'dust');
  const mainMaterial = createShellMaterial(mainTexture, 0.085, THREE.NormalBlending);
  const nebulaMaterial = createShellMaterial(nebulaTexture, 0.07, THREE.NormalBlending);
  const dustMaterial = createShellMaterial(dustTexture, 0.14, THREE.NormalBlending);
  const mainPlane = createLayerPlane('CinematicGalaxyShellMainArms', mainMaterial, -0.055, -4);
  const nebulaPlane = createLayerPlane('CinematicGalaxyShellNebula', nebulaMaterial, -0.065, -5);
  const dustPlane = createLayerPlane('CinematicGalaxyShellDust', dustMaterial, -0.045, -3);
  const materials = [mainMaterial, nebulaMaterial, dustMaterial];
  const baseOpacities = materials.map((material) => material.opacity);

  group.name = 'CinematicGalaxyShell';
  group.add(nebulaPlane, mainPlane, dustPlane);

  function update(delta, time, journeyProgress = 0) {
    const visibility = 1 - smootherstep(0.35, 0.7, journeyProgress);
    const pulse = 0.985 + Math.sin(time * 0.11) * 0.015;

    group.rotation.z += delta * 0.0032;
    materials.forEach((material, index) => {
      material.opacity = baseOpacities[index] * visibility * pulse;
    });
  }

  function dispose() {
    geometry.dispose();
    mainTexture.dispose();
    nebulaTexture.dispose();
    dustTexture.dispose();
    materials.forEach((material) => material.dispose());
    group.clear();
  }

  return {
    group,
    update,
    dispose
  };

  function createLayerPlane(name, material, z, renderOrder) {
    const plane = new THREE.Mesh(geometry, material);

    plane.name = name;
    plane.position.z = z;
    plane.renderOrder = renderOrder;
    plane.frustumCulled = false;
    return plane;
  }
}

function createShellTexture(config, layer) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const center = TEXTURE_SIZE * 0.5;
  const scale = TEXTURE_SIZE * 0.5;

  canvas.width = TEXTURE_SIZE;
  canvas.height = TEXTURE_SIZE;
  context.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
  context.lineCap = 'round';
  context.lineJoin = 'round';

  for (let armIndex = 0; armIndex < 2; armIndex += 1) {
    if (layer === 'nebula') {
      drawSpiralStroke(context, config, armIndex, {
        center,
        scale,
        angleOffset: 0,
        lineWidth: 66,
        strokeStyle: armIndex === 0
          ? 'rgba(76, 116, 222, 0.1)'
          : 'rgba(141, 102, 215, 0.09)',
        shadowColor: armIndex === 0
          ? 'rgba(58, 147, 230, 0.14)'
          : 'rgba(128, 92, 211, 0.13)',
        shadowBlur: 42,
        gaps: true
      });
      drawSpiralStroke(context, config, armIndex, {
        center,
        scale,
        angleOffset: 0.018,
        lineWidth: 34,
        strokeStyle: 'rgba(104, 111, 220, 0.075)',
        shadowColor: 'rgba(82, 126, 222, 0.1)',
        shadowBlur: 24,
        gaps: true
      });
    } else if (layer === 'main') {
      drawSpiralStroke(context, config, armIndex, {
        center,
        scale,
        angleOffset: 0,
        lineWidth: 25,
        strokeStyle: armIndex === 0
          ? 'rgba(69, 181, 224, 0.11)'
          : 'rgba(104, 153, 232, 0.105)',
        shadowColor: 'rgba(83, 190, 236, 0.14)',
        shadowBlur: 20,
        gaps: true
      });
      drawSpiralStroke(context, config, armIndex, {
        center,
        scale,
        angleOffset: 0,
        lineWidth: 6,
        strokeStyle: 'rgba(143, 224, 255, 0.13)',
        shadowColor: 'rgba(112, 204, 255, 0.12)',
        shadowBlur: 10,
        gaps: true
      });
    } else {
      drawSpiralStroke(context, config, armIndex, {
        center,
        scale,
        angleOffset: -0.105,
        lineWidth: 17,
        strokeStyle: 'rgba(4, 15, 34, 0.52)',
        shadowColor: 'rgba(6, 20, 43, 0.26)',
        shadowBlur: 10,
        gaps: true
      });
    }
  }

  const texture = new THREE.CanvasTexture(canvas);

  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function drawSpiralStroke(context, config, armIndex, style) {
  const pointCount = 240;
  const baseAngle = armIndex * Math.PI;
  let previousX = 0;
  let previousY = 0;

  context.save();
  context.lineWidth = style.lineWidth;
  context.strokeStyle = style.strokeStyle;
  context.shadowColor = style.shadowColor;
  context.shadowBlur = style.shadowBlur;

  for (let index = 0; index < pointCount; index += 1) {
    const progress = index / (pointCount - 1);
    const radiusNoise = Math.sin(progress * TAU * 7.0 + armIndex * 1.7) * 0.004;
    const radius = config.innerRadius
      + (config.outerRadius - config.innerRadius) * Math.pow(progress, config.radiusExponent)
      + radiusNoise;
    const angleNoise = Math.sin(progress * TAU * 5.0 + armIndex * 2.1) * 0.0045;
    const angle = baseAngle + progress * TAU * config.turns + style.angleOffset + angleNoise;
    const outerFade = 1 - smootherstep(0.64, 0.88, progress);
    const midGap = smootherstep(0.45, 0.5, progress)
      * (1 - smootherstep(0.58, 0.64, progress));
    const gapFade = style.gaps ? 1 - midGap * 0.78 : 1;
    const cluster = 0.68 + Math.sin(progress * TAU * 4.0 + armIndex * 0.9) * 0.2;
    const segmentOpacity = outerFade * gapFade * cluster;
    const x = style.center + Math.cos(angle) * radius * style.scale;
    const y = style.center - Math.sin(angle) * radius * style.scale;

    if (index === 0) {
      previousX = x;
      previousY = y;
      continue;
    }

    if (segmentOpacity > 0.008) {
      context.globalAlpha = segmentOpacity;
      context.beginPath();
      context.moveTo(previousX, previousY);
      context.lineTo(x, y);
      context.stroke();
    }

    previousX = x;
    previousY = y;
  }
  context.restore();
}

function createShellMaterial(texture, opacity, blending) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity,
    alphaTest: 0.002,
    blending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
}

function smootherstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export const cinematicGalaxyShellFactory = {
  createCinematicGalaxyShell
};
