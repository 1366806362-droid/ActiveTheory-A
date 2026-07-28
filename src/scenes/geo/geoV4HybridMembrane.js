import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const ASSET_PATH = 'models/geo/v4/geo-v4-hybrid-membrane.glb';
const LAYER_DEFINITIONS = Object.freeze({
  rear: Object.freeze({
    match: 'Rear_',
    opacity: 0.09,
    parallaxX: 0.014,
    parallaxY: 0.008,
    detail: 0.34,
    nodeSize: 1.55,
    renderOrder: 0
  }),
  mid: Object.freeze({
    match: 'Mid_',
    opacity: 0.19,
    parallaxX: 0.026,
    parallaxY: 0.015,
    detail: 0.78,
    nodeSize: 2.15,
    renderOrder: 1
  }),
  foreground: Object.freeze({
    match: 'Foreground_',
    opacity: 0.105,
    parallaxX: 0.058,
    parallaxY: 0.034,
    detail: 0.18,
    nodeSize: 1.65,
    renderOrder: 7
  })
});

let assetBufferPromise = null;
let assetNetworkLoads = 0;

export function createGeoV4HybridMembrane(resources, sharedField) {
  const group = new THREE.Group();
  const rear = new THREE.Group();
  const mid = new THREE.Group();
  const foreground = new THREE.Group();
  const layerGroups = { rear, mid, foreground };
  const meshRecords = [];
  const nodeRecords = [];
  const layerMaterials = new Map();
  const loader = new GLTFLoader();
  const status = {
    hybridEnabled: true,
    hybridAssetLoaded: false,
    hybridLoadError: null,
    hybridNetworkLoads: assetNetworkLoads,
    hybridInstances: 1,
    hybridMeshCount: 0,
    hybridTriangleCount: 0,
    hybridVertexCount: 0,
    hybridDrawCalls: 0,
    hybridGeometryCount: 0,
    hybridMaterialCount: 0,
    hybridAssetBytes: 0
  };
  let debugLayer = 'full';
  let disposed = false;

  group.name = 'GEO V4 Hybrid Organic Membrane';
  rear.name = 'GEO V4 Hybrid Rear Canopy';
  mid.name = 'GEO V4 Hybrid Mid Tissue';
  foreground.name = 'GEO V4 Hybrid Foreground Veil';
  group.add(rear, mid, foreground);
  applyDebugLayer();

  const ready = getAssetBuffer()
    .then(async (buffer) => {
      status.hybridAssetBytes = buffer.byteLength;
      const gltf = await loader.parseAsync(buffer.slice(0), '');
      if (disposed) {
        disposeScene(gltf.scene);
        return;
      }
      installScene(gltf.scene);
      status.hybridAssetLoaded = true;
      status.hybridNetworkLoads = assetNetworkLoads;
    })
    .catch((error) => {
      status.hybridLoadError = error instanceof Error ? error.message : String(error);
      console.error('[GEO V4 Hybrid] Failed to load membrane asset', error);
    });

  return {
    group,
    ready,
    particleCount: 0,
    segmentCount: 0,
    foregroundParticleCount: 0,
    diagnostics: status,
    setDebugLayer(layer = 'full') {
      debugLayer = layer;
      applyDebugLayer();
    },
    update(time, reveal = 1, pointer = null) {
      const opacity = THREE.MathUtils.clamp(reveal, 0, 1);
      const px = pointer?.x ?? 0;
      const py = pointer?.y ?? 0;
      updateLayer(rear, LAYER_DEFINITIONS.rear, px, py, time);
      updateLayer(mid, LAYER_DEFINITIONS.mid, px, py, time);
      updateLayer(foreground, LAYER_DEFINITIONS.foreground, px, py, time);
      for (let index = 0; index < meshRecords.length; index += 1) {
        const uniforms = meshRecords[index].material.uniforms;
        uniforms.uTime.value = time;
        uniforms.uReveal.value = opacity;
        uniforms.uPointer.value.set(px, py);
      }
      for (let index = 0; index < nodeRecords.length; index += 1) {
        nodeRecords[index].material.uniforms.uTime.value = time;
        nodeRecords[index].material.uniforms.uReveal.value = opacity;
      }
      if (window.__GEO_V4_STATUS__) {
        Object.assign(window.__GEO_V4_STATUS__, status);
      }
    },
    dispose() {
      disposed = true;
      for (let index = 0; index < meshRecords.length; index += 1) {
        meshRecords[index].mesh.geometry.dispose();
      }
      for (const material of layerMaterials.values()) material.dispose();
      for (let index = 0; index < nodeRecords.length; index += 1) {
        nodeRecords[index].points.geometry.dispose();
        nodeRecords[index].material.dispose();
      }
      meshRecords.length = 0;
      nodeRecords.length = 0;
      group.clear();
    }
  };

  function installScene(scene) {
    const meshes = [];
    scene.traverse((child) => {
      if (child.isMesh) meshes.push(child);
    });

    for (let index = 0; index < meshes.length; index += 1) {
      const mesh = meshes[index];
      const sourceName = mesh.name;
      const layerKey = resolveLayerKey(mesh.name);
      const definition = LAYER_DEFINITIONS[layerKey];
      const originalMaterial = mesh.material;
      let material = layerMaterials.get(layerKey);
      if (!material) {
        material = createHybridMaterial(definition, layerKey, sharedField);
        layerMaterials.set(layerKey, material);
      }
      mesh.removeFromParent();
      mesh.material = material;
      mesh.name = `GEO V4 Hybrid ${sourceName}`;
      mesh.renderOrder = definition.renderOrder;
      mesh.frustumCulled = false;
      mesh.geometry.computeBoundingBox();
      mesh.geometry.computeBoundingSphere();
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      mesh.userData.geoV4IslandOpacity = Number.isFinite(mesh.userData.geoV4Opacity)
        ? THREE.MathUtils.clamp(mesh.userData.geoV4Opacity / definition.opacity, 0.55, 1.25)
        : 1;
      mesh.onBeforeRender = () => {
        material.uniforms.uIslandOpacity.value = mesh.userData.geoV4IslandOpacity;
      };
      layerGroups[layerKey].add(mesh);
      disposeMaterial(originalMaterial);

      const positionCount = mesh.geometry.getAttribute('position')?.count ?? 0;
      const triangleCount = mesh.geometry.index
        ? mesh.geometry.index.count / 3
        : positionCount / 3;
      status.hybridMeshCount += 1;
      status.hybridVertexCount += positionCount;
      status.hybridTriangleCount += Math.round(triangleCount);
      status.hybridDrawCalls += 1;
      meshRecords.push({ mesh, material, layerKey });
    }

    for (const layerKey of Object.keys(LAYER_DEFINITIONS)) {
      const definition = LAYER_DEFINITIONS[layerKey];
      const nodes = createLayerNodes(
        meshRecords.filter((record) => record.layerKey === layerKey),
        definition,
        layerKey
      );
      if (!nodes) continue;
      layerGroups[layerKey].add(nodes.points);
      nodeRecords.push(nodes);
      status.hybridDrawCalls += 1;
    }
    status.hybridGeometryCount = status.hybridMeshCount + nodeRecords.length;
    status.hybridMaterialCount = layerMaterials.size + nodeRecords.length;
  }

  function applyDebugLayer() {
    const showAll = debugLayer === 'full'
      || debugLayer === 'environment'
      || debugLayer === 'membrane'
      || debugLayer === 'organism';
    rear.visible = showAll || debugLayer === 'rear';
    mid.visible = showAll || debugLayer === 'mid';
    foreground.visible = showAll || debugLayer === 'foreground';
  }
}

