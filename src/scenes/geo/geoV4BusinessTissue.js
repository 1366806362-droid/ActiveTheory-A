import * as THREE from 'three';
import {
  createLabelSprite,
  seededRandom
} from './geoSignalCore.js';

const REGIONS = Object.freeze({
  answer: Object.freeze({
    colorA: '#54cbe9',
    colorB: '#e8fbff',
    seed: 9101,
    particleCount: 330,
    nodeCount: 42,
    lineOpacity: 0.28,
    pointOpacity: 0.88,
    title: ['AI ANSWER', 'AI 回答'],
    titlePosition: [-1.7, 0.95, 0.15],
    titleWidth: 0.98,
    aux: ['用户问题  ·  语义理解', '直接回答  ·  内容生成'],
    auxPosition: [-1.83, 0.12, 0.12]
  }),
  citation: Object.freeze({
    colorA: '#b6e3ed',
    colorB: '#9185c7',
    seed: 9201,
    particleCount: 245,
    nodeCount: 34,
    lineOpacity: 0.2,
    pointOpacity: 0.76,
    title: ['AI CITATION', 'AI 引用'],
    titlePosition: [1.4, 1.02, 0.08],
    titleWidth: 1.02,
    aux: ['权威来源  ·  媒体报道', '行业报告  ·  来源筛选'],
    auxPosition: [1.55, 0.08, 0.06]
  }),
  keyword: Object.freeze({
    colorA: '#1eb5cc',
    colorB: '#70e4ee',
    seed: 9301,
    particleCount: 285,
    nodeCount: 36,
    lineOpacity: 0.18,
    pointOpacity: 0.7,
    title: ['GEO KEYWORD', 'GEO 关键词'],
    titlePosition: [1.52, -0.95, 0.12],
    titleWidth: 1.12,
    aux: ['搜索意图  ·  机会词', '长尾词  ·  相关问题'],
    auxPosition: [1.58, -0.34, 0.08]
  })
});

export function createGeoV4BusinessTissue(resources, sharedField) {
  const group = new THREE.Group();
  const regions = Object.fromEntries(
    Object.entries(REGIONS).map(([key, definition]) => [
      key,
      createRegion(key, definition, sharedField, resources.pointTexture)
    ])
  );

  group.name = 'GEO V4 Business Density Inside Shared Tissue';
  Object.values(regions).forEach((region) => group.add(region.group));

  let debugRegion = 'full';
  applyDebugRegion();

  return {
    group,
    particleCount: Object.values(regions)
      .reduce((sum, region) => sum + region.particleCount, 0),
    regionOrigins: Object.fromEntries(
      Object.entries(sharedField.regions).map(([key, definition]) => [
        key,
        new THREE.Vector3(definition.center[0], definition.center[1], -0.42)
      ])
    ),
    setDebugRegion(region = 'full') {
      debugRegion = region;
      applyDebugRegion();
    },
    setLabelsVisible(visible) {
      Object.values(regions).forEach((region) => region.setLabelsVisible(visible));
    },
    update(time, reveal = 1, pointer = null) {
      Object.values(regions).forEach((region) => region.update(time, reveal));
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;
      const targetX = px * 0.0065;
      const targetY = -py * 0.0038;
      group.position.x += (targetX - group.position.x) * 0.03;
      group.position.y += (targetY - group.position.y) * 0.03;
    },
    dispose() {
      Object.values(regions).forEach((region) => region.dispose());
      group.clear();
    }
  };

  function applyDebugRegion() {
    const showAll = debugRegion === 'full'
      || debugRegion === 'tissue'
      || debugRegion === 'organism';
    Object.entries(regions).forEach(([key, region]) => {
      region.group.visible = showAll || debugRegion === key;
    });
  }
}

