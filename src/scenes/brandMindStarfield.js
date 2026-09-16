import * as THREE from 'three';
import { getCamera } from '../engine/camera.js';

// Historical ART identities, not Canonical association IDs. Keep this explicit:
// the data panel's mock associations are not represented by these six slots.
export const STARFIELD_NODES = Object.freeze([
  { id: 'BrandMindAssociationNode1', position: [-1.44, .49, .12], radius: .21, color: '#9aabf2', phase: .3 },
  { id: 'BrandMindAssociationNode2', position: [1.27, .74, -.75], radius: .23, color: '#e6c38e', phase: 1.4 },
  { id: 'BrandMindAssociationNode3', position: [1.75, -.27, -1.2], radius: .21, color: '#a491e0', phase: 2.5 },
  { id: 'BrandMindAssociationNode4', position: [-1.07, -.91, -.45], radius: .23, color: '#829edb', phase: 3.7 },
  { id: 'BrandMindAssociationNode5', position: [.93, -.96, .06], radius: .19, color: '#c3cce8', phase: 4.8 },
  { id: 'BrandMindAssociationNode6', position: [-.43, 1.1, -1.4], radius: .17, color: '#80acdf', phase: 5.6 }
].map(n => Object.freeze({ ...n, position: Object.freeze(n.position), associationId: null })));
export const STARFIELD_PATHS = Object.freeze([
  ['BrandMindAssociationPath1', 'BrandMindAssociationNode1'],
  ['BrandMindAssociationPath2', 'BrandMindAssociationNode3'],
  ['BrandMindAssociationPath3', 'BrandMindAssociationNode5']
].map(([id, target]) => Object.freeze({ id, source: 'BrandMindCoreVolume', target, relationshipId: null })));
export function resolveBrandMindStarfield(search = '') {
  const q = new URLSearchParams(search);
  return ['1', 'A', 'B'].includes(q.get('brandMindStarfield')) ? Object.freeze({
    variant: q.get('brandMindStarfield') === 'B' ? 'B' : 'A',
    background: q.get('brandMindStarfieldBackground') !== '0', review: q.get('brandMindStarfieldReview') === '1'
  }) : null;
}
const TAU = Math.PI * 2;
const seed = n => { const x = Math.sin(n * 127.13 + 43.73) * 43758.5453; return x - Math.floor(x); };
const smooth = x => { x = THREE.MathUtils.clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const output = '\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n';
const basePosition = new THREE.Vector3(0, -.06, -.82);
const noPick = () => {};

// One family of local 3D energy material, not refraction or a screen-space image.
function energyMaterial(color, nucleus = false, variant = 'A') {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uColor: { value: new THREE.Color(color) },
      uNucleus: { value: nucleus ? 1 : 0 }, uVariant: { value: variant === 'B' ? 1 : 0 } },
    vertexShader: `varying vec3 vP,vN,vV;void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader: `varying vec3 vP,vN,vV;uniform float uTime,uReveal,uNucleus,uVariant;uniform vec3 uColor;
      float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
          mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+1.),f.x),f.y),f.z);}
      void main(){vec3 p=normalize(vP);float ndv=max(0.,dot(normalize(vN),normalize(vV)));float edge=pow(1.-ndv,2.8);
      float field=noise(p*3.2+vec3(0,uTime*.008,0))*.64+noise(p*7.7)*.26+noise(p*19.)*.10;
      float warp=field*4.+sin(p.x*4.+p.z*3.)*.7;
      float fold=sin(p.y*10.+p.x*5.+p.z*6.+warp);
      float vein=pow(max(0.,1.-abs(fold)),10.);
      float fine=pow(max(0.,1.-abs(sin(p.y*27.+p.x*13.+p.z*19.+warp*2.))),16.);
      float variation=smoothstep(.3,.7,field);
      float broken=pow(smoothstep(-.1,.9,sin(p.y*9.-p.x*5.+p.z*4.)),2.);
      vec3 color=mix(uColor*1.6,vec3(.27,.42,1.3),.18)*(.25+vein*.9+fine*.35+edge*broken*.7);
      float alpha=(.04+variation*.12+vein*variation*.46+fine*variation*.17+edge*broken*.20)*uReveal;
      if(uNucleus>.5){float light=.5+.5*dot(normalize(vN),normalize(vec3(-.45,.7,.8)));
        float density=smoothstep(.22,.72,field);
        color=mix(uColor,vec3(.7,.84,1.),.24)*(1.0+light*.9)*(.55+density*.7);
        color*=1.-uVariant*.18;alpha=uReveal*pow(ndv,.75)*(.23+density*.65);}
      gl_FragColor=vec4(color,alpha);${output}}
    ` });
}

// Open, tapered ribbons within a spherical envelope. The geometry is fixed;
// slow phase motion is emission only, so it cannot become a rotating orbital system.
export function energyArcPoint(layer, t, radius = 1, out = new THREE.Vector3()) {
  const a = -.9 + t * (4.25 + .12 * Math.sin(layer)) + layer * 1.61;
  const latitude = .26 * Math.sin(a * 1.4 + layer) + (layer % 3 - 1) * .22;
  const r = radius * (.67 + (layer % 4) * .078) * (.83 + .17 * Math.sin(a * 1.6 + layer));
  out.set(Math.cos(a) * Math.cos(latitude) * r, Math.sin(a) * Math.cos(latitude) * r, Math.sin(latitude) * r);
  out.applyAxisAngle(new THREE.Vector3(0, 1, 0), layer * .69 + .2);
  out.applyAxisAngle(new THREE.Vector3(1, 0, 0), layer * .83 + .4);
  return out;
}
function arcGeometry(radius, count = 7) {
  const positions = [], coords = [], p = new THREE.Vector3(), q = new THREE.Vector3(), side = new THREE.Vector3();
  const push = (l, t, v) => {
    energyArcPoint(l, t, radius, p); energyArcPoint(l, t + .001, radius, q);
    side.crossVectors(q.sub(p).normalize(), p).normalize();
    const width = radius * (.065 + .024 * Math.sin(l * 2)) * Math.pow(Math.sin(Math.PI * t), .7);
    p.addScaledVector(side, (v - .5) * width * 2);
    positions.push(p.x, p.y, p.z); coords.push(t, v, l);
  };
  for (let l = 0; l < count; l++) for (let i = 0; i < 120; i++) {
    const a = i / 120, b = (i + 1) / 120;
    push(l, a, 0); push(l, b, 0); push(l, a, 1); push(l, a, 1); push(l, b, 0); push(l, b, 1);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('aArc', new THREE.Float32BufferAttribute(coords, 3)); return g;
}
function arcMaterial(color, strength = 1) {
  return new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
    blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uColor: { value: new THREE.Color(color) }, uStrength: { value: strength } },
    vertexShader: 'attribute vec3 aArc;varying vec3 vArc;void main(){vArc=aArc;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec3 vArc;uniform float uTime,uReveal,uStrength;uniform vec3 uColor;void main(){
      float cross=exp(-pow((vArc.y-.5)*3.7,2.));float taper=smoothstep(0.,.12,vArc.x)*(1.-smoothstep(.82,1.,vArc.x));
      float knots=.10+.90*pow(.5+.5*sin(vArc.x*17.+vArc.z*2.8),2.);
      float moving=exp(-pow((vArc.x-fract(uTime*.018+vArc.z*.173))*27.,2.));
      float thread=exp(-pow((vArc.y-.48-.15*sin(vArc.x*17.+vArc.z))*24.,2.));
      vec3 c=mix(uColor*1.7,vec3(.85,.9,1.),moving*.3);
      float breakup=.18+.82*smoothstep(-.3,.75,sin(vArc.x*11.+vArc.z*1.3));
      gl_FragColor=vec4(c*(.8+moving*.6),cross*taper*breakup*(.2+knots*.66+thread*.18)*uReveal*uStrength);${output}}
    ` });
}
function particleBatch(name, records, motion = .002) {
  const positions = [], colors = [], data = [];
  for (const r of records) { const c = new THREE.Color(r.color); positions.push(...r.p); colors.push(c.r, c.g, c.b); data.push(r.size, r.alpha, seed(data.length + 13) * TAU); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('aData', new THREE.Float32BufferAttribute(data, 3));
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, vertexColors: true, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uHeight: { value: 900 }, uMotion: { value: motion } },
    vertexShader: `attribute vec3 aData;uniform float uTime,uReveal,uHeight,uMotion;varying vec3 vColor;varying float vAlpha;void main(){
      vec3 p=position+uMotion*vec3(sin(uTime*.03+aData.z),cos(uTime*.026+aData.z),sin(uTime*.021+aData.z));
      vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
      gl_PointSize=clamp(aData.x*length(modelViewMatrix[0].xyz)*uHeight*projectionMatrix[1][1]/max(.2,-mv.z),1.,24.);
      vColor=color;vAlpha=aData.y*uReveal;}`,
    fragmentShader: `varying vec3 vColor;varying float vAlpha;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
      gl_FragColor=vec4(vColor,exp(-r*r*5.)*(1.-smoothstep(.65,1.,r))*vAlpha);${output}}` });
  const points = new THREE.Points(geometry, material); points.name = name; points.raycast = noPick;
  const size = new THREE.Vector2(); points.onBeforeRender = r => { r.getDrawingBufferSize(size); material.uniforms.uHeight.value = size.y; };
  return points;
}
function makeEnergyBody(name, radius, color, variant, core = false) {
  const group = new THREE.Group(); group.name = name;
  const body = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 32), energyMaterial(color, false, variant));
  body.name = name + 'Envelope'; body.raycast = noPick; group.add(body);
  const nucleusGeometry = new THREE.SphereGeometry(radius * (core ? .28 : .3), 32, 24);
  const np = nucleusGeometry.attributes.position;
  for (let i = 0; i < np.count; i++) { const x = np.getX(i), y = np.getY(i), z = np.getZ(i); const k = 1 + .15 * Math.sin(x / radius * 26 + z / radius * 19) * Math.sin(y / radius * 24); np.setXYZ(i, x * k, y * k, z * k); }
  nucleusGeometry.computeVertexNormals();
  const nucleus = new THREE.Mesh(nucleusGeometry, energyMaterial(core ? '#b5ceff' : color, true, variant));
  nucleus.scale.set(1, .86, .94); nucleus.position.set(-radius * .06, radius * .02, 0); nucleus.raycast = noPick; group.add(nucleus);
  const arcs = new THREE.Mesh(arcGeometry(radius, core ? 9 : 4), arcMaterial(color, core ? .65 : .52)); arcs.raycast = noPick; group.add(arcs);
  const records = [], count = core ? 1100 : 110;
  for (let i = 0; i < count; i++) {
    const p = energyArcPoint(i % (core ? 9 : 4), seed(i * 3.17), radius);
    p.multiplyScalar(i < count * .4 ? .06 + seed(i * 7.3) * .29 : .8 + seed(i * 7.3) * .27); p.x += (seed(i * 13.4) - .5) * radius * .035;
    records.push({ p: p.toArray(), size: radius * (i % 61 === 0 ? .030 : .006 + seed(i) * .006), alpha: i % 61 === 0 ? .95 : .25 + seed(i * 7) * .3, color: i % 61 === 0 ? '#d6e5ff' : color });
  }
  group.add(particleBatch(name + 'InnerStellarStructure', records)); return group;
}

