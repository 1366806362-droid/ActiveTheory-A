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
  sunDirection
}) {
  const surfaceMaterial = createTextureSurfaceMaterial(sunDirection);
  const cityMaterial = createTextureCityMaterial(sunDirection);
  const cloudMaterial = createTextureCloudMaterial();
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

function createTextureSurfaceMaterial(sunDirection) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSurfaceMap: { value: null },
      uSunDirectionObject: { value: sunDirection.clone() },
      uOpacity: { value: 1 },
      uDisplayMode: { value: 0 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalObject;

      void main() {
        vUv = uv;
        vNormalObject = normalize(normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uSurfaceMap;
      uniform vec3 uSunDirectionObject;
      uniform float uOpacity;
      uniform float uDisplayMode;
      varying vec2 vUv;
      varying vec3 vNormalObject;

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

function createTextureCityMaterial(sunDirection) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCityMap: { value: null },
      uSunDirectionObject: { value: sunDirection.clone() },
      uOpacity: { value: 0.86 }
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
      varying vec2 vUv;
      varying vec3 vNormalObject;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

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

function createTextureCloudMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCloudMap: { value: null },
      uOpacity: { value: 0.22 }
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vNormalView;
      varying vec3 vViewDirection;

      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        vUv = uv;
        vNormalView = normalize(normalMatrix * normal);
        vViewDirection = normalize(-viewPosition.xyz);
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uCloudMap;
      uniform float uOpacity;
      varying vec2 vUv;
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