function updateLayer(layer, definition, px, py, time) {
  const targetX = px * definition.parallaxX;
  const targetY = -py * definition.parallaxY;
  layer.position.x += (targetX - layer.position.x) * 0.035;
  layer.position.y += (targetY - layer.position.y) * 0.035;
  const slowPhase = time * (0.014 + definition.detail * 0.006);
  layer.rotation.y += (
    px * definition.parallaxX * 0.13 + Math.sin(slowPhase) * 0.002
    - layer.rotation.y
  ) * 0.018;
  layer.rotation.x += (
    -py * definition.parallaxY * 0.1 + Math.cos(slowPhase * 0.78) * 0.0015
    - layer.rotation.x
  ) * 0.018;
}

function resolveLayerKey(name) {
  if (name.includes(LAYER_DEFINITIONS.rear.match)) return 'rear';
  if (name.includes(LAYER_DEFINITIONS.foreground.match)) return 'foreground';
  return 'mid';
}

function createHybridMaterial(definition, layerKey, sharedField) {
  const layerIndex = layerKey === 'rear' ? 0 : layerKey === 'mid' ? 1 : 2;
  const answer = sharedField.regions.answer;
  const citation = sharedField.regions.citation;
  const keyword = sharedField.regions.keyword;
  return new THREE.ShaderMaterial({
    name: `GEO V4 Hybrid ${layerKey} membrane material`,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 1 },
      uOpacity: { value: definition.opacity },
      uIslandOpacity: { value: 1 },
      uDetail: { value: definition.detail },
      uLayer: { value: layerIndex },
      uPointer: { value: new THREE.Vector2() },
      uCoreCenter: { value: new THREE.Vector2(sharedField.core.x, sharedField.core.y) },
      uAnswerCenter: { value: new THREE.Vector2(...answer.center) },
      uAnswerRadius: { value: new THREE.Vector2(...answer.radius) },
      uCitationCenter: { value: new THREE.Vector2(...citation.center) },
      uCitationRadius: { value: new THREE.Vector2(...citation.radius) },
      uKeywordCenter: { value: new THREE.Vector2(...keyword.center) },
      uKeywordRadius: { value: new THREE.Vector2(...keyword.radius) }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uLayer;
      uniform vec2 uPointer;
      varying vec2 vUv;
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      float membraneWave(vec3 p) {
        return sin(p.x * 1.7 + p.y * 1.1 + uTime * 0.026)
          * cos(p.y * 2.3 - p.z * 1.4 - uTime * 0.019);
      }

      void main() {
        vUv = uv;
        vLocalPosition = position;
        vec3 displaced = position;
        float layerMotion = mix(0.0035, 0.0075, uLayer / 2.0);
        displaced += normal * membraneWave(position) * layerMotion;
        displaced.x += uPointer.x * layerMotion * 0.16;
        displaced.y -= uPointer.y * layerMotion * 0.12;
        vec4 viewPosition = modelViewMatrix * vec4(displaced, 1.0);
        vViewPosition = viewPosition.xyz;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uReveal;
      uniform float uOpacity;
      uniform float uIslandOpacity;
      uniform float uDetail;
      uniform float uLayer;
      uniform vec2 uCoreCenter;
      uniform vec2 uAnswerCenter;
      uniform vec2 uAnswerRadius;
      uniform vec2 uCitationCenter;
      uniform vec2 uCitationRadius;
      uniform vec2 uKeywordCenter;
      uniform vec2 uKeywordRadius;
      varying vec2 vUv;
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;
      varying vec3 vViewPosition;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
      }

      vec2 hash22(vec2 p) {
        float n = hash21(p);
        return fract(vec2(n, n * 1.2154 + 0.173));
      }

      float valueNoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        float a = hash21(i);
        float b = hash21(i + vec2(1.0, 0.0));
        float c = hash21(i + vec2(0.0, 1.0));
        float d = hash21(i + vec2(1.0, 1.0));
        return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.54;
        for (int octave = 0; octave < 4; octave += 1) {
          value += valueNoise(p) * amplitude;
          p = mat2(1.61, -1.21, 1.21, 1.61) * p + 0.17;
          amplitude *= 0.49;
        }
        return value;
      }

      float cellularEdge(vec2 p) {
        vec2 cell = floor(p);
        vec2 local = fract(p);
        float nearest = 8.0;
        float second = 8.0;
        for (int y = -1; y <= 1; y += 1) {
          for (int x = -1; x <= 1; x += 1) {
            vec2 offset = vec2(float(x), float(y));
            vec2 point = offset + hash22(cell + offset) - local;
            point += sin(vec2(point.y, point.x) * 2.7 + uTime * 0.018) * 0.035;
            float distanceToPoint = dot(point, point);
            if (distanceToPoint < nearest) {
              second = nearest;
              nearest = distanceToPoint;
            } else if (distanceToPoint < second) {
              second = distanceToPoint;
            }
          }
        }
        float ridge = sqrt(second) - sqrt(nearest);
        return 1.0 - smoothstep(0.014, 0.057, ridge);
      }

      float ellipse(vec2 point, vec2 center, vec2 radius) {
        vec2 local = (point - center) / radius;
        return exp(-dot(local, local) * 1.35);
      }

      void main() {
        vec2 tissuePosition = vLocalPosition.xy;
        float broad = fbm(vUv * vec2(3.2, 2.7) + vLocalPosition.xy * 0.12);
        float fine = fbm(vUv * vec2(8.4, 6.9) - vLocalPosition.yx * 0.2);
        float breakup = smoothstep(0.22, 0.74, broad * 0.74 + fine * 0.34);

        float answer = ellipse(tissuePosition, uAnswerCenter, uAnswerRadius);
        float citation = ellipse(tissuePosition, uCitationCenter, uCitationRadius);
        float keyword = ellipse(tissuePosition, uKeywordCenter, uKeywordRadius);
        float business = max(answer, max(citation * 0.74, keyword * 0.82));
        float coreDistance = length((tissuePosition - uCoreCenter) / vec2(1.2, 0.9));
        float attraction = 1.0 - smoothstep(0.18, 1.82, coreDistance);

        float cellScale = mix(25.0, 43.0, uDetail);
        vec2 cellUv = vUv * vec2(cellScale, cellScale * 0.72);
        cellUv += vec2(
          sin(vUv.y * 8.0 + broad * 3.0),
          cos(vUv.x * 7.0 - fine * 2.0)
        ) * 0.18;
        float cells = cellularEdge(cellUv);
        float cellBreak = smoothstep(0.38, 0.7, fbm(cellUv * 0.37 + 3.4));
        cells *= cellBreak * (0.26 + uDetail * 0.74);

        vec3 viewDirection = normalize(-vViewPosition);
        float fresnel = pow(1.0 - abs(dot(normalize(vViewNormal), viewDirection)), 3.2);
        float fresnelBreak = smoothstep(0.56, 0.78, fbm(vUv * 5.4 + 7.1));
        fresnel *= fresnelBreak;

        float foldLight = pow(
          clamp(dot(normalize(vViewNormal), normalize(vec3(-0.32, 0.48, 0.82))), 0.0, 1.0),
          2.2
        );
        float curvature = clamp(length(fwidth(vViewNormal)) * 2.4, 0.0, 1.0);
        float foldRidge = smoothstep(0.13, 0.48, 1.0 - abs(vViewNormal.z));
        foldRidge *= smoothstep(0.24, 0.68, fbm(vUv * 9.0 + 12.7));
        float edgeDistance = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
        float edgeNoise = fbm(vUv * 7.3 + vec2(11.8, 3.1));
        float edgeBreakup = mix(
          0.025 + edgeNoise * 0.095,
          1.0,
          smoothstep(0.028, 0.17, edgeDistance)
        );
        float localHighlight = clamp(
          business * 0.32
            + attraction * 0.38
            + fresnel * 0.58
            + cells * 0.34
            + curvature * 0.52
            + foldRidge * 0.48,
          0.0,
          1.0
        );

        vec3 deepNavy = vec3(0.004, 0.018, 0.042);
        vec3 membraneBlue = vec3(0.025, 0.19, 0.29);
        vec3 ice = vec3(0.48, 0.84, 0.96);
        vec3 color = mix(deepNavy, membraneBlue, 0.08 + broad * 0.21 + foldLight * 0.12);
        color = mix(color, ice, localHighlight * 0.58);
        color = mix(color, vec3(0.36, 0.32, 0.55), citation * cells * 0.08);

        float body = 0.012 + breakup * 0.075 + foldLight * 0.052;
        body += business * 0.052 + attraction * 0.042 + curvature * 0.082;
        float cavityVeil = mix(0.46, 1.0, smoothstep(0.12, 0.78, coreDistance));
        float alpha = body + cells * 0.145 + fresnel * 0.155 + foldRidge * 0.105;
        alpha *= cavityVeil;
        alpha *= edgeBreakup;
        alpha *= uOpacity * uIslandOpacity * uReveal;
        if (alpha < 0.004) discard;
        gl_FragColor = vec4(color, clamp(alpha, 0.0, 0.28));
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: true
  });
}

