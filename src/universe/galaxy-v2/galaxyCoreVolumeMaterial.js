import * as THREE from 'three';

export function createGalaxyCoreVolumeMaterial(opacity) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uJourneyOpacity: { value: 1 }
    },
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
    fog: false,
    vertexShader: `
      uniform float uTime;
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;

      void main() {
        float distortion = sin(position.x * 17.0 + position.y * 11.0 + position.z * 13.0 + uTime * 0.035) * 0.025;
        vec3 displaced = position + normal * distortion;
        vLocalPosition = displaced;
        vViewNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform float uOpacity;
      uniform float uJourneyOpacity;
      varying vec3 vLocalPosition;
      varying vec3 vViewNormal;

      float hash(vec3 point) {
        return fract(sin(dot(point, vec3(127.1, 311.7, 74.7))) * 43758.5453);
      }

      float noise(vec3 point) {
        vec3 cell = floor(point);
        vec3 local = fract(point);
        local = local * local * (3.0 - 2.0 * local);
        float x00 = mix(hash(cell), hash(cell + vec3(1.0, 0.0, 0.0)), local.x);
        float x10 = mix(hash(cell + vec3(0.0, 1.0, 0.0)), hash(cell + vec3(1.0, 1.0, 0.0)), local.x);
        float x01 = mix(hash(cell + vec3(0.0, 0.0, 1.0)), hash(cell + vec3(1.0, 0.0, 1.0)), local.x);
        float x11 = mix(hash(cell + vec3(0.0, 1.0, 1.0)), hash(cell + vec3(1.0)), local.x);
        return mix(mix(x00, x10, local.y), mix(x01, x11, local.y), local.z);
      }

      void main() {
        float radial = length(vLocalPosition.xy);
        float center = 1.0 - smoothstep(0.06, 0.98, radial);
        float vertical = 1.0 - smoothstep(0.28, 1.0, abs(vLocalPosition.z));
        float facing = smoothstep(0.04, 0.7, abs(vViewNormal.z));
        float densityNoise = noise(vLocalPosition * 5.8 + vec3(uTime * 0.006, 0.0, -uTime * 0.004));
        float fineNoise = noise(vLocalPosition * 13.0 - vec3(0.0, uTime * 0.008, 0.0));
        float irregularity = 0.48 + densityNoise * 0.38 + fineNoise * 0.14;
        float dustCurve = vLocalPosition.y + sin(vLocalPosition.x * 8.0 + 0.6) * 0.15 - 0.035;
        float dustLane = exp(-pow(dustCurve / 0.105, 2.0))
          * smoothstep(0.32, 0.72, fineNoise);
        float transmission = 1.0 - dustLane * 0.72;
        float density = pow(max(center, 0.0), 1.42) * vertical * facing * irregularity * transmission;

        vec3 hot = vec3(0.98, 0.89, 0.7);
        vec3 champagne = vec3(0.82, 0.62, 0.39);
        vec3 outer = vec3(0.55, 0.53, 0.5);
        vec3 color = mix(champagne, hot, 1.0 - smoothstep(0.0, 0.28, radial));
        color = mix(color, outer, smoothstep(0.42, 0.95, radial));
        float alpha = density * uOpacity * uJourneyOpacity;

        if (alpha < 0.002) discard;
        gl_FragColor = vec4(color * (0.58 + center * 0.42), alpha);
      }
    `
  });
}
