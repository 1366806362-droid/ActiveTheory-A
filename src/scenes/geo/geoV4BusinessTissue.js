import * as THREE from 'three';
import {
  createLabelSprite,
  seededRandom
} from './geoSignalCore.js';
import {
  GEO_V4_TISSUE_FIELD,
  createGeoV4TissueCurve
} from './geoV4OrganicEnvironment.js';

const REGIONS = Object.freeze({
  answer: Object.freeze({
    field: GEO_V4_TISSUE_FIELD.answer,
    colorA: '#56cfee',
    colorB: '#e7fbff',
    seed: 5101
  }),
  citation: Object.freeze({
    field: GEO_V4_TISSUE_FIELD.citation,
    colorA: '#a8d9ea',
    colorB: '#9688d0',
    seed: 5201
  }),
  keyword: Object.freeze({
    field: GEO_V4_TISSUE_FIELD.keyword,
    colorA: '#20bcd5',
    colorB: '#70e7f2',
    seed: 5301
  })
});

export function createGeoV4BusinessTissue(resources) {
  const group = new THREE.Group();
  const answer = createAnswerTissue(resources.pointTexture);
  const citation = createCitationTissue(resources.pointTexture);
  const keyword = createKeywordTissue(resources.pointTexture);

  group.name = 'GEO V4 Embedded Business Tissue';
  group.add(answer.group, citation.group, keyword.group);

  let debugRegion = 'full';
  applyDebugRegion();

  return {
    group,
    particleCount: answer.particleCount + citation.particleCount + keyword.particleCount,
    regionOrigins: {
      answer: new THREE.Vector3(...REGIONS.answer.field.origin),
      citation: new THREE.Vector3(...REGIONS.citation.field.origin),
      keyword: new THREE.Vector3(...REGIONS.keyword.field.origin)
    },
    setDebugRegion(region = 'full') {
      debugRegion = region;
      applyDebugRegion();
    },
    setLabelsVisible(visible) {
      answer.setLabelsVisible(visible);
      citation.setLabelsVisible(visible);
      keyword.setLabelsVisible(visible);
    },
    update(time, reveal = 1, pointer = null) {
      answer.update(time, reveal, pointer);
      citation.update(time, reveal, pointer);
      keyword.update(time, reveal, pointer);
    },
    dispose() {
      answer.dispose();
      citation.dispose();
      keyword.dispose();
      group.clear();
    }
  };

  function applyDebugRegion() {
    const full = debugRegion === 'full'
      || debugRegion === 'tissue'
      || debugRegion === 'organism';
    answer.group.visible = full || debugRegion === 'answer';
    citation.group.visible = full || debugRegion === 'citation';
    keyword.group.visible = full || debugRegion === 'keyword';
  }
}

function createAnswerTissue(texture) {
  return createRegion({
    name: 'ANSWER',
    definition: REGIONS.answer,
    texture,
    particleCount: 330,
    nodeCount: 42,
    lineOpacity: 0.27,
    pointOpacity: 0.8,
    sourceDensity: 1.22,
    title: ['AI ANSWER', 'AI 回答'],
    titlePosition: [-1.7, 0.95, 0.15],
    titleWidth: 0.98,
    aux: ['用户问题  ·  语义理解', '直接回答  ·  内容生成'],
    auxPosition: [-1.83, 0.12, 0.12],
    parallax: 0.012
  });
}

function createCitationTissue(texture) {
  return createRegion({
    name: 'CITATION',
    definition: REGIONS.citation,
    texture,
    particleCount: 245,
    nodeCount: 34,
    lineOpacity: 0.2,
    pointOpacity: 0.7,
    sourceDensity: 0.9,
    title: ['AI CITATION', 'AI 引用'],
    titlePosition: [1.4, 1.02, 0.08],
    titleWidth: 1.02,
    aux: ['权威来源  ·  媒体报道', '行业报告  ·  来源筛选'],
    auxPosition: [1.55, 0.08, 0.06],
    parallax: 0.014
  });
}

