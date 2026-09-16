import * as THREE from 'three';

export const COGNITIVE_VOLUME_AXES = Object.freeze([0.58, 0.69, 0.50]);

export function resolveVolumetricCore(search = '') {
  const q = new URLSearchParams(search), clarity = q.get('brandMindCoreClarity');
  const profile = ['1', 'A', 'B'].includes(clarity) ? (clarity === 'B' ? 2 : 1) : 0;
  const value = profile ? 'B' : q.get('brandMindVolumeV12');
  if (!['1', 'A', 'B'].includes(value)) return null;
  return { variant: value === 'A' ? 'A' : 'B', profile, steps: q.get('brandMindVolumeSteps') === '24' ? 24 : 40,
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

// Reference for the candidate's per-channel segment equation (j is independent
// of extinction). Used for numerical regression, never a business mapping.
export function integrateConstantEmission(density, extinction, emission, distance, steps) {
  const sigma = density * extinction, ds = distance / steps;
  const attenuation = Math.exp(-sigma * ds);
  const segment = sigma > .0001 ? (1 - attenuation) / sigma : ds;
  let transmission = 1, radiance = 0;
  for (let i = 0; i < steps; i++) { radiance += transmission * segment * emission; transmission *= attenuation; }
  return { transmission, radiance };
}

const vertexShader = /* glsl */`
varying vec3 vLocal;
void main() {
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const fragmentShader = /* glsl */`
uniform vec3 uCameraLocal;
uniform float uTime, uReveal, uVariant, uInterior, uSurface, uDebug, uProfile;
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

// Finite object-local condensations, rather than two opaque sheets crossing the
// entire enclosure. Density and emissivity deliberately have separate fields.
float square(float x) { return x * x; }
float fourth(float x) { float s = x * x; return s * s; }
vec4 clarityField(vec3 p) {
  vec3 q = p;
  q.x -= .045 * sin(p.y * 3.0 + .4);
  float r = length(q), envelope = 1.0 - smoothstep(.72, .98, r);
  float slow = sin(uTime * .019) * .009;
  float backZ = -.34 + .15 * sin(q.x * 4.1 + .6) + q.y * .18;
  float back = exp(-square((q.z - backZ) / .095))
    * exp(-fourth((q.x - .06) / .60) - fourth((q.y - .24) / .30));
  float frontZ = .23 + .16 * sin(q.y * 4.2 - .3) + q.x * .22;
  float front = exp(-square((q.z - frontZ) / .085))
    * exp(-fourth((q.x + .30) / .27) - fourth((q.y + .10) / .51));
  vec3 lowerP = (q - vec3(.23, -.36, -.05)) / vec3(.34, .16, .29);
  float lower = exp(-dot(lowerP, lowerP) * 1.6);
  if (uProfile < 1.5) {
    // Bounded lobes have readable medium-scale shoulders, not Gaussian fog
    // everywhere. Smooth finite transitions remain stable at 24/40 steps.
    float rearFootprint = length((q.xy - vec2(.06,.26)) / vec2(.62,.28));
    float nearFootprint = length((q.xy - vec2(-.30,-.10)) / vec2(.24,.52));
    back = (1.0 - smoothstep(.55,1.0,rearFootprint)) * exp(-square((q.z-backZ)/.095));
    front = (1.0 - smoothstep(.50,1.0,nearFootprint)) * exp(-square((q.z-frontZ)/.085));
    lower = 1.0 - smoothstep(.35,1.0,length(lowerP));
  }
  // B organizes the middle as localized volumes, not continuous laminae.
  if (uProfile > 1.5) {
    vec3 rearP = (q - vec3(.21, .32, -.32)) / vec3(.39, .21, .19);
    vec3 nearP = (q - vec3(-.35, -.13, .24)) / vec3(.19, .39, .19);
    back = exp(-dot(rearP, rearP) * 1.3);
    front = exp(-dot(nearP, nearP) * 1.3);
  }
  float organization = back * .9 + front * .7 + lower * .8;
  if (uProfile < 1.5) {
    float pockets = .45 + .55 * pow(.5 + .5 * sin(q.x * 11.0 + q.y * 8.0 + sin(q.z * 6.0)), .7);
    organization *= pockets;
  }
  float channel = exp(-square((q.x - .10 - .12 * q.y) / .16)
    - fourth((q.y + .05) / .44));
  float density = envelope * (.045 + organization * .75) * (1.0 - .67 * channel);
  vec3 lightP = q - vec3(-.025 + slow, .055, -.025);
  lightP.x += .045 * sin(lightP.y * 13.0 + lightP.z * 7.0);
  vec3 lightShape = lightP / vec3(.135, .20, .15);
  float nucleus = exp(-dot(lightShape, lightShape) * 1.6);
  if (uProfile < 1.5) {
    nucleus = 1.0 - smoothstep(.18,1.0,length(lightShape));
    // One connected, asymmetric inner source with a low-emission crease.
    float crease = exp(-square((lightP.x + lightP.z * .42 - .035) / .021));
    nucleus *= 1.0 - .55 * crease;
  }
  float granulation = .82 + .18 * sin(q.x * 49.0 + q.z * 17.0) * sin(q.y * 43.0 - q.z * 29.0);
  float light = nucleus * granulation;
  return vec4(density, organization * envelope, light, r);
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
  vec3 internalLight = vec3(0.0), contourLight = vec3(0.0);
  for (int i = 0; i < VOLUME_STEPS; i++) {
    vec3 p = origin + ray * (start + (float(i) + .5) * ds);
    if (uProfile > .5) {
      vec4 c = clarityField(p);
      float rho = c.x * uInterior;
      float extinction = rho * 1.65;
      float absorb = 1.0 - exp(-extinction * ds);
      // Exact constant-segment emission integral, including the vacuum limit.
      // Emission does not disappear when a low-density channel becomes clear.
      float segment = extinction > .0001 ? absorb / extinction : ds;
      float innerBounce = exp(-dot(p - vec3(-.025,.055,-.025), p - vec3(-.025,.055,-.025)) * 3.0);
      vec3 mediumColor = mix(vec3(.028,.065,.14),vec3(.18,.36,.48),smoothstep(-.45,.35,p.z));
      float structure = c.y * (.24 + innerBounce * .65) * (uProfile < 1.5 ? 5.5 : 1.0);
      vec3 mediumLight = mediumColor * structure + vec3(.007,.016,.038) * (1.0 - smoothstep(.5,.95,c.w));
      vec3 coreLight = vec3(.83,.91,.98) * c.z * (uProfile < 1.5 ? 3.8 : 6.5);
      float edge = exp(-square((c.w - .87) / .07));
      float facing = pow(clamp(1.0 - abs(dot(normalize(p),ray)),0.0,1.0),3.0);
      vec3 contour = vec3(.018,.04,.075) * edge * facing * (.25 + .75 * max(0.0,p.y));
      vec3 emission = (mediumLight + coreLight) * uInterior + contour * uSurface;
      radiance += transmission * segment * emission;
      internalLight += transmission * segment * coreLight * uInterior;
      contourLight += transmission * segment * contour * uSurface;
      transmission *= 1.0 - absorb;
      continue;
    }
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
    internalLight += transmission * stepAlpha * vec3(.98, .96, .88) * pearl;
    contourLight += transmission * stepAlpha * surface;
    source = source * uInterior + surface * uSurface;
    radiance += transmission * stepAlpha * source;
    transmission *= 1.0 - stepAlpha;
    if (transmission < .006) break;
  }
  float alpha = 1.0 - transmission;
  if (alpha < .001 && uProfile < .5) discard;
  // Straight alpha: undo accumulation alpha once, then let NormalBlending apply it.
  // Into Composer this stays linear; OutputPass performs ACES + display transfer.
  // Tiny nonzero coverage permits emissive vacuum channels under straight alpha.
  alpha = uProfile > .5 ? max(alpha, .001) : alpha;
  gl_FragColor = vec4(radiance / max(alpha, .00001), alpha * uReveal);
  if (uDebug > .5 && uDebug < 1.5) gl_FragColor = vec4(internalLight, 1.0);
  if (uDebug > 1.5 && uDebug < 2.5) gl_FragColor = vec4(vec3(transmission), 1.0);
  if (uDebug > 2.5 && uDebug < 3.5) gl_FragColor = vec4(vec3(field(origin + ray * ((start + finish) * .5)).x / 4.1), 1.0);
  if (uDebug > 3.5 && uDebug < 4.5) gl_FragColor = vec4(contourLight, 1.0);
  if (uProfile > .5 && uDebug > 2.5 && uDebug < 3.5) gl_FragColor = vec4(vec3(clarityField(origin + ray * ((start + finish) * .5)).x / 4.1), 1.0);
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
      uInterior: { value: Number(config.interior) }, uSurface: { value: Number(config.surface) }, uDebug: { value: 0 }, uProfile: { value: config.profile || 0 } }
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'BrandMindVolumetricMedium'; mesh.scale.fromArray(COGNITIVE_VOLUME_AXES);
  mesh.rotation.z = -.15; mesh.raycast = () => {}; mesh.renderOrder = 10;
  const inverse = new THREE.Matrix4();
  const renderInfo = { target: null, canvas: null, dpr: null, toneMapping: null, exposure: null };
  mesh.userData.volumeRenderInfo = renderInfo;
  mesh.onBeforeRender = (renderer, scene, camera) => {
    inverse.copy(mesh.matrixWorld).invert();
    material.uniforms.uCameraLocal.value.setFromMatrixPosition(camera.matrixWorld).applyMatrix4(inverse);
    if (renderer && !renderInfo.canvas) {
      const target = renderer.getRenderTarget();
      renderInfo.target = target ? [target.width, target.height] : null;
      renderInfo.canvas = [renderer.domElement.width, renderer.domElement.height];
      renderInfo.dpr = renderer.getPixelRatio();
      renderInfo.toneMapping = renderer.toneMapping;
      renderInfo.exposure = renderer.toneMappingExposure;
    }
  };
  let disposed = false;
  return { mesh, axes: COGNITIVE_VOLUME_AXES, config,
    diagnostic(mode = 0) { if (!Number.isInteger(mode) || mode < 0 || mode > 4) throw new Error('Invalid volume diagnostic'); material.uniforms.uDebug.value = mode; },
    readRenderInfo() { return { ...renderInfo }; },
    update(time, reveal) { material.uniforms.uTime.value = time; material.uniforms.uReveal.value = reveal; },
    layers(interior, surface) { material.uniforms.uInterior.value = Number(interior); material.uniforms.uSurface.value = Number(surface); },
    dispose() { if (disposed) return; disposed = true; geometry.dispose(); material.dispose(); }
  };
}
