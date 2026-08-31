import * as THREE from 'three';

export const EARTH_TEXTURE_V2_QUALITY = Object.freeze({
  combinedApproved: true,
  normalApproved: false,
  reasons: Object.freeze([])
});

export function createEarthTextureLayers({
  surfaceGeometry,
  cityGeometry,
  cloudGeometry,
  sunDirection,
  cinematic = false
}) {
  const surfaceMaterial = createTextureSurfaceMaterial(sunDirection, cinematic);
  const cityMaterial = createTextureCityMaterial(sunDirection, cinematic);
  const cloudMaterial = createTextureCloudMaterial(sunDirection, cinematic);
  const surface = new THREE.Mesh(surfaceGeometry, surfaceMaterial);
  const city = new THREE.Mesh(cityGeometry, cityMaterial);
  const clouds = new THREE.Mesh(cloudGeometry, cloudMaterial);
  let ready = false;

  surface.name = 'EarthTextureSurface';
  city.name = 'EarthTextureCityLights';
  clouds.name = 'EarthTextureClouds';
  surface.renderOrder = 2;
  city.renderOrder = 3;
  clouds.renderOrder = 4;
  surface.visible = false;
  city.visible = false;
  clouds.visible = false;

  function setTextures(textures) {
    ready = Boolean(
      textures?.surface
      && textures?.city
      && textures?.clouds
    );
    surfaceMaterial.uniforms.uSurfaceMap.value = textures?.surface ?? null;
    cityMaterial.uniforms.uCityMap.value = textures?.city ?? null;
    cloudMaterial.uniforms.uCloudMap.value = textures?.clouds ?? null;
    if (!ready) setVisibility({ surface: false, city: false, clouds: false });
  }

  function setVisibility(visibility) {
    surface.visible = ready && Boolean(visibility.surface);
    city.visible = ready && Boolean(visibility.city);
    clouds.visible = ready && Boolean(visibility.clouds);
  }

  function setSurfaceMode(mode) {
    surfaceMaterial.uniforms.uDisplayMode.value = mode === 'reference' ? 2 : 0;
  }

  function setWeights({ surface: surfaceWeight, city: cityWeight, clouds: cloudWeight }) {
    surfaceMaterial.uniforms.uOpacity.value = surfaceWeight;
    cityMaterial.uniforms.uOpacity.value = cityWeight;
    cloudMaterial.uniforms.uOpacity.value = cloudWeight;
  }

  function setSunDirection(direction) {
    surfaceMaterial.uniforms.uSunDirectionObject.value.copy(direction);
    cityMaterial.uniforms.uSunDirectionObject.value.copy(direction);
    cloudMaterial.uniforms.uSunDirectionObject.value.copy(direction);
  }

  function dispose() {
    surfaceMaterial.dispose();
    cityMaterial.dispose();
    cloudMaterial.dispose();
  }

  return {
    surface,
    city,
    clouds,
    materials: { surface: surfaceMaterial, city: cityMaterial, clouds: cloudMaterial },
    setTextures,
    setVisibility,
    setSurfaceMode,
    setWeights,
    setSunDirection,
    isReady: () => ready,
    dispose
  };
}

