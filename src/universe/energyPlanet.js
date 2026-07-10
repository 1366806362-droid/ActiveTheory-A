import * as THREE from 'three';

export function createEnergyPlanetResources() {
  const sphereGeometry = new THREE.SphereGeometry(1, 24, 16);
  const wireGeometries = [0, 1, 2].map((detail) => (
    new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, detail))
  ));
  const particleTexture = createRadialTexture(64, [
    [0, 'rgba(255,255,255,1)'],
    [0.24, 'rgba(220,248,255,0.95)'],
    [0.64, 'rgba(90,190,255,0.28)'],
    [1, 'rgba(0,0,0,0)']
  ]);
  const glowTexture = createRadialTexture(128, [
    [0, 'rgba(255,255,255,0.3)'],
    [0.16, 'rgba(150,230,255,0.24)'],
    [0.48, 'rgba(45,150,255,0.1)'],
    [1, 'rgba(0,0,0,0)']
  ]);
  const timeUniform = { value: 0 };

  return {
    sphereGeometry,
    wireGeometries,
    particleTexture,
    glowTexture,
    timeUniform,
    dispose() {
      sphereGeometry.dispose();
      wireGeometries.forEach((geometry) => geometry.dispose());
      particleTexture.dispose();
      glowTexture.dispose();
    }
  };
}

