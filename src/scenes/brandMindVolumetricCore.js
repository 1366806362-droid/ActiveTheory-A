import * as THREE from 'three';

export const COGNITIVE_VOLUME_AXES = Object.freeze([0.58, 0.69, 0.50]);

export function resolveVolumetricCore(search = '') {
  const q = new URLSearchParams(search), value = q.get('brandMindVolumeV12');
  if (!['1', 'A', 'B'].includes(value)) return null;
  return { variant: value === 'A' ? 'A' : 'B', steps: q.get('brandMindVolumeSteps') === '24' ? 24 : 40,
    coreOnly: q.get('brandMindVolumeOnly') !== '0', interior: q.get('brandMindVolumeInterior') !== '0',
    surface: q.get('brandMindVolumeSurface') !== '0' };
}

// Object-local unit sphere intersection. The Mesh transform supplies ellipsoid axes.
export function volumeRayInterval(origin, direction) {
  const b = origin.dot(direction), c = origin.lengthSq() - 1, d = b * b - c;
  if (d <= 0) return null;
  const near = Math.max(0, -b - Math.sqrt(d)), far = -b + Math.sqrt(d);
  return far > near ? [near, far] : null;
}

export function integrateHomogeneousMedium(density, extinction, distance, steps) {
  let transmission = 1;
  const stepLength = distance / steps;
  for (let i = 0; i < steps; i++) transmission *= Math.exp(-density * extinction * stepLength);
  return { transmission, alpha: 1 - transmission };
}

const vertexShader = /* glsl */`
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */`
uniform vec3 uCameraLocal;
uniform float uTime, uReveal, uVariant, uInterior, uSurface;
varying vec3 vLocal;

// Stable object-local fields: bulk envelope, wrapping medium, restrained detail.
vec3 field(vec3 p) {
  vec3 q = p;
  q.x -= .075 * sin(p.y * 2.5 + .45);
  q.y += .035 * p.x * p.z;
  float r = length(q);
  float envelope = 1.0 - smoothstep(.83, .97, r);
  float phase = uTime * .028;
  float turn = q.x * 5.1 + q.y * 2.0 + sin(q.z * 3.8 + phase) * 1.45;
  float fold = .5 + .5 * sin(turn + cos(q.y * 3.0 - q.z * 2.4) * .9);
  float second = .5 + .5 * sin(q.y * 4.4 - q.z * 3.1 + sin(q.x * 3.1) * 1.2 - phase * .63);
  float band = mix(pow(fold, 2.8), pow(fold * .68 + second * .32, 2.0), uVariant);
  float detail = sin(q.x * 17.0 + q.z * 7.0) * sin(q.y * 15.0 - q.z * 8.0);
  float density = envelope * (.42 + band * 1.10 + second * .22 + detail * .035);
  if (uVariant > .5) {
    // Two broad, mutually wrapping media, not radial layers or thin trajectories.
    float sweep = q.z - .37 * sin(q.y * 2.7 + q.x * 1.4 + .55) - q.x * .22;
    float cross = q.x + .12 - .42 * sin(q.y * 2.6 - q.z * 1.8 + .40);
    float sheetA = exp(-pow(sweep / .14, 2.0));
    float sheetB = exp(-pow(cross / .17, 2.0));
    envelope = 1.0 - smoothstep(.91, .97, r);
    density = envelope * (.22 + 2.2 * sheetA + 1.65 * sheetB + detail * .018);
    band = clamp(sheetA * .78 + sheetB * .32, 0.0, 1.0);
  }
  return vec3(density, band, r);
}

