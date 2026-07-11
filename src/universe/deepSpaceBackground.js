import * as THREE from 'three';

const FAR_STAR_COUNT = 920;
const NEAR_PARTICLE_COUNT = 16;

export function createDeepSpaceBackground(nebulaVolume) {
  const group = new THREE.Group();
  const colorField = createColorField();
  const farStars = createFarStars();
  const starRiver = createDistantStarRiver();
  const nearParticles = createNearParticles();
  const targetColor = new THREE.Color(0x087f99);

  group.name = 'DeepSpaceBackground';
  group.add(
    colorField.mesh,
    farStars.points,
    starRiver.points,
    nebulaVolume.backgroundGroup,
    nearParticles.points
  );

  function update({
    delta,
    time,
    cameraPosition,
    cameraQuaternion,
    mouseParallax,
    journeyProgress = 0,
    targetGalaxyColor,
    exposureMultiplier = 1
  }) {
    if (document.hidden) {
      return;
    }

    const parallaxX = mouseParallax?.x ?? 0;
    const parallaxY = mouseParallax?.y ?? 0;

    if (targetGalaxyColor) {
      targetColor.set(targetGalaxyColor);
    }

    colorField.update(time, journeyProgress, targetColor, exposureMultiplier);
    farStars.update(time, parallaxX * 0.006, parallaxY * 0.006);
    starRiver.update(time, parallaxX * 0.012, parallaxY * 0.01);
    nearParticles.update(delta, time, parallaxX * 0.068, parallaxY * 0.054, journeyProgress);

    // Keep the API camera-aware without coupling the background to camera ownership.
    if (cameraPosition && cameraQuaternion) {
      group.userData.cameraZ = cameraPosition.z ?? 0;
    }
  }

  function dispose() {
    colorField.dispose();
    farStars.dispose();
    starRiver.dispose();
    nearParticles.dispose();
    group.clear();
  }

  return { group, update, dispose };
}