function createRegion(key, definition, field, texture) {
  const group = new THREE.Group();
  const paths = field.getRegionPaths(key);
  const lineGeometry = createRegionFiberGeometry(key, definition, paths, field);
  const lineMaterial = createRegionLineMaterial();
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  const particleGeometry = createRegionParticleGeometry(key, definition, paths, field);
  const particleMaterial = createRegionPointMaterial(texture);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  const title = createLabelSprite(
    definition.title[0],
    definition.title[1],
    definition.colorA,
    definition.titleWidth,
    true,
    { glowBlur: 4, titleAlpha: 0.88, subtitleAlpha: 0.6 }
  );
  const auxiliary = createLabelSprite(
    definition.aux[0],
    definition.aux[1],
    definition.colorA,
    definition.titleWidth * 0.9,
    true,
    { glowBlur: 2, titleAlpha: 0.62, subtitleAlpha: 0.48 }
  );

  group.name = `GEO V4 ${key} Density Region`;
  lines.name = `GEO V4 ${key} Embedded Local Fibers`;
  particles.name = `GEO V4 ${key} Embedded Tissue Nodes`;
  title.sprite.name = `GEO V4 ${key} Title`;
  auxiliary.sprite.name = `GEO V4 ${key} Semantics`;
  title.sprite.position.set(...definition.titlePosition);
  auxiliary.sprite.position.set(...definition.auxPosition);
  lines.renderOrder = 2;
  particles.renderOrder = 4;
  group.add(lines, particles, title.sprite, auxiliary.sprite);

  return {
    group,
    particleCount: definition.particleCount + definition.nodeCount,
    setLabelsVisible(visible) {
      title.sprite.visible = visible;
      auxiliary.sprite.visible = visible;
    },
    update(time, reveal) {
      const opacity = THREE.MathUtils.clamp(reveal, 0, 1);
      lineMaterial.uniforms.uOpacity.value = opacity * definition.lineOpacity;
      lineMaterial.uniforms.uTime.value = time;
      particleMaterial.uniforms.uTime.value = time;
      particleMaterial.uniforms.uOpacity.value = opacity * definition.pointOpacity;
      title.material.opacity = opacity * 0.75;
      auxiliary.material.opacity = opacity * 0.45;
    },
    dispose() {
      lineGeometry.dispose();
      lineMaterial.dispose();
      particleGeometry.dispose();
      particleMaterial.dispose();
      title.dispose();
      auxiliary.dispose();
      group.clear();
    }
  };
}