function makeEnvironment() {
  const group = new THREE.Group(); group.name = 'BrandMindMemoryCloud';
  const stars = []; for (let i = 0; i < 900; i++) stars.push({ p: [(seed(i * 7) - .5) * 17, (seed(i * 11) - .5) * 10, -3 - seed(i * 19) * 5], size: .009 + seed(i * 3) * .014, alpha: .12 + seed(i * 5) * .38, color: i % 13 === 0 ? '#a49dbd' : '#8098bc' });
  group.add(particleBatch('BrandMindFarStars', stars, 0));
  const dust = []; for (let i = 0; i < 1900; i++) {
    const t = seed(i * 2.17), band = i % 3, x = (t - .5) * 9;
    const y = Math.sin(t * 5 + band * 2.1) * (1.2 + band * .23) + (band - 1) * .45;
    const spread = (seed(i * 7.9) - .5) * (.28 + .28 * Math.sin(t * 8) ** 2);
    dust.push({ p: [x, y + spread, -1.6 - band * .8 + Math.sin(t * 6) * .3], size: .009 + seed(i * 23) * .013, alpha: (.08 + seed(i * 9.2) * .20) * (.3 + .7 * Math.sin(t * 12 + band) ** 2), color: band === 1 ? '#77739d' : '#668bab' });
  }
  group.add(particleBatch('BrandMindOrganizedDust', dust, .013));
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 } },
    vertexShader: 'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader: `varying vec2 vUv;uniform float uTime,uReveal;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 p=(vUv-.5)*vec2(10.,6.);float n=noise(p*1.2)*.6+noise(p*3.)*.28+noise(p*8.)*.12;
        float a=exp(-pow((p.y-sin(p.x*.72+.5)*1.25+.3)*2.4,2.));
        float b=exp(-pow((p.y-sin(p.x*.55+3.)*1.6-.35)*3.,2.));
        float ends=smoothstep(0.,.17,vUv.x)*smoothstep(0.,.17,1.-vUv.x)*smoothstep(0.,.15,vUv.y)*smoothstep(0.,.15,1.-vUv.y);
        float f=(a*.65+b*.4)*n*n*ends;
        vec3 c=mix(vec3(.060,.10,.22),vec3(.11,.070,.19),b);
        gl_FragColor=vec4(c,f*uReveal);${output}}
    ` });
  const cloud = new THREE.Mesh(new THREE.PlaneGeometry(13, 8), material); cloud.position.z = -3; cloud.raycast = noPick; group.add(cloud);
  const near = []; for (let i = 0; i < 28; i++) near.push({ p: [(seed(i * 2.3) - .5) * 8, (seed(i * 3.4) - .5) * 5, .3 + seed(i) * .5], size: .006, alpha: .11, color: '#7a8b9e' });
  group.add(particleBatch('BrandMindNearDust', near, .012)); return group;
}

function makePaths(nodes) {
  const group = new THREE.Group(); group.name = 'BrandMindAssociationPaths';
  const ends = STARFIELD_PATHS.map(d => nodes.get(d.target).position);
  const positions = [], params = [];
  for (let i = 0; i < 3; i++) for (let j = 0; j < 200; j++) { positions.push(0, 0, 0); params.push(j / 199, i); }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('aPath', new THREE.Float32BufferAttribute(params, 2));
  const material = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: { value: 0 }, uReveal: { value: 0 }, uHeight: { value: 900 }, uEnds: { value: ends } },
    vertexShader: `attribute vec2 aPath;uniform float uTime,uReveal,uHeight;uniform vec3 uEnds[3];varying float vAlpha;varying vec3 vColor;
      void main(){float t=aPath.x,id=aPath.y;vec3 end=uEnds[int(id+.5)];vec3 start=normalize(end)*.61;
        vec3 p=mix(start,end,t);p.y+=sin(t*3.14159)*(.22-id*.16);p.z+=sin(t*3.14159)*(-.25-id*.1);
        float cycle=mod(uTime*.067+id*.39,1.45);float packet=exp(-pow((t-cycle)*23.,2.));
        float ends=smoothstep(0.,.07,t)*(1.-smoothstep(.93,1.,t));
        vAlpha=uReveal*ends*(.10+packet*.9);vColor=mix(vec3(.16,.23,.42),vec3(.69,.79,1.),packet);
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=max(1.,(.004+packet*.012)*length(modelViewMatrix[0].xyz)*uHeight*projectionMatrix[1][1]/max(.2,-mv.z));}`,
    fragmentShader: `varying float vAlpha;varying vec3 vColor;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(vColor,exp(-r*r*5.)*vAlpha);${output}}` });
  const points = new THREE.Points(geometry, material); points.frustumCulled = false; points.raycast = noPick;
  const size = new THREE.Vector2(); points.onBeforeRender = r => { r.getDrawingBufferSize(size); material.uniforms.uHeight.value = size.y; }; group.add(points);
  for (const d of STARFIELD_PATHS) { const holder = new THREE.Group(); holder.name = d.id; holder.userData = { ...d }; group.add(holder); }
  return group;
}
function makeLabel() {
  const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 112;
  const ctx = canvas.getContext('2d'); ctx.font = '500 46px "Microsoft YaHei", sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#b9cee8'; ctx.fillText('品牌心智', 320, 72);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }));
  sprite.name = 'BrandMindStarfieldLabel'; sprite.scale.set(1.15, .20, 1); sprite.position.set(0, -.8, .06); sprite.raycast = noPick; return sprite;
}

export function createBrandMindStarfield(config, interactionTarget) {
  const group = new THREE.Group(); group.name = 'BrandMindScene'; group.position.copy(basePosition);
  const core = makeEnergyBody('BrandMindMindCore', .59, '#82b1ff', config.variant, true); group.add(core);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.59, 32, 24), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  hit.name = interactionTarget.objectName; core.add(hit);
  const nodes = new Map();
  for (const d of STARFIELD_NODES) { const n = makeEnergyBody(d.id, d.radius, d.color, config.variant); n.position.fromArray(d.position); n.userData = { visualId: d.id, associationId: null }; nodes.set(d.id, n); group.add(n); }
  const paths = makePaths(nodes), environment = makeEnvironment(), label = makeLabel(); group.add(paths, environment, label); environment.visible = config.background;
  const uniforms = []; group.traverse(o => { if (o.material?.uniforms) uniforms.push(o.material.uniforms); });
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), target = basePosition.clone(), temp = new THREE.Vector3();
  const reduced = globalThis.window?.matchMedia?.('(prefers-reduced-motion: reduce)');
  let clock = 0, panelOpen = false, panelMix = 0, fitScale = .7, sampleTime = null, disposed = false;
  function fitPanel() {
    const camera = getCamera(); if (!camera) return;
    const width = window.innerWidth, height = window.innerHeight;
    const right = document.querySelector('.brandmind-data-panel')?.getBoundingClientRect().left || width * .4;
    // Only Core + six finite bodies count, never environment, dust or glow.
    const center = temp.copy(basePosition).applyMatrix4(camera.matrixWorldInverse), depth = -center.z;
    const focal = camera.projectionMatrix.elements[5] * height / 2;
    const half = Math.max(60, (right - 48) / 2);
    fitScale = Math.min(.82, half * depth / (2.28 * focal + .22 * half));
    center.x = (right * .5 / width * 2 - 1) * depth / camera.projectionMatrix.elements[0]; center.y = 0;
    target.copy(center.applyMatrix4(camera.matrixWorld));
  }
  function update(renderState, delta, time, progress = 1) {
    if (disposed) return;
    const dt = Math.min(Math.max(delta, 0), 1 / 30), reveal = smooth((progress - .06) / .88);
    if (sampleTime !== null) clock = sampleTime;
    else if (delta === 0 && time === 12) clock = 12; // existing deterministic capture contract
    else if (!panelOpen && !reduced?.matches && !globalThis.document?.hidden && progress > .001) clock += dt;
    panelMix += (Number(panelOpen) - panelMix) * (1 - Math.exp(-dt * 12)); if (panelOpen) fitPanel();
    group.visible = progress > .001; group.position.copy(basePosition).lerp(target, panelMix); group.scale.setScalar(THREE.MathUtils.lerp(1, fitScale, panelMix));
    for (const d of STARFIELD_NODES) { const node = nodes.get(d.id); node.position.fromArray(d.position);
      node.position.x += Math.sin(clock * .031 + d.phase) * .018; node.position.y += Math.sin(clock * .023 + d.phase * 1.3) * .015; node.position.z += Math.cos(clock * .019 + d.phase) * .015;
    }
    for (const u of uniforms) { u.uTime.value = clock; u.uReveal.value = reveal; }
    environment.traverse(o => { if (o.material?.uniforms) o.material.uniforms.uReveal.value = reveal * (1 - panelMix * .55); });
    label.material.opacity = reveal * .85;
    // Preserve the frozen scene's existing exposure contribution, not a new gain.
    renderState.exposure += reveal * .008;
  }
  function read() { return { variant: config.variant, clock, panelOpen, panelMix, fitScale, coreRadius: .59,
    visualNodeIds: [...nodes.keys()], visualPathKeys: STARFIELD_PATHS.map(d => d.source + '>' + d.target),
    canonicalRegistryStatus: 'NEEDS_STABLE_REGISTRY_HOOK', mappedBusinessNodes: 0,
    particleCount: 5188, nodes: [...nodes].map(([id, n]) => ({ id, position: n.position.toArray() })) }; }
  const review = { read, sample(value) { if (value !== null && (!Number.isFinite(value) || value < 0)) throw new Error('Invalid sample time'); sampleTime = value; }, background(on) { environment.visible = !!on; } };
  if (import.meta.env?.DEV && config.review) { group.userData.cognitiveReview = review; window.__BRANDMIND_COGNITIVE_REVIEW__ = review; }
  return { name: 'BrandMindScene', group, isShell: false, primaryInteractionTargetName: interactionTarget.objectName,
    getPrimaryInteractionTarget({ x, y, camera }) { if (disposed || !group.visible || !camera || !Number.isFinite(x) || !Number.isFinite(y)) return null;
      camera.updateMatrixWorld(); group.updateWorldMatrix(true, true); pointer.set(x, y); raycaster.setFromCamera(pointer, camera); return raycaster.intersectObject(hit, false).length ? interactionTarget : null; },
    setPanelPresentationOpen(value) { panelOpen = !!value; }, getPanelPresentationState: () => ({ open: panelOpen, progress: panelMix, position: group.position.toArray(), scale: group.scale.x }),
    resolveVisualNode: id => disposed ? null : nodes.get(id) || null,
    resolveVisualPath: (source, targetId) => disposed ? null : group.getObjectByName(STARFIELD_PATHS.find(d => d.source === source && d.target === targetId)?.id) || null,
    readVisualRegistry: read, update,
    dispose() { if (disposed) return; disposed = true; const geometries = new Set(), materials = new Set(), textures = new Set();
      group.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (o.material) { materials.add(o.material); if (o.material.map) textures.add(o.material.map); } });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); textures.forEach(t => t.dispose()); nodes.clear(); group.clear();
      if (globalThis.window?.__BRANDMIND_COGNITIVE_REVIEW__ === review) delete window.__BRANDMIND_COGNITIVE_REVIEW__; delete group.userData.cognitiveReview;
    }
  };
}
