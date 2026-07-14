import * as THREE from 'three';

const DEFAULT_PARAMETERS = Object.freeze({
  innerRadius: 0.07,
  outerRadius: 0.78,
  turns: 0.88,
  radiusExponent: 1.12,
  globalArmPhase: 0
});

export function createGalaxyBaseLayer(parameters = DEFAULT_PARAMETERS) {
  const config = { ...DEFAULT_PARAMETERS, ...parameters };
  const extent = config.outerRadius * 2.7;
  let layerWeight = 1;
  const geometry = new THREE.PlaneGeometry(extent, extent, 1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: 1 },
      uInnerRadius: { value: config.innerRadius },
      uOuterRadius: { value: config.outerRadius },
      uTurns: { value: config.turns },
      uRadiusExponent: { value: config.radiusExponent },
      uGlobalArmPhase: { value: config.globalArmPhase }
    },
    vertexShader: `
      varying vec2 vLocalPosition;

      void main() {
        vLocalPosition = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uInnerRadius;
      uniform float uOuterRadius;
      uniform float uTurns;
      uniform float uRadiusExponent;
      uniform float uGlobalArmPhase;
      varying vec2 vLocalPosition;

      const float PI = 3.141592653589793;
      const float TAU = 6.283185307179586;

      float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 456.21));
        p += dot(p, p + 45.32);
        return fract(p.x * p.y);
      }

      float noise2(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(
          mix(hash21(i), hash21(i + vec2(1.0, 0.0)), f.x),
          mix(hash21(i + vec2(0.0, 1.0)), hash21(i + vec2(1.0)), f.x),
          f.y
        );
      }

      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.54;
        mat2 rotation = mat2(0.82, 0.57, -0.57, 0.82);
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise2(p) * amplitude;
          p = rotation * p * 2.04 + 6.73;
          amplitude *= 0.49;
        }
        return value;
      }

      float smootherstep(float edge0, float edge1, float value) {
        float t = clamp((value - edge0) / (edge1 - edge0), 0.0, 1.0);
        return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
      }

      float angleDelta(float a, float b) {
        return atan(sin(a - b), cos(a - b));
      }

      void main() {
        vec2 p = vLocalPosition;
        float radius = length(p);
        float normalizedRadius = clamp(
          (radius - uInnerRadius) / max(uOuterRadius - uInnerRadius, 0.0001),
          0.0,
          1.0
        );
        float t = pow(normalizedRadius, 1.0 / max(uRadiusExponent, 0.001));
        float angle = atan(p.y, p.x);
        float armAngle = uGlobalArmPhase + t * TAU * uTurns;
        float deltaA = angleDelta(angle, armAngle);
        float deltaB = angleDelta(angle, armAngle + PI);
        float upperArm = abs(deltaB) < abs(deltaA) ? 1.0 : 0.0;
        float signedArmDelta = abs(deltaA) < abs(deltaB) ? deltaA : deltaB;
        float signedArmDistance = signedArmDelta * max(radius, 0.055);
        float middleWidth = 0.022
          + sin(PI * min(t, 0.82) / 0.82) * 0.062;
        float rootTaper = 0.44 + smootherstep(0.035, 0.2, t) * 0.56;
        float outerThin = 1.0 - smootherstep(0.64, 0.88, t) * 0.84;
        float armBalance = smootherstep(0.12, 0.28, t);
        float widthBalance = mix(
          1.0 + armBalance * 0.04,
          1.0 - armBalance * 0.18,
          upperArm
        );
        float armWidth = middleWidth * rootTaper * outerThin * widthBalance;
        float armStart = smootherstep(uInnerRadius * 0.62, uInnerRadius * 1.7, radius);
        float outerFade = 1.0 - smootherstep(0.68, 0.88, t);

        vec2 domain = p * 5.4 + vec2(t * 1.7, signedArmDelta * 0.8);
        vec2 warp = vec2(
          fbm(domain * 0.66 + 3.1),
          fbm(domain * 0.66 + 9.7)
        ) - 0.5;
        float broadNoise = fbm(p * 2.55 - warp * 0.62 + 13.4);
        float warpedArmDistance = abs(
          signedArmDistance
          + warp.y * armWidth * 0.54
          + (broadNoise - 0.5) * armWidth * 0.22
        );
        float armMask = 1.0 - smootherstep(
          armWidth * 0.66,
          armWidth * 2.28,
          warpedArmDistance
        );
        float cloudNoise = fbm(domain + warp * 1.55 + uTime * 0.0035);
        float breakup = smootherstep(0.32, 0.78, cloudNoise + broadNoise * 0.18);
        float upperGapNoise = fbm(domain * 0.82 + vec2(19.4, -7.2));
        float upperNoiseGap = 1.0 - upperArm
          * armBalance
          * smootherstep(0.56, 0.8, upperGapNoise)
          * 0.64;
        float upperGapA = smootherstep(0.31, 0.355, t)
          * (1.0 - smootherstep(0.405, 0.455, t));
        float upperGapB = smootherstep(0.535, 0.58, t)
          * (1.0 - smootherstep(0.63, 0.685, t));
        float upperWindowGap = max(upperGapA, upperGapB);
        float upperGap = upperNoiseGap
          * (1.0 - upperArm * upperWindowGap * 0.62);
        float brokenBody = armMask
          * armStart
          * outerFade
          * mix(0.2, 1.0, breakup)
          * upperGap;
        float connectorBody = armMask
          * armStart
          * outerFade
          * mix(0.28, 0.58, broadNoise)
          * mix(1.12, 0.72, upperArm);

        float midBody = smootherstep(0.12, 0.34, t)
          * (1.0 - smootherstep(0.62, 0.82, t));
        float armOpacity = mix(0.065, 0.105, midBody);
        armOpacity = mix(armOpacity, 0.03, smootherstep(0.68, 0.86, t));
        armOpacity *= mix(
          1.0 + armBalance * 0.1,
          1.0 - armBalance * 0.16,
          upperArm
        );
        float connectorOpacity = mix(0.028, 0.019, upperArm);
        float armAlpha = brokenBody * armOpacity + connectorBody * connectorOpacity;

        vec2 diskPoint = vec2(p.x, p.y / 0.62);
        float diskRadius = length(diskPoint);
        float diskShape = (1.0 - smootherstep(0.1, 0.335, diskRadius))
          * smootherstep(0.024, 0.07, diskRadius);
        float diskNoise = fbm(diskPoint * 8.2 + warp * 0.72 + 21.5);
        float rootBridge = armMask * (1.0 - smootherstep(0.24, 0.4, t));
        float diskAlpha = diskShape
          * mix(0.35, 1.0, smootherstep(0.28, 0.76, diskNoise))
          * (0.036 + rootBridge * 0.045);

        vec2 corePoint = vec2(p.x, p.y / 0.72);
        float coreRadius = length(corePoint);
        float coreNoise = fbm(corePoint * 10.5 + 4.2);
        float core = exp(-pow(coreRadius / 0.118, 2.3));
        float coreBreakup = mix(0.68, 1.0, smootherstep(0.26, 0.78, coreNoise));
        float coreAlpha = core * coreBreakup * mix(0.12, 0.17, coreNoise);

        float dustCenter = -armWidth * 0.48;
        float dustLane = 1.0 - smootherstep(
          armWidth * 0.11,
          armWidth * 0.48,
          abs(signedArmDistance - dustCenter)
        );
        float dustNoise = smootherstep(
          0.52,
          0.79,
          fbm(domain * 1.18 - warp * 0.84 + 37.2)
        );
        float dustWindow = smootherstep(0.1, 0.26, t)
          * (1.0 - smootherstep(0.66, 0.82, t));
        float dust = dustLane * dustNoise * armMask * dustWindow;
        armAlpha *= 1.0 - dust * mix(0.64, 0.74, upperArm);
        diskAlpha *= 1.0 - dust * 0.32;

        vec3 warmCore = vec3(1.0, 0.79, 0.58);
        vec3 iceDisk = vec3(0.37, 0.69, 0.95);
        vec3 deepBlue = vec3(0.075, 0.2, 0.42);
        vec3 violet = vec3(0.31, 0.22, 0.52);
        vec3 armColor = mix(iceDisk, deepBlue, smootherstep(0.22, 0.82, t));
        armColor = mix(armColor, violet, smootherstep(0.42, 0.82, broadNoise) * 0.52);

        float totalAlpha = coreAlpha + diskAlpha + armAlpha;
        vec3 color = (
          warmCore * coreAlpha
          + iceDisk * diskAlpha
          + armColor * armAlpha
        ) / max(totalAlpha, 0.0001);
        color = mix(color, vec3(0.075, 0.105, 0.16), dust * 0.24);

        float planeFade = 1.0 - smootherstep(uOuterRadius * 1.03, uOuterRadius * 1.18, radius);
        float alpha = totalAlpha * planeFade * uOpacity;
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

  mesh.name = 'CinematicGalaxyBaseLayer';
  mesh.position.z = -0.115;
  mesh.renderOrder = -8;
  mesh.frustumCulled = false;

  function update(time, pulse, journeyProgress = 0) {
    const visibility = 1 - smootherstep(0.32, 0.7, journeyProgress);

    material.uniforms.uTime.value = time;
    material.uniforms.uOpacity.value = visibility
      * layerWeight
      * (0.96 + pulse * 0.025);
  }

  function setHybridWeight(weight = 1) {
    layerWeight = Math.min(Math.max(weight, 0), 1);
  }

  function dispose() {
    geometry.dispose();
    material.dispose();
  }

  return { mesh, update, setHybridWeight, dispose };
}

function smootherstep(edge0, edge1, value) {
  const t = Math.min(Math.max((value - edge0) / (edge1 - edge0), 0), 1);
  return t * t * t * (t * (t * 6 - 15) + 10);
}

export const galaxyBaseLayerFactory = { createGalaxyBaseLayer };