void main() {
  vec3 origin = uCameraLocal, ray = normalize(vLocal - origin);
  float b = dot(origin, ray), d = b*b - dot(origin, origin) + 1.0;
  if (d <= 0.0) discard;
  float start = max(0.0, -b - sqrt(d)), finish = -b + sqrt(d);
  if (finish <= start) discard;
  float ds = (finish - start) / float(VOLUME_STEPS);
  float transmission = 1.0;
  vec3 radiance = vec3(0.0);
  for (int i = 0; i < VOLUME_STEPS; i++) {
    vec3 p = origin + ray * (start + (float(i) + .5) * ds);
    vec3 f = field(p);
    if (f.x < .001) continue;
    float skin = exp(-pow((f.z - .90) * 24.0, 2.0));
    float rho = f.x * mix(skin * .20, 1.0, uInterior);
    float sigma = 1.65;
    float stepAlpha = 1.0 - exp(-rho * sigma * ds);
    vec3 lightPoint = vec3(.10, .075, .045);
    vec3 delta = (p - lightPoint) / vec3(.30, .26, .33);
    float pearl = 2.7 * exp(-dot(delta, delta) * 1.15);
    if (uVariant > .5) {
      vec3 localLight = (p - vec3(-.16, .13, -.08)) / vec3(.24, .24, .25);
      pearl = 2.4 * exp(-dot(localLight, localLight)) * (.24 + f.y * .76);
    }
    vec3 broad = (p - vec3(-.16, -.12, -.10)) / vec3(.57, .50, .47);
    float bounce = .40 * exp(-dot(broad, broad));
    vec3 medium = mix(vec3(.065, .12, .25), vec3(.25, .43, .61), f.y);
    medium = mix(medium, vec3(.19, .16, .34), smoothstep(.0, .75, -p.z) * .24);
    // Artistic emissive source function; absorption is integrated front-to-back.
    // Not physical cognition, refraction, or multiple scattering.
    vec3 source = medium * (.40 + bounce) + vec3(1.04, 1.01, .92) * pearl;
    if (uVariant > .5) {
      vec3 ice = mix(vec3(.075, .16, .34), vec3(.39, .66, .77), f.y);
      float depthLight = .5 + .5 * smoothstep(-.75, .7, p.y - p.z * .65);
      source = ice * (depthLight + bounce) + vec3(.98, .96, .88) * pearl;
    }
    float grazing = pow(1.0 - abs(dot(normalize(p), ray)), 3.0);
    float uneven = .12 + .88 * max(0.0, dot(normalize(p), normalize(vec3(-.5, .7, .5))));
    vec3 surface = vec3(.28, .53, .77) * skin * grazing * uneven * 1.5;
    source = source * uInterior + surface * uSurface;
    radiance += transmission * stepAlpha * source;
    transmission *= 1.0 - stepAlpha;
    if (transmission < .006) break;
  }
  float alpha = 1.0 - transmission;
  if (alpha < .001) discard;
  // Straight alpha: undo accumulation alpha once, then let NormalBlending apply it.
  // Into Composer this stays linear; OutputPass performs ACES + display transfer.
  gl_FragColor = vec4(radiance / max(alpha, .00001), alpha * uReveal);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

export function createVolumetricCore(config) {
  const geometry = new THREE.BoxGeometry(2, 2, 2);
  const material = new THREE.ShaderMaterial({ name: 'BrandMindBoundedVolume',
    defines: { VOLUME_STEPS: config.steps }, vertexShader, fragmentShader,
    transparent: true, premultipliedAlpha: false, blending: THREE.NormalBlending,
    depthWrite: false, side: THREE.BackSide, fog: false,
    uniforms: { uCameraLocal: { value: new THREE.Vector3() }, uTime: { value: 0 },
      uReveal: { value: 0 }, uVariant: { value: config.variant === 'B' ? 1 : 0 },
      uInterior: { value: Number(config.interior) }, uSurface: { value: Number(config.surface) } }
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'BrandMindVolumetricMedium'; mesh.scale.fromArray(COGNITIVE_VOLUME_AXES);
  mesh.rotation.z = -.15; mesh.raycast = () => {}; mesh.renderOrder = 10;
  const inverse = new THREE.Matrix4();
  mesh.onBeforeRender = (renderer, scene, camera) => {
    inverse.copy(mesh.matrixWorld).invert();
    material.uniforms.uCameraLocal.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
  };
  let disposed = false;
  return { mesh, axes: COGNITIVE_VOLUME_AXES, config,
    update(time, reveal) { material.uniforms.uTime.value = time; material.uniforms.uReveal.value = reveal; },
    layers(interior, surface) { material.uniforms.uInterior.value = Number(interior); material.uniforms.uSurface.value = Number(surface); },
    dispose() { if (disposed) return; disposed = true; geometry.dispose(); material.dispose(); }
  };
}