function createRegionFiberGeometry(key, definition, paths, field) {
  const positions = [];
  const colors = [];
  const alphas = [];
  const colorA = new THREE.Color(definition.colorA);
  const colorB = new THREE.Color(definition.colorB);

  paths.forEach((path, pathIndex) => {
    for (let index = 0; index < path.points.length - 1; index += 1) {
      const cadence = key === 'citation' ? 11 : key === 'keyword' ? 9 : 8;
      const visible = (index * 2 + pathIndex * 3) % cadence < (path.coreSeeking ? 2 : 5);
      if (!visible) continue;
      const a = path.points[index];
      const b = path.points[index + 1];
      const sample = field.sample(a.x, a.y, a.z);
      const color = colorA.clone().lerp(
        colorB,
        0.12 + sample.attraction * 0.38 + (pathIndex % 4) * 0.06
      );
      positions.push(a.x, a.y, a.z + 0.024, b.x, b.y, b.z + 0.024);
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
      const alpha = THREE.MathUtils.clamp(
        0.28 + sample.density * 0.42 + sample.attraction * 0.18,
        0.22,
        0.86
      ) * (1 - THREE.MathUtils.smoothstep(sample.attraction, 0.68, 0.95));
      alphas.push(alpha, alpha * 0.9);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(alphas, 1));
  return geometry;
}

function createRegionParticleGeometry(key, definition, paths, field) {
  const total = definition.particleCount + definition.nodeCount;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const densities = new Float32Array(total);
  const random = seededRandom(definition.seed);
  const colorA = new THREE.Color(definition.colorA);
  const colorB = new THREE.Color(definition.colorB);
  const regionDefinition = field.regions[key];
  const citationSources = [
    [regionDefinition.center[0] + 0.48, regionDefinition.center[1] + 0.34],
    [regionDefinition.center[0] + 0.52, regionDefinition.center[1] - 0.1],
    [regionDefinition.center[0] - 0.08, regionDefinition.center[1] - 0.18]
  ];
  const answerSources = [
    [regionDefinition.center[0] - 0.42, regionDefinition.center[1] + 0.32],
    [regionDefinition.center[0] + 0.12, regionDefinition.center[1] + 0.18],
    [regionDefinition.center[0] - 0.18, regionDefinition.center[1] - 0.3],
    [regionDefinition.center[0] + 0.46, regionDefinition.center[1] - 0.08]
  ];

  for (let index = 0; index < total; index += 1) {
    const isNode = index < definition.nodeCount;
    const areaChance = key === 'answer' ? 0.88 : key === 'citation' ? 0.84 : 0.68;
    const useArea = random() < areaChance;
    let point;
    let tangent;
    let fieldSample;
    let t = random();
    if (useArea) {
      const source = key === 'citation'
        ? citationSources[index % citationSources.length]
        : key === 'answer'
          ? answerSources[index % answerSources.length]
          : regionDefinition.center;
      const angle = random() * Math.PI * 2;
      const radius = Math.pow(random(), key === 'answer' ? 1.5 : 1.9);
      const radiusX = key === 'citation'
        ? 0.24
        : key === 'answer'
          ? 0.34
          : regionDefinition.radius[0] * 0.56;
      const radiusY = key === 'citation'
        ? 0.18
        : key === 'answer'
          ? 0.25
          : regionDefinition.radius[1] * 0.54;
      const x = source[0] + Math.cos(angle) * radiusX * radius;
      const y = source[1] + Math.sin(angle) * radiusY * radius;
      fieldSample = field.sample(x, y, -0.43);
      point = fieldSample.position.clone();
      tangent = fieldSample.tangent.clone();
    } else {
      const path = paths[Math.floor(random() * paths.length)];
      t = THREE.MathUtils.clamp(
        isNode
          ? (index * 0.173 + random() * 0.08) % 0.94
          : Math.pow(random(), key === 'answer' ? 1.08 : key === 'citation' ? 0.92 : 1),
        0.02,
        0.96
      );
      point = path.curve.getPoint(t);
      tangent = path.curve.getTangent(t);
      fieldSample = field.sample(point.x, point.y, point.z);
    }
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const spreadBase = key === 'answer' ? 0.12 : key === 'citation' ? 0.095 : 0.1;
    const spread = spreadBase * (0.34 + Math.sin(t * Math.PI) * 0.74);
    const lateral = (random() - 0.5) * spread * (isNode ? 0.28 : 1);
    point.addScaledVector(normal, lateral);
    point.z += (random() - 0.5) * spread * 0.8 + 0.035;
    const stride = index * 3;
    positions[stride] = point.x;
    positions[stride + 1] = point.y;
    positions[stride + 2] = point.z;
    const color = colorA.clone().lerp(
      colorB,
      isNode
        ? 0.66 + random() * 0.28
        : 0.08 + fieldSample.attraction * 0.38 + random() * 0.26
    );
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    const innerScale = 1 - THREE.MathUtils.smoothstep(fieldSample.attraction, 0.94, 0.999);
    const regionScale = key === 'answer' ? 1.2 : key === 'citation' ? 1.12 : 1.06;
    sizes[index] = (isNode
      ? 1.08 + random() * 1.16
      : 0.38 + random() * 0.68) * (0.46 + innerScale * 0.54) * regionScale;
    phases[index] = random() * Math.PI * 2;
    densities[index] = fieldSample.density;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aDensity', new THREE.BufferAttribute(densities, 1));
  return geometry;
}

function createRegionLineMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 }
    },
    vertexShader: `
      attribute float aAlpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = aAlpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float alpha = uOpacity * vAlpha * (0.92 + sin(uTime * 0.06 + vAlpha * 7.0) * 0.08);
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
}

function createRegionPointMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      attribute float aDensity;
      varying vec3 vColor;
      varying float vPulse;
      uniform float uTime;
      void main() {
        vec3 displaced = position;
        displaced.z += sin(uTime * 0.09 + aPhase) * 0.004;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vColor = color;
        vPulse = 0.7 + aDensity * 0.18 + sin(uTime * 0.24 + aPhase * 2.0) * 0.12;
        gl_PointSize = aSize * (17.0 / max(-viewPosition.z, 1.0));
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uOpacity;
      uniform sampler2D uPointTexture;
      varying vec3 vColor;
      varying float vPulse;
      void main() {
        float alpha = texture2D(uPointTexture, gl_PointCoord).a * uOpacity * vPulse;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false
  });
}
