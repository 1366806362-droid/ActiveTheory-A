import * as THREE from 'three';

const MOTION_VERTEX_SHADER = `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform vec2 uParallax;
  uniform float uJourneyOpacity;
  attribute float aSize;
  attribute float aSeed;
  attribute float aRadius;
  varying float vJourneyOpacity;
  varying float vSeed;
  varying float vDepthCue;

  vec2 rotate2d(vec2 point, float angle) {
    float sine = sin(angle);
    float cosine = cos(angle);
    return mat2(cosine, -sine, sine, cosine) * point;
  }

  vec3 animateGalaxyPosition(vec3 sourcePosition) {
    float radialProgress = clamp(aRadius, 0.0, 1.25);
    float angularSpeed = mix(0.018, 0.0045, smoothstep(0.08, 1.1, radialProgress));
    vec3 animated = sourcePosition;
    animated.xy = rotate2d(animated.xy, uTime * angularSpeed);
    animated.z += sin(uTime * 0.11 + aSeed * 6.2831853) * 0.0045
      * (0.3 + radialProgress * 0.7);
    animated.xy += uParallax * animated.z * 0.12;
    return animated;
  }
`;

export function createGpuGalaxyStarMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: createSharedUniforms(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
    vertexShader: `
      ${MOTION_VERTEX_SHADER}
      attribute float aLuminosity;
      attribute float aType;
      attribute float aDustAttenuation;
      varying vec3 vColor;
      varying float vLuminosity;
      varying float vType;
      varying float vDustAttenuation;

      void main() {
        vec3 animated = animateGalaxyPosition(position);
        vec4 modelPosition = modelMatrix * vec4(animated, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        float perspective = clamp(8.0 / max(-viewPosition.z, 0.01), 0.55, 2.6);
        float shimmer = 0.94 + sin(uTime * (0.32 + aSeed * 0.18) + aSeed * 31.0) * 0.06;
        float coreParticle = step(2.5, aType) * (1.0 - step(3.5, aType));
        float microParticle = step(3.5, aType);
        float typeScale = 1.0 + coreParticle * 0.58 + microParticle * 0.92;
        float dustScale = 1.0 - aDustAttenuation * 0.38;

        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * typeScale * dustScale * uPixelRatio * perspective, 0.4, 6.4);
        vColor = color;
        vLuminosity = aLuminosity * shimmer;
        vType = aType;
        vDustAttenuation = aDustAttenuation;
        vJourneyOpacity = uJourneyOpacity;
        vSeed = aSeed;
        vDepthCue = smoothstep(-0.2, 0.2, animated.z);
      }
    `,
    fragmentShader: `
      uniform float uHybridMix;
      varying vec3 vColor;
      varying float vLuminosity;
      varying float vType;
      varying float vDustAttenuation;
      varying float vJourneyOpacity;
      varying float vSeed;
      varying float vDepthCue;

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius > 1.0) discard;

        float softHalo = exp(-radius * radius * 6.2);
        float softCore = exp(-radius * radius * 24.0);
        float softDust = exp(-radius * radius * 2.8);
        float brightNode = step(0.5, vType) * (1.0 - step(1.5, vType));
        float dimParticle = step(1.5, vType) * (1.0 - step(2.5, vType));
        float coreParticle = step(2.5, vType) * (1.0 - step(3.5, vType));
        float microParticle = step(3.5, vType);
        float flareX = exp(-abs(centered.x) * 38.0) * exp(-abs(centered.y) * 6.0);
        float flareY = exp(-abs(centered.y) * 38.0) * exp(-abs(centered.x) * 6.0);
        float flare = (flareX + flareY) * 0.075 * brightNode;
        float attenuation = 1.0 - vDustAttenuation * 0.9;
        float energy = min(vLuminosity, 1.34);
        float stellarOpacity = softHalo * 0.17 + softCore * 0.74 + flare;
        float microOpacity = softDust * 0.12 + softHalo * 0.18 + softCore * 0.4;
        float coreOpacity = softDust * 0.115 + softHalo * 0.25 + softCore * 0.66;
        float opacityProfile = mix(stellarOpacity, microOpacity, microParticle);
        opacityProfile = mix(opacityProfile, coreOpacity, coreParticle);
        float depthCue = mix(0.84, 1.06, vDepthCue);
        float hybridAttenuation = 1.0 - uHybridMix * (coreParticle * 0.22 + microParticle * 0.08);
        float opacity = opacityProfile
          * energy
          * attenuation
          * mix(1.0, 0.42, dimParticle)
          * depthCue
          * hybridAttenuation
          * vJourneyOpacity;
        vec3 stellarColor = vColor * (softHalo * 0.4 + softCore * 1.12 + flare * 1.45);
        vec3 microColor = vColor * (softDust * 0.22 + softHalo * 0.32 + softCore * 0.54);
        vec3 coreColor = vColor * (softDust * 0.27 + softHalo * 0.4 + softCore * 0.96);
        vec3 color = mix(stellarColor, microColor, microParticle);
        color = mix(color, coreColor, coreParticle) * mix(1.0, 0.62, dimParticle);

        gl_FragColor = vec4(color, opacity);
      }
    `
  });
}

export function createGpuGalaxyDustMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: createSharedUniforms(),
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: THREE.NormalBlending,
    toneMapped: false,
    fog: false,
    vertexShader: `
      ${MOTION_VERTEX_SHADER}
      attribute float aOpacity;
      varying float vOpacity;

      void main() {
        vec3 animated = animateGalaxyPosition(position);
        vec4 modelPosition = modelMatrix * vec4(animated, 1.0);
        vec4 viewPosition = viewMatrix * modelPosition;
        float perspective = clamp(8.0 / max(-viewPosition.z, 0.01), 0.55, 2.6);

        gl_Position = projectionMatrix * viewPosition;
        gl_PointSize = clamp(aSize * uPixelRatio * perspective, 1.0, 7.5);
        vOpacity = aOpacity;
        vJourneyOpacity = uJourneyOpacity;
        vSeed = aSeed;
        vDepthCue = smoothstep(-0.2, 0.2, animated.z);
      }
    `,
    fragmentShader: `
      varying float vOpacity;
      varying float vJourneyOpacity;
      varying float vSeed;

      float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7)) + vSeed * 53.7) * 43758.5453);
      }

      void main() {
        vec2 centered = gl_PointCoord - 0.5;
        float radius = length(centered) * 2.0;
        if (radius > 1.0) discard;

        float edge = 1.0 - smoothstep(0.16, 1.0, radius);
        float grain = mix(0.58, 1.0, hash(floor(gl_PointCoord * 9.0)));
        float alpha = edge * grain * vOpacity * vJourneyOpacity;
        vec3 dustColor = mix(vec3(0.004, 0.005, 0.008), vec3(0.026, 0.018, 0.014), vSeed);

        gl_FragColor = vec4(dustColor, alpha);
      }
    `
  });
}

function createSharedUniforms() {
  return {
    uTime: { value: 0 },
    uPixelRatio: { value: Math.min(globalThis.devicePixelRatio ?? 1, 1.5) },
    uParallax: { value: new THREE.Vector2() },
    uJourneyOpacity: { value: 1 },
    uHybridMix: { value: 0 }
  };
}