function createDistantStarRiver() {
  const count = 320;
  const random = seededRandom(714031);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const twinkle = new Float32Array(count);
  const cool = new THREE.Color(0x5cbcff);
  const violet = new THREE.Color(0x8f78e8);
  const white = new THREE.Color(0xdff6ff);
  const color = new THREE.Color();

  for (let index = 0; index < count; index += 1) {
    const stride = index * 3;
    const t = random();
    const centerX = -6.6 + t * 13.2;
    const centerY = -1.25 + t * 3.8 + Math.sin(t * Math.PI * 2.2) * 0.24;
    const spread = (random() - 0.5) * (0.38 + Math.sin(t * Math.PI) * 0.82);

    positions[stride] = centerX + spread * 0.55;
    positions[stride + 1] = centerY + spread;
    positions[stride + 2] = -13 - random() * 7;
    color.copy(cool).lerp(violet, random() * 0.58);
    color.lerp(white, random() > 0.9 ? 0.42 : 0.08);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = 0.28 + random() * 0.58;
    twinkle[index] = random() > 0.98 ? random() * 0.4 : 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 1));
  const material = createStarMaterial(0.16);
  const points = new THREE.Points(geometry, material);

  points.name = 'DeepSpaceDistantStarRiver';
  points.renderOrder = -19;

  return {
    points,
    update(time, x, y) {
      material.uniforms.uTime.value = time;
      points.position.x = x;
      points.position.y = y;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createColorField() {
  const geometry = new THREE.SphereGeometry(32, 28, 18);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uJourney: { value: 0 },
      uExposure: { value: 1 },
      uTargetColor: { value: new THREE.Color(0x087f99) }
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
      uniform float uJourney;
      uniform float uExposure;
      uniform vec3 uTargetColor;
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
          mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x), mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
          mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x), mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
          f.z
        );
      }

      float fbm(vec3 p) {
        float value = 0.0;
        float amplitude = 0.52;
        for (int i = 0; i < 5; i++) {
          value += noise(p) * amplitude;
          p = p * 2.03 + vec3(5.1, 2.7, 7.3);
          amplitude *= 0.49;
        }
        return value;
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float drift = uTime * 0.0012;
        vec3 warp = vec3(
          fbm(direction * 1.2 + vec3(drift, 0.0, 2.4)),
          fbm(direction * 1.35 + vec3(4.2, -drift, 0.0)),
          fbm(direction * 1.18 + vec3(0.0, 6.1, drift))
        ) - 0.5;
        float field = fbm(direction * 2.2 + warp * 0.58);
        float detail = fbm(direction * 5.1 - warp * 0.26);
        float cyanRegion = smoothstep(0.54, 0.86, field * 0.78 + detail * 0.22);
        float violetRegion = smoothstep(0.48, 0.82, fbm(direction * 2.7 + vec3(3.5, 1.7, -2.8)));
        vec3 deep = mix(vec3(0.008, 0.027, 0.086), vec3(0.012, 0.067, 0.173), field);
        vec3 violet = vec3(0.082, 0.055, 0.235);
        vec3 cyan = mix(vec3(0.024, 0.216, 0.373), uTargetColor, uJourney * 0.55);
        vec3 color = mix(deep, violet, violetRegion * 0.3);
        color = mix(color, cyan, cyanRegion * (0.19 + uJourney * 0.08));
        color *= 0.62 + uExposure * 0.08;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false
  });
  const mesh = new THREE.Mesh(geometry, material);

  mesh.name = 'DeepSpaceColorField';
  mesh.renderOrder = -30;

  return {
    mesh,
    update(time, journey, targetColor, exposure) {
      material.uniforms.uTime.value = time;
      material.uniforms.uJourney.value = journey;
      material.uniforms.uTargetColor.value.copy(targetColor);
      material.uniforms.uExposure.value = exposure;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createFarStars() {
  const random = seededRandom(220719);
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(FAR_STAR_COUNT * 3);
  const colors = new Float32Array(FAR_STAR_COUNT * 3);
  const sizes = new Float32Array(FAR_STAR_COUNT);
  const twinkle = new Float32Array(FAR_STAR_COUNT);
  const palette = [0xeaf7ff, 0xd1eaff, 0x8fd8ff, 0xffefd5, 0xb6a7ff];
  const color = new THREE.Color();

  for (let index = 0; index < FAR_STAR_COUNT; index += 1) {
    const stride = index * 3;
    const cluster = index % 7 === 0;
    const sparseGap = random() < 0.22;
    const width = sparseGap ? 30 : 19;
    const height = sparseGap ? 17 : 11;
    const palettePick = random();
    const colorIndex = palettePick < 0.55 ? 0 : palettePick < 0.8 ? 1 : palettePick < 0.92 ? 2 : palettePick < 0.98 ? 3 : 4;

    positions[stride] = (random() - 0.5) * width + (cluster ? Math.sin(index * 0.31) * 2.4 : 0);
    positions[stride + 1] = (random() - 0.5) * height + (cluster ? Math.cos(index * 0.23) * 1.2 : 0);
    positions[stride + 2] = -8 - random() * 20;
    color.set(palette[colorIndex]);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = 0.42 + Math.pow(random(), 2.4) * 1.18;
    twinkle[index] = random() > 0.965 ? random() : 0;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aTwinkle', new THREE.BufferAttribute(twinkle, 1));
  const material = createStarMaterial(0.42);
  const points = new THREE.Points(geometry, material);

  points.name = 'DeepSpaceFarStars';
  points.renderOrder = -20;

  return {
    points,
    update(time, x, y) {
      material.uniforms.uTime.value = time;
      points.position.x = x;
      points.position.y = y;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
    }
  };
}

function createNearParticles() {
  const random = seededRandom(94107);
  const texture = createSoftParticleTexture();
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(NEAR_PARTICLE_COUNT * 3);

  for (let index = 0; index < NEAR_PARTICLE_COUNT; index += 1) {
    const stride = index * 3;
    const side = index % 2 === 0 ? -1 : 1;

    positions[stride] = side * (3.1 + random() * 3.4);
    positions[stride + 1] = (random() - 0.5) * 5.4;
    positions[stride + 2] = 0.2 - random() * 2.8;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    color: 0x79cfff,
    size: 0.085,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.095,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    fog: false
  });
  const points = new THREE.Points(geometry, material);

  points.name = 'DeepSpaceNearBokeh';

  return {
    points,
    update(delta, time, x, y, journey) {
      points.position.x = x;
      points.position.y = y;
      points.rotation.z += delta * 0.0028;
      points.position.z = Math.sin(time * 0.018) * 0.08;
      material.opacity = 0.07 + journey * 0.045;
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      texture.dispose();
    }
  };
}

function createStarMaterial(opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aTwinkle;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vColor = color;
        vTwinkle = aTwinkle;
        gl_PointSize = aSize * (42.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vTwinkle;

      void main() {
        vec2 uv = gl_PointCoord - 0.5;
        float alpha = smoothstep(0.5, 0.08, length(uv));
        float twinkle = 1.0 + sin(uTime * (0.08 + vTwinkle * 0.06) + vTwinkle * 17.0) * vTwinkle * 0.05;
        gl_FragColor = vec4(vColor, alpha * uOpacity * twinkle);
      }
    `,
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    fog: false,
    toneMapped: true
  });
}

function createSoftParticleTexture() {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const size = 64;
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);

  canvas.width = size;
  canvas.height = size;
  gradient.addColorStop(0, 'rgba(255,255,255,0.44)');
  gradient.addColorStop(0.34, 'rgba(130,210,255,0.18)');
  gradient.addColorStop(1, 'rgba(0,0,0,0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  return new THREE.CanvasTexture(canvas);
}

function seededRandom(seed) {
  let value = seed;

  return function random() {
    value = (value * 1664525 + 1013904223) % 4294967296;
    return value / 4294967296;
  };
}

export const deepSpaceBackgroundFactory = {
  createDeepSpaceBackground
};
