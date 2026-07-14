import * as THREE from 'three';

const DEFAULT_PARAMETERS = Object.freeze({
  outerRadius: 0.78,
  extentScale: 2.7,
  localScale: 0.8,
  uvScale: 1.06,
  uvOffsetX: -0.0217,
  uvOffsetY: 0.2612,
  uvRotation: -0.13,
  localRotationX: THREE.MathUtils.degToRad(2),
  localRotationY: THREE.MathUtils.degToRad(-1.2),
  localRotationZ: THREE.MathUtils.degToRad(1.5)
});

export const GALAXY_TEXTURE_CORE_UV = Object.freeze({ x: 0.425, y: 0.665 });
export const GALAXY_TEXTURE_ARM_UVS = Object.freeze([
  Object.freeze({ x: 0.5, y: 0.729 }),
  Object.freeze({ x: 0.341, y: 0.562 })
]);

export function createGalaxyTextureLayer(parameters = DEFAULT_PARAMETERS) {
  const config = { ...DEFAULT_PARAMETERS, ...parameters };
  const extent = config.outerRadius * config.extentScale;
  const geometry = new THREE.PlaneGeometry(extent, extent, 48, 48);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uColorMap: { value: null },
      uMaskMap: { value: null },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
      uUvScale: { value: new THREE.Vector2(config.uvScale, config.uvScale) },
      uUvOffset: { value: new THREE.Vector2(config.uvOffsetX, config.uvOffsetY) },
      uUvRotation: { value: config.uvRotation }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec2 vSampleUv;

      uniform sampler2D uMaskMap;
      uniform vec2 uUvScale;
      uniform vec2 uUvOffset;
      uniform float uUvRotation;

      float lowFrequencyShape(vec2 point) {
        float firstWave = sin(point.x * 13.7 + point.y * 7.9);
        float secondWave = sin(point.x * 5.3 - point.y * 11.1 + 1.7);
        return firstWave * 0.62 + secondWave * 0.38;
      }

      void main() {
        vUv = uv;
        float rotationSin = sin(uUvRotation);
        float rotationCos = cos(uUvRotation);
        mat2 uvRotation = mat2(rotationCos, -rotationSin, rotationSin, rotationCos);
        vSampleUv = uvRotation * ((uv - 0.5) * uUvScale) + 0.5 + uUvOffset;

        vec3 layeredPosition = position;
        if (vSampleUv.x > 0.0 && vSampleUv.x < 1.0 && vSampleUv.y > 0.0 && vSampleUv.y < 1.0) {
          float armDensity = texture2D(uMaskMap, vSampleUv).b;
          float coreDistance = length((vSampleUv - vec2(0.425, 0.665)) * vec2(0.94, 1.08));
          float coreLift = (1.0 - smoothstep(0.06, 0.3, coreDistance)) * 0.007;
          float armLift = (armDensity - 0.42) * 0.011;
          float noiseLift = lowFrequencyShape(vSampleUv) * 0.0035
            * smoothstep(0.12, 0.78, armDensity);
          layeredPosition.z += coreLift + armLift + noiseLift;
        }

        gl_Position = projectionMatrix * modelViewMatrix * vec4(layeredPosition, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uColorMap;
      uniform sampler2D uMaskMap;
      uniform float uOpacity;
      uniform float uTime;
      uniform vec2 uUvScale;
      uniform vec2 uUvOffset;
      uniform float uUvRotation;
      varying vec2 vUv;
      varying vec2 vSampleUv;

      float hash21(vec2 point) {
        point = fract(point * vec2(123.34, 345.45));
        point += dot(point, point + 34.345);
        return fract(point.x * point.y);
      }

      float valueNoise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float a = hash21(cell);
        float b = hash21(cell + vec2(1.0, 0.0));
        float c = hash21(cell + vec2(0.0, 1.0));
        float d = hash21(cell + vec2(1.0, 1.0));
        return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
      }

      void main() {
        vec2 sampleUv = vSampleUv;
        if (sampleUv.x <= 0.0 || sampleUv.x >= 1.0 || sampleUv.y <= 0.0 || sampleUv.y >= 1.0) {
          discard;
        }

        vec4 colorSample = texture2D(uColorMap, sampleUv);
        vec3 masks = texture2D(uMaskMap, sampleUv).rgb;
        float dust = clamp(masks.r, 0.0, 1.0);
        float emissive = clamp(masks.g, 0.0, 1.0);
        float armDensity = clamp(masks.b, 0.0, 1.0);
        vec2 edgeDistance = min(sampleUv, 1.0 - sampleUv);
        float edgeFeather = smoothstep(0.0, 0.045, min(edgeDistance.x, edgeDistance.y));
        float densitySignal = smoothstep(0.12, 0.72, armDensity);
        float densityWeight = mix(0.025, 1.0, densitySignal);
        float dustSignal = smoothstep(0.08, 0.82, dust);
        float dustColorCut = 1.0 - dustSignal * 0.5;
        float dustAlphaCut = 1.0 - dustSignal * 0.22;
        float restrainedGlow = emissive * (0.072 + sin(uTime * 0.09) * 0.004);
        vec3 displayColor = sqrt(clamp(colorSample.rgb, 0.0, 1.0));
        float colorMaximum = max(max(displayColor.r, displayColor.g), displayColor.b);
        float colorMinimum = min(min(displayColor.r, displayColor.g), displayColor.b);
        float colorSaturation = (colorMaximum - colorMinimum) / max(colorMaximum, 0.001);
        float sourceLuminance = dot(colorSample.rgb, vec3(0.2126, 0.7152, 0.0722));
        float sourceCoverage = smoothstep(0.5, 0.76, colorSample.a);
        float chromaticStructure = smoothstep(0.2, 0.5, colorSaturation);
        float luminousStructure = smoothstep(0.11, 0.34, sourceLuminance)
          * smoothstep(0.36, 0.76, armDensity);
        float materialDetail = max(
          max(chromaticStructure, luminousStructure),
          emissive * 0.88
        );
        vec2 radialVector = (sampleUv - vec2(0.425, 0.665)) * vec2(0.92, 1.08);
        float radialDistance = length(radialVector);
        float outerZone = smoothstep(0.29, 0.65, radialDistance);
        float broadEdgeNoise = valueNoise(sampleUv * 5.2 + vec2(2.7, 5.1));
        float fineEdgeNoise = valueNoise(sampleUv * 11.4 + vec2(8.4, 1.9));
        float edgeVariation = mix(0.15, 0.25, broadEdgeNoise * 0.7 + fineEdgeNoise * 0.3);
        float irregularOuterFade = 1.0 - outerZone * edgeVariation;
        float boundaryStart = 0.57 + (broadEdgeNoise - 0.5) * 0.065;
        float boundaryEnd = 0.75 + (fineEdgeNoise - 0.5) * 0.035;
        irregularOuterFade *= 1.0 - smoothstep(
          boundaryStart,
          boundaryEnd,
          radialDistance
        );
        float localGap = smoothstep(0.64, 0.88, fineEdgeNoise)
          * outerZone
          * (1.0 - smoothstep(0.36, 0.82, armDensity));
        irregularOuterFade *= 1.0 - localGap * 0.28;
        vec3 color = colorSample.rgb * dustColorCut;

        color += mix(vec3(0.16, 0.34, 0.62), vec3(1.0, 0.72, 0.48), emissive)
          * restrainedGlow;
        float alpha = colorSample.a
          * sourceCoverage
          * densityWeight
          * mix(0.004, 1.0, materialDetail)
          * dustAlphaCut
          * irregularOuterFade
          * edgeFeather
          * uOpacity;
        if (alpha < 0.001) discard;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    blending: THREE.NormalBlending,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: false,
    toneMapped: true
  });
  const mesh = new THREE.Mesh(geometry, material);
  let texturesReady = false;
  let layerOpacity = 0;

  mesh.name = 'CinematicGalaxyTextureLayer';
  mesh.position.z = -0.105;
  mesh.scale.setScalar(config.localScale);
  mesh.rotation.set(
    config.localRotationX,
    config.localRotationY,
    config.localRotationZ
  );
  mesh.renderOrder = -7;
  mesh.frustumCulled = false;
  mesh.visible = false;

  function setTextures(textures) {
    material.uniforms.uColorMap.value = textures?.color ?? null;
    material.uniforms.uMaskMap.value = textures?.masks ?? null;
    texturesReady = Boolean(textures?.color && textures?.masks);
    mesh.visible = texturesReady && layerOpacity >= 0.01;
  }

  function setOpacity(opacity) {
    layerOpacity = Math.min(Math.max(opacity, 0), 1);
    material.uniforms.uOpacity.value = layerOpacity;
    mesh.visible = texturesReady && layerOpacity >= 0.01;
  }

  function update(time) {
    if (!mesh.visible) return;
    material.uniforms.uTime.value = time;
  }

  function sourceUvToLocalPoint(sourceUv) {
    const source = new THREE.Vector2(sourceUv.x, sourceUv.y)
      .sub(new THREE.Vector2(0.5 + config.uvOffsetX, 0.5 + config.uvOffsetY))
      .rotateAround(new THREE.Vector2(), -config.uvRotation)
      .divideScalar(config.uvScale)
      .addScalar(0.5);
    const point = new THREE.Vector3(
      (source.x - 0.5) * extent,
      (source.y - 0.5) * extent,
      0
    );

    mesh.updateMatrix();
    return point.applyMatrix4(mesh.matrix);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return {
    mesh,
    material,
    setTextures,
    setOpacity,
    update,
    sourceUvToLocalPoint,
    alignment: Object.freeze({
      coreUv: GALAXY_TEXTURE_CORE_UV,
      armUvs: GALAXY_TEXTURE_ARM_UVS
    }),
    isReady: () => texturesReady,
    dispose
  };
}

export const galaxyTextureLayerFactory = { createGalaxyTextureLayer };