function createKeywordTissue(texture) {
  return createRegion({
    name: 'KEYWORD',
    definition: REGIONS.keyword,
    texture,
    particleCount: 285,
    nodeCount: 36,
    lineOpacity: 0.22,
    pointOpacity: 0.72,
    sourceDensity: 1,
    title: ['GEO KEYWORD', 'GEO 关键词'],
    titlePosition: [1.52, -0.95, 0.12],
    titleWidth: 1.12,
    aux: ['搜索意图  ·  机会词', '长尾词  ·  相关问题'],
    auxPosition: [1.58, -0.34, 0.08],
    parallax: 0.016
  });
}

function createRegion(options) {
  const group = new THREE.Group();
  const random = seededRandom(options.definition.seed);
  const curves = options.definition.field.branches.map(createGeoV4TissueCurve);
  const lineGeometry = buildTissueFiberGeometry(
    curves,
    options.definition.colorA,
    options.definition.colorB,
    random
  );
  const lineMaterial = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  const particleGeometry = buildEmbeddedParticles(
    curves,
    options.particleCount,
    options.nodeCount,
    options.definition.colorA,
    options.definition.colorB,
    options.sourceDensity,
    options.name.toLowerCase(),
    options.definition.field.origin,
    random
  );
  const particleMaterial = createTissuePointMaterial(options.texture);
  const particles = new THREE.Points(particleGeometry, particleMaterial);
  const title = createLabelSprite(
    options.title[0],
    options.title[1],
    options.definition.colorA,
    options.titleWidth,
    true,
    { glowBlur: 4, titleAlpha: 0.88, subtitleAlpha: 0.6 }
  );
  const auxiliary = createLabelSprite(
    options.aux[0],
    options.aux[1],
    options.definition.colorA,
    options.titleWidth * 0.9,
    true,
    { glowBlur: 2, titleAlpha: 0.62, subtitleAlpha: 0.48 }
  );

  group.name = `GEO V4 ${options.name} Embedded Neural Tissue`;
  lines.name = `${group.name} Curved Fibers`;
  particles.name = `${group.name} Tissue Nodes`;
  title.sprite.name = `${group.name} Title`;
  auxiliary.sprite.name = `${group.name} Semantics`;
  title.sprite.position.set(...options.titlePosition);
  auxiliary.sprite.position.set(...options.auxPosition);
  lines.renderOrder = 0;
  particles.renderOrder = 2;
  group.add(lines, particles, title.sprite, auxiliary.sprite);

  return {
    group,
    particleCount: options.particleCount + options.nodeCount,
    setLabelsVisible(visible) {
      title.sprite.visible = visible;
      auxiliary.sprite.visible = visible;
    },
    update(time, reveal, pointer) {
      const opacity = THREE.MathUtils.clamp(reveal, 0, 1);
      lineMaterial.opacity = opacity * options.lineOpacity;
      particleMaterial.uniforms.uTime.value = time;
      particleMaterial.uniforms.uOpacity.value = opacity * options.pointOpacity;
      title.material.opacity = opacity * 0.75;
      auxiliary.material.opacity = opacity * 0.45;
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;
      group.position.x += (px * options.parallax - group.position.x) * 0.035;
      group.position.y += (-py * options.parallax * 0.55 - group.position.y) * 0.035;
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

function buildTissueFiberGeometry(curves, colorA, colorB, random) {
  const positions = [];
  const colors = [];
  const startColor = new THREE.Color(colorA);
  const endColor = new THREE.Color(colorB);
  const color = new THREE.Color();

  curves.forEach((curve, curveIndex) => {
    const feeder = curveIndex === curves.length - 1;
    const segments = feeder ? 38 : 28;
    for (let index = 0; index < segments; index += 1) {
      if ((index + curveIndex * 4) % (feeder ? 9 : 13) >= (feeder ? 6 : 11)) continue;
      const t0 = index / segments;
      if (feeder && t0 < 0.34) continue;
      const t1 = Math.min(1, (index + (feeder ? 0.62 : 0.78)) / segments);
      const p0 = curve.getPoint(t0);
      const p1 = curve.getPoint(t1);
      positions.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z);
      color.copy(startColor).lerp(
        endColor,
        (feeder ? 0.2 : 0.34) + t0 * 0.34 + random() * 0.14
      );
      colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}

function buildEmbeddedParticles(
  curves,
  count,
  nodeCount,
  colorA,
  colorB,
  sourceDensity,
  regionKey,
  origin,
  random
) {
  const total = count + nodeCount;
  const positions = new Float32Array(total * 3);
  const colors = new Float32Array(total * 3);
  const sizes = new Float32Array(total);
  const phases = new Float32Array(total);
  const startColor = new THREE.Color(colorA);
  const endColor = new THREE.Color(colorB);
  const color = new THREE.Color();
  const localCurveCount = Math.max(1, curves.length - 1);
  const originPoint = new THREE.Vector3(...origin);
  const citationSources = [
    new THREE.Vector3(2.2, 1.02, -0.42),
    new THREE.Vector3(2.28, 0.58, -0.38),
    new THREE.Vector3(1.92, 0.25, -0.3)
  ];

  for (let index = 0; index < total; index += 1) {
    const isNode = index < nodeCount;
    const sourceClusterChance = regionKey === 'answer' ? 0.4 : regionKey === 'citation' ? 0.28 : 0.12;
    const useSourceCluster = random() < sourceClusterChance;
    const useFeeder = !isNode && !useSourceCluster && random() > 0.91;
    const curveIndex = useFeeder
      ? curves.length - 1
      : Math.floor(random() * localCurveCount);
    const curve = curves[curveIndex];
    const rawT = isNode
      ? ((index * 0.217 + random() * 0.09) % 1)
      : random();
    const t = useFeeder ? Math.pow(rawT, 0.82) : Math.pow(rawT, sourceDensity);
    const point = curve.getPoint(t);
    const tangent = curve.getTangent(t);
    const normal = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
    const spread = isNode ? 0.014 : useFeeder ? 0.032 : 0.035 + random() * 0.075;
    if (useSourceCluster) {
      const source = regionKey === 'citation'
        ? citationSources[index % citationSources.length]
        : originPoint;
      const angle = random() * Math.PI * 2;
      const radius = Math.pow(random(), 1.7)
        * (regionKey === 'answer' ? 0.22 : regionKey === 'citation' ? 0.13 : 0.16);
      point.copy(source);
      point.x += Math.cos(angle) * radius;
      point.y += Math.sin(angle) * radius * (regionKey === 'answer' ? 0.78 : 0.92);
      point.z += (random() - 0.5) * radius * 0.9;
    } else {
      point.addScaledVector(normal, (random() - 0.5) * spread);
      point.z += (random() - 0.5) * spread * 1.35;
    }
    const stride = index * 3;
    positions[stride] = point.x;
    positions[stride + 1] = point.y;
    positions[stride + 2] = point.z;
    color.copy(startColor).lerp(
      endColor,
      isNode || useSourceCluster ? 0.62 + random() * 0.32 : 0.08 + random() * 0.58
    );
    colors[stride] = color.r;
    colors[stride + 1] = color.g;
    colors[stride + 2] = color.b;
    sizes[index] = isNode
      ? 1.3 + random() * 1.35
      : useSourceCluster
        ? 0.58 + random() * 0.9
        : 0.42 + random() * 0.72;
    phases[index] = random() * Math.PI * 2;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return geometry;
}

function createTissuePointMaterial(texture) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPointTexture: { value: texture }
    },
    vertexShader: `
      attribute float aSize;
      attribute float aPhase;
      varying vec3 vColor;
      varying float vPulse;
      uniform float uTime;
      void main() {
        vec3 displaced = position;
        displaced.z += sin(uTime * 0.12 + aPhase) * 0.006;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vColor = color;
        vPulse = 0.78 + sin(uTime * 0.28 + aPhase * 2.0) * 0.22;
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