function createLayerNodes(records, definition, layerKey) {
  if (records.length === 0) return null;
  const stride = layerKey === 'mid' ? 108 : layerKey === 'rear' ? 132 : 92;
  const positions = [];
  const phases = [];
  for (let recordIndex = 0; recordIndex < records.length; recordIndex += 1) {
    const source = records[recordIndex].mesh.geometry.getAttribute('position');
    for (let index = 0; index < source.count; index += stride) {
      const selector = Math.abs(Math.sin(
        index * 12.9898 + recordIndex * 19.73 + definition.detail * 37.17
      ));
      if (selector < 0.5) continue;
      positions.push(source.getX(index), source.getY(index), source.getZ(index));
      phases.push(selector * 6.2831853);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
  const material = new THREE.ShaderMaterial({
    name: `GEO V4 Hybrid ${layerKey} membrane nodes`,
    uniforms: {
      uTime: { value: 0 },
      uReveal: { value: 1 },
      uSize: { value: definition.nodeSize },
      uLayer: { value: layerKey === 'rear' ? 0 : layerKey === 'mid' ? 1 : 2 }
    },
    vertexShader: `
      uniform float uTime;
      uniform float uSize;
      attribute float aPhase;
      varying float vPulse;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vPulse = 0.72 + sin(uTime * 0.42 + aPhase) * 0.16;
        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(uSize * (7.4 / max(1.0, -viewPosition.z)), 0.8, 2.8);
      }
    `,
    fragmentShader: `
      uniform float uReveal;
      uniform float uLayer;
      varying float vPulse;
      void main() {
        vec2 local = gl_PointCoord - 0.5;
        float radius = length(local);
        float alpha = (1.0 - smoothstep(0.12, 0.5, radius)) * vPulse;
        vec3 rearColor = vec3(0.12, 0.44, 0.62);
        vec3 midColor = vec3(0.48, 0.84, 0.96);
        vec3 foreColor = vec3(0.24, 0.68, 0.82);
        vec3 color = uLayer < 0.5 ? rearColor : (uLayer < 1.5 ? midColor : foreColor);
        gl_FragColor = vec4(color, alpha * uReveal * 0.72);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: true
  });
  const points = new THREE.Points(geometry, material);
  points.name = `GEO V4 Hybrid ${layerKey} membrane nodes`;
  points.renderOrder = definition.renderOrder + 0.25;
  points.frustumCulled = false;
  return { points, material };
}

function getAssetBuffer() {
  if (!assetBufferPromise) {
    assetNetworkLoads += 1;
    const base = import.meta.env.BASE_URL || '/';
    const assetUrl = `${base.endsWith('/') ? base : `${base}/`}${ASSET_PATH}`;
    assetBufferPromise = fetch(assetUrl)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status} while loading ${assetUrl}`);
        }
        return response.arrayBuffer();
      })
      .catch((error) => {
        assetBufferPromise = null;
        throw error;
      });
  }
  return assetBufferPromise;
}

function disposeScene(scene) {
  scene.traverse((child) => {
    if (!child.isMesh) return;
    child.geometry?.dispose();
    disposeMaterial(child.material);
  });
  scene.clear();
}

function disposeMaterial(material) {
  if (Array.isArray(material)) {
    for (let index = 0; index < material.length; index += 1) {
      material[index]?.dispose();
    }
    return;
  }
  material?.dispose();
}