export function createEnergyPlanet(config, resources) {
  const group = new THREE.Group();
  const particles = createParticleCore(config, resources.particleTexture);
  const wireLayers = createWireLayers(config, resources.wireGeometries);
  const fogMaterial = createEnergyFogMaterial(config, resources.timeUniform);
  const atmosphereMaterial = createFresnelMaterial(config, resources.timeUniform);
  const fog = new THREE.Mesh(resources.sphereGeometry, fogMaterial);
  const atmosphere = new THREE.Mesh(resources.sphereGeometry, atmosphereMaterial);
  const glowMaterial = new THREE.SpriteMaterial({
    map: resources.glowTexture,
    color: config.glowColor,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
  const glow = new THREE.Sprite(glowMaterial);
  const baseGlowScale = config.radius * 3.05;

  group.name = config.name;
  fog.scale.setScalar(config.radius * 0.76);
  atmosphere.scale.setScalar(config.radius * 1.07);
  glow.scale.setScalar(baseGlowScale);
  group.add(glow, fog, particles.points, ...wireLayers.lines, atmosphere);

  return {
    group,
    update(time, reveal) {
      const revealState = typeof reveal === 'number'
        ? { core: reveal, wire: reveal, atmosphere: reveal, glow: reveal }
        : reveal;
      const coreReveal = revealState?.core ?? 0;
      const wireReveal = revealState?.wire ?? 0;
      const atmosphereReveal = revealState?.atmosphere ?? 0;
      const glowReveal = revealState?.glow ?? 0;
      const visibleReveal = Math.max(coreReveal, wireReveal, atmosphereReveal, glowReveal);
      const pulse = 0.5 + Math.sin(time * config.pulseSpeed) * 0.5;
      const breathing = 1 + pulse * 0.025;

      group.scale.setScalar(breathing * THREE.MathUtils.lerp(0.72, 1, visibleReveal));
      particles.points.rotation.y = time * config.rotationSpeed;
      particles.points.rotation.z = -time * config.rotationSpeed * 0.62;
      particles.material.opacity = coreReveal * (0.62 + pulse * 0.18) * config.intensity;
      particles.material.size = config.radius * (0.055 + pulse * 0.008);
      wireLayers.lines[0].rotation.set(
        time * config.rotationSpeed * 0.42,
        time * config.rotationSpeed * 0.76,
        -time * config.rotationSpeed * 0.28
      );
      wireLayers.lines[1].rotation.set(
        -time * config.rotationSpeed * 0.31,
        time * config.rotationSpeed * 0.38,
        time * config.rotationSpeed * 0.54
      );
      wireLayers.lines[2].rotation.set(
        time * config.rotationSpeed * 0.24,
        -time * config.rotationSpeed * 0.34,
        time * config.rotationSpeed * 0.19
      );
      wireLayers.materials[0].opacity = wireReveal * (0.46 + pulse * 0.08) * config.intensity;
      wireLayers.materials[1].opacity = wireReveal * (0.58 + pulse * 0.1) * config.intensity;
      wireLayers.materials[2].opacity = wireReveal * (0.38 + pulse * 0.07) * config.intensity;
      fogMaterial.uniforms.uOpacity.value = coreReveal * (0.12 + pulse * 0.025) * config.intensity;
      atmosphereMaterial.uniforms.uOpacity.value = atmosphereReveal * (0.44 + pulse * 0.08) * config.intensity;
      glowMaterial.opacity = glowReveal * (0.12 + pulse * 0.025) * config.intensity;
      glow.scale.setScalar(baseGlowScale * (1 + pulse * 0.035));
    },
    dispose() {
      particles.dispose();
      wireLayers.dispose();
      fogMaterial.dispose();
      atmosphereMaterial.dispose();
      glowMaterial.dispose();
      group.clear();
    }
  };
}

function createParticleCore(config, texture) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(config.particleCount * 3);
  const colors = new Float32Array(config.particleCount * 3);
  const random = seededRandom(config.seed);
  const centerColor = new THREE.Color(0xeafcff);
  const edgeColor = new THREE.Color(config.coreColor);
  const color = new THREE.Color();

  for (let index = 0; index < config.particleCount; index += 1) {
    const stride = index * 3;
    const radiusRatio = Math.pow(random(), 2.15);
    const radius = radiusRatio * config.radius * 0.62;
    const azimuth = random() * Math.PI * 2;
    const cosine = random() * 2 - 1;
    const sine = Math.sqrt(1 - cosine * cosine);

    positions[stride] = Math.cos(azimuth) * sine * radius;
    positions[stride + 1] = cosine * radius;
    positions[stride + 2] = Math.sin(azimuth) * sine * radius;
    color.copy(centerColor).lerp(edgeColor, radiusRatio * 0.88);
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    map: texture,
    vertexColors: true,
    size: config.radius * 0.06,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
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

function createWireLayers(config, geometries) {
  const scales = [0.68, 0.84, 1];
  const colors = [config.coreColor, config.wireColor, config.atmosphereColor];
  const materials = colors.map((color) => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  }));
  const lines = geometries.map((geometry, index) => {
    const line = new THREE.LineSegments(geometry, materials[index]);

    line.scale.setScalar(config.radius * scales[index]);
    return line;
  });

  return {
    lines,
    materials,
    dispose() {
      materials.forEach((material) => material.dispose());
    }
  };
}

function createEnergyFogMaterial(config, timeUniform) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(config.coreColor) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vPosition;

      void main() {
        float flow = sin(vPosition.y * 7.0 + uTime * 0.28 + sin(vPosition.x * 6.0));
        float density = 0.46 + flow * 0.12;
        float center = pow(max(vNormal.z, 0.0), 1.8);
        gl_FragColor = vec4(uColor, uOpacity * density * (0.72 + center * 0.28));
      }
    `,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending
  });
}

function createFresnelMaterial(config, timeUniform) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: timeUniform,
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(config.atmosphereColor) }
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform vec3 uColor;
      varying vec3 vNormal;
      varying vec3 vViewDirection;

      void main() {
        float fresnel = pow(1.0 - max(dot(vNormal, vViewDirection), 0.0), 3.2);
        float pulse = 0.94 + sin(uTime * 0.34) * 0.06;
        gl_FragColor = vec4(uColor, fresnel * uOpacity * pulse);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
}

function createRadialTexture(size, stops) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const center = size * 0.5;
  const gradient = context.createRadialGradient(center, center, 0, center, center, center);

  stops.forEach(([position, color]) => gradient.addColorStop(position, color));
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

export const energyPlanetFactory = {
  createEnergyPlanet,
  createEnergyPlanetResources
};
