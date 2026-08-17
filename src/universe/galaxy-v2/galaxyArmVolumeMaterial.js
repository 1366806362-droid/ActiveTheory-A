import * as THREE from 'three';
import { GPU_GALAXY_V2_DUST_FIELD } from './galaxyV2Config.js';

export function createGalaxyArmVolumeMaterial(opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uJourneyOpacity: { value: 1 },
      uDustCenter: { value: GPU_GALAXY_V2_DUST_FIELD.laneCenter },
      uDustWobble: { value: GPU_GALAXY_V2_DUST_FIELD.laneWobble }
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
    fog: false,
    vertexShader: `
      uniform float uTime;
      attribute vec2 aArmUv;
      attribute float aRadius;
      attribute float aArmIndex;
      varying vec2 vArmUv;
      varying float vArmIndex;
      varying float vDepthCue;

      vec2 rotate2d(vec2 point, float angle) {
        float sine = sin(angle);
        float cosine = cos(angle);
        return mat2(cosine, -sine, sine, cosine) * point;
      }

      void main() {
        float radialProgress = clamp(aRadius, 0.0, 1.25);
        float angularSpeed = mix(0.018, 0.0045, smoothstep(0.08, 1.1, radialProgress));
        vec3 animated = position;
        animated.xy = rotate2d(animated.xy, uTime * angularSpeed);
        animated.z += sin(uTime * 0.09 + aArmUv.x * 7.0 + aArmIndex) * 0.0025;

        vArmUv = aArmUv;
        vArmIndex = aArmIndex;
        vDepthCue = smoothstep(-0.16, 0.16, animated.z);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(animated, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uJourneyOpacity;
      uniform float uDustCenter;
      uniform float uDustWobble;
      varying vec2 vArmUv;
      varying float vArmIndex;
      varying float vDepthCue;

      float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 point) {
        vec2 cell = floor(point);
        vec2 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        return mix(
          mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x),
          mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0)), local.x),
          local.y
        );
      }

      float fbm(vec2 point) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise(point) * amplitude;
          point = mat2(1.58, -1.16, 1.16, 1.58) * point + 0.37;
          amplitude *= 0.48;
        }
        return value;
      }

      void main() {
        float progress = vArmUv.x;
        float lateral = vArmUv.y;
        vec2 armSpace = vec2(progress * 10.0, lateral * 2.6);
        float warp = fbm(armSpace * 0.62 + vec2(uTime * 0.006, -uTime * 0.004));
        float mediumNoise = fbm(armSpace + vec2(warp * 1.7, -warp * 1.2));
        float fineNoise = noise(armSpace * 3.4 + warp * 2.1);
        float erodedEdge = abs(lateral) + (warp - 0.5) * 0.34 + (fineNoise - 0.5) * 0.12;
        float edge = pow(max(0.0, 1.0 - smoothstep(0.48, 1.02, erodedEdge)), 1.45);
        float radialFade = smoothstep(0.0, 0.08, progress) * (1.0 - smoothstep(0.8, 1.0, progress));
        float clumps = smoothstep(0.34, 0.73, mediumNoise * 0.74 + fineNoise * 0.26);
        float wisps = smoothstep(0.38, 0.72, mediumNoise * 0.68 + fineNoise * 0.32);
        float breakup = 0.06 + clumps * 0.5 + wisps * 0.58;
        float secondArm = step(0.5, vArmIndex);
        float gapWindow = smoothstep(0.55, 0.61, progress) * (1.0 - smoothstep(0.68, 0.73, progress));
        float armContinuity = 1.0 - secondArm * gapWindow * 0.88;
        float tailErosion = 1.0 - smoothstep(0.69, 1.0, progress)
          * smoothstep(0.48, 0.8, noise(vec2(progress * 31.0, vArmIndex * 4.7)));

        float laneCenter = -0.2 + sin(progress * 13.0 + vArmIndex * 1.7) * (0.09 + uDustWobble * 2.0)
          + uDustCenter * 0.5;
        float laneWidth = mix(0.17, 0.27, noise(vec2(progress * 8.0, vArmIndex + 2.0)));
        float dustLane = exp(-pow((lateral - laneCenter) / laneWidth, 2.0));
        float dustBreakup = smoothstep(0.28, 0.66, noise(vec2(progress * 26.0, vArmIndex * 5.0 + 1.3)));
        float dustTransmission = 1.0 - dustLane * dustBreakup * 0.94;

        float density = edge * radialFade * breakup * armContinuity * tailErosion * dustTransmission;
        float depthLight = mix(0.74, 1.08, vDepthCue) * mix(1.0, 0.82, secondArm);
        vec3 warm = vec3(0.76, 0.69, 0.58);
        vec3 neutral = vec3(0.62, 0.69, 0.77);
        vec3 cold = vec3(0.34, 0.47, 0.64);
        vec3 color = mix(warm, neutral, smoothstep(0.15, 0.52, progress));
        color = mix(color, cold, smoothstep(0.52, 0.98, progress));
        float alpha = density * depthLight * uOpacity * uJourneyOpacity;

        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color * (0.36 + clumps * 0.46), alpha);
      }
    `
  });
}