function createTextureSurfaceMaterial(sunDirection, cinematic = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSurfaceMap: { value: null },
      uSunDirectionObject: { value: sunDirection.clone() },
      uOpacity: { value: 1 },
      uDisplayMode: { value: 0 },
      uCinematic: { value: cinematic ? 1 : 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vUv = uv;
        vNormalObject = normalize(normal);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSurfaceMap;
      uniform vec3 uSunDirectionObject;
      uniform float uOpacity;
      uniform float uDisplayMode;
      uniform float uCinematic;
      varying vec2 vUv;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        if (uDisplayMode > 1.5) {
          gl_FragColor = vec4(0.006, 0.016, 0.038, 1.0);
          return;
        }

        vec3 color = texture2D(uSurfaceMap, vUv).rgb;
        float surfaceLuma = dot(color, vec3(0.2126, 0.7152, 0.0722));
        float landColor = color.r * 0.68 + color.g * 0.32 - color.b * 0.72;
        float landMask = smoothstep(-0.006, 0.032, landColor)
          * smoothstep(0.008, 0.16, surfaceLuma);
        float sunFacing = dot(normalize(vNormalObject), normalize(uSunDirectionObject));
        if (uCinematic > 0.5) {
          float facing = clamp(
            dot(normalize(vNormalView), normalize(vViewDirection)),
            0.0,
            1.0
          );
          float limb = 1.0 - facing;
          float terminator = smoothstep(-0.34, 0.34, sunFacing);
          float lowFrequency = 0.5 + 0.25 * sin(vNormalObject.x * 3.7 + vNormalObject.y * 2.1)
            + 0.25 * sin(vNormalObject.z * 4.3 - vNormalObject.y * 1.8);
          float textureSignal = smoothstep(0.004, 0.13, surfaceLuma);
          vec3 oceanNavy = vec3(0.0022, 0.0072, 0.02);
          vec3 landNavy = vec3(0.0092, 0.021, 0.0395);
          vec3 cinematicColor = mix(oceanNavy, landNavy, landMask);
          cinematicColor += color * vec3(0.3, 0.36, 0.46) * textureSignal;
          cinematicColor *= mix(0.9, 1.1, lowFrequency);
          cinematicColor *= mix(0.88, 1.09, terminator);
          float coolReflection = pow(limb, 2.2)
            * smoothstep(-0.48, 0.12, sunFacing);
          cinematicColor += vec3(0.014, 0.043, 0.092) * coolReflection;
          cinematicColor = max(cinematicColor, vec3(0.0022, 0.006, 0.014));
          gl_FragColor = vec4(cinematicColor, uOpacity);
          return;
        }
        float nightGrade = 0.78 + (1.0 - smoothstep(0.18, 0.72, sunFacing)) * 0.22;
        color *= nightGrade * (1.0 + landMask * 0.075);
        color += landMask * vec3(0.0015, 0.002, 0.0024);
        color = max(color, vec3(0.0024, 0.0055, 0.0115));
        gl_FragColor = vec4(color, uOpacity);
      }
    `,
    depthTest: true,
    depthWrite: true,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: true
  });
}

function createTextureCityMaterial(sunDirection, cinematic = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCityMap: { value: null },
      uSunDirectionObject: { value: sunDirection.clone() },
      uOpacity: { value: 0.86 },
      uCinematic: { value: cinematic ? 1 : 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vUv = uv;
        vNormalObject = normalize(normal);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uCityMap;
      uniform vec3 uSunDirectionObject;
      uniform float uOpacity;
      uniform float uCinematic;
      varying vec2 vUv;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      float hash21(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      void main() {
        vec4 citySample = texture2D(uCityMap, vUv);
        float intensity = max(max(citySample.r, citySample.g), citySample.b);
        float weightedIntensity = dot(citySample.rgb, vec3(0.38, 0.54, 0.08));
        float midLights = smoothstep(0.14, 0.72, weightedIntensity);
        float coreLights = smoothstep(0.78, 0.985, intensity);
        float shapedLights = pow(midLights, 1.55);
        float lightMask = mix(shapedLights * 0.78, 1.0, coreLights);
        float sunFacing = dot(normalize(vNormalObject), normalize(uSunDirectionObject));
        float nightMask = 1.0 - smoothstep(0.18, 0.58, sunFacing);
        float frontFacing = smoothstep(
          0.015,
          0.24,
          dot(normalize(vNormalView), normalize(vViewDirection))
        );
        if (uCinematic > 0.5) {
          float weakLights = smoothstep(0.1, 0.58, weightedIntensity);
          float metroLights = smoothstep(0.42, 0.78, weightedIntensity);
          float coreLightsV3 = smoothstep(0.78, 0.97, intensity)
            * smoothstep(0.5, 0.8, weightedIntensity);
          float energySeed = hash21(floor(vUv * vec2(92.0, 46.0)));
          float mediumTier = smoothstep(0.78, 0.94, energySeed) * metroLights;
          float heroTier = smoothstep(0.95, 0.997, energySeed) * coreLightsV3;
          float localVariation = mix(
            0.42,
            1.0,
            hash21(floor(vUv * vec2(260.0, 130.0)))
          );
          float hierarchy = weakLights * 0.16
            + mediumTier * 0.54
            + heroTier * 1.08;
          float cinematicNightMask = 1.0 - smoothstep(-0.08, 0.46, sunFacing);
          float cinematicAlpha = hierarchy
            * localVariation
            * citySample.a
            * cinematicNightMask
            * frontFacing
            * uOpacity;
          if (cinematicAlpha < 0.006) discard;
          float warmWhiteV3 = smoothstep(0.7, 0.98, intensity);
          vec3 mutedGold = mix(
            vec3(0.72, 0.36, 0.095),
            vec3(1.0, 0.75, 0.38),
            warmWhiteV3
          );
          float selectiveEnergy = 0.17
            + mediumTier * 0.58
            + heroTier * 1.3;
          gl_FragColor = vec4(mutedGold * selectiveEnergy, cinematicAlpha);
          return;
        }
        float alpha = lightMask
          * citySample.a
          * nightMask
          * frontFacing
          * uOpacity;
        if (alpha < 0.008) discard;
        vec3 channelGrade = citySample.rgb * vec3(0.84, 0.97, 1.0);
        float warmWhite = smoothstep(0.72, 0.98, intensity)
          * smoothstep(0.38, 0.68, weightedIntensity);
        vec3 warmGold = mix(vec3(1.0, 0.64, 0.28), vec3(1.0, 0.86, 0.64), warmWhite);
        vec3 mappedLights = mix(
          channelGrade * warmGold,
          intensity * warmGold,
          0.12 + warmWhite * 0.08
        );
        gl_FragColor = vec4(mappedLights * 0.38, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: false
  });
}

function createTextureCloudMaterial(sunDirection, cinematic = false) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCloudMap: { value: null },
      uSunDirectionObject: { value: sunDirection.clone() },
      uOpacity: { value: 0.22 },
      uCinematic: { value: cinematic ? 1 : 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vUv = uv;
        vNormalObject = normalize(normal);
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uCloudMap;
      uniform vec3 uSunDirectionObject;
      uniform float uOpacity;
      uniform float uCinematic;
      varying vec2 vUv;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 cloudSample = texture2D(uCloudMap, vUv);
        float facing = smoothstep(
          0.015,
          0.3,
          dot(normalize(vNormalView), normalize(vViewDirection))
        );
        float cloudLuma = dot(cloudSample.rgb, vec3(0.2126, 0.7152, 0.0722));
        float denseCloud = smoothstep(0.48, 0.92, cloudLuma);
        if (uCinematic > 0.5) {
          float sunFacing = dot(
            normalize(vNormalObject),
            normalize(uSunDirectionObject)
          );
          float lightSide = smoothstep(-0.16, 0.52, sunFacing);
          float darkSideSuppression = mix(0.018, 1.0, lightSide);
          float cloudStructure = smoothstep(0.13, 0.68, cloudLuma);
          float cinematicAlpha = cloudSample.a
            * cloudStructure
            * facing
            * darkSideSuppression
            * uOpacity;
          if (cinematicAlpha < 0.005) discard;
          vec3 silverBlue = mix(
            vec3(0.18, 0.24, 0.34),
            vec3(0.46, 0.57, 0.7),
            denseCloud
          );
          vec3 cinematicCloud = cloudSample.rgb
            * silverBlue
            * mix(0.34, 1.06, lightSide);
          gl_FragColor = vec4(cinematicCloud, min(cinematicAlpha, 0.28));
          return;
        }
        float alpha = cloudSample.a
          * facing
          * uOpacity
          * mix(1.0, 0.92, denseCloud);
        if (alpha < 0.006) discard;
        vec3 cloudGrade = mix(
          vec3(0.69, 0.75, 0.83),
          vec3(0.66, 0.72, 0.8),
          denseCloud
        );
        vec3 color = cloudSample.rgb * cloudGrade;
        gl_FragColor = vec4(color, alpha);
      }
    `,
    transparent: true,
    depthTest: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    side: THREE.FrontSide,
    fog: false,
    toneMapped: true
  });
}

export const earthTextureMaterialFactory = { createEarthTextureLayers };
