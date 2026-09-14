import * as THREE from 'three';
import { assertFiveAStageValues, FIVE_A_RENDERER_STAGE_IDS } from '../v2/renderer-adapters/fiveAStageRendererAdapter.js';
import { makeParticleStarSupport, makeParticleStars, applyParticleStarOcclusion } from './fiveAParticleStars.js';
import { resolveFiveAColorDepth, FIVE_A_COLOR_CORE_RADIUS } from './fiveAColorDepth.js';

// Art-only registry. Radius and phase never consume a Snapshot or BindingPlan.
export const ORBITAL_STAGES = Object.freeze({
  A1: Object.freeze({ label: 'AWARE', radius: 1.08, size: .123, phase: 2.85, speed: .055, tilt: .72 }),
  A2: Object.freeze({ label: 'APPEAL', radius: 1.49, size: .14, phase: .65, speed: .047, tilt: .74 }),
  A3: Object.freeze({ label: 'ASK', radius: 1.90, size: .158, phase: 4.50, speed: .040, tilt: .76 }),
  A4: Object.freeze({ label: 'ACT', radius: 2.31, size: .138, phase: 1.95, speed: .034, tilt: .78 }),
  A5: Object.freeze({ label: 'ADVOCATE', radius: 2.72, size: .132, phase: 5.85, speed: .029, tilt: .80 })
});
export function resolveFiveAOrbital(search = '') {
  const q = new URLSearchParams(search);
  if (!['1', 'A', 'B'].includes(q.get('fiveAOrbital'))) return null;
  const colorDepth=resolveFiveAColorDepth(search);
  const requestedEnergy=q.get('fiveAEnergyStars') || (colorDepth ? 'A' : null);
  const energyStars=['1','A','B'].includes(requestedEnergy)?(requestedEnergy==='B'?'B':'A'):null;
  return { variant: q.get('fiveAOrbital') === 'B' ? 'B' : 'A', skeleton: q.get('orbitalSkeleton') === '1',
    frozen: q.get('v2FiveACapture') === '1', energyStars, colorDepth,
    particleStars: ['1','A','B'].includes(q.get('fiveAParticleStars')) ? (q.get('fiveAParticleStars') === 'A' ? 'A' : 'B') : energyStars?'B':null };
}
export function orbitalPose(id, time, target, variant = 'A') {
  const a = ORBITAL_STAGES[id];
  const theta = a.phase + time * a.speed;
  return orbitalPoint(a.radius, theta, a.tilt + (variant === 'B' ? .15 : 0), target);
}
function orbitalPoint(r, theta, tilt, target) {
  const x = r * Math.cos(theta), y = r * Math.sin(theta) * Math.cos(tilt), z = r * Math.sin(theta) * Math.sin(tilt);
  const turn = -.20;
  return target.set(x * Math.cos(turn) - y * Math.sin(turn), x * Math.sin(turn) + y * Math.cos(turn), z);
}
// Unwrapped phases are used, not atan2 shortest-path jumps. A smooth radial
// interpolation remains outside the central star even as endpoints orbit.
export function orbitalFlowPoint(sourceId, targetId, time, t, out, variant = 'A') {
  const a = ORBITAL_STAGES[sourceId], b = ORBITAL_STAGES[targetId];
  const phase = THREE.MathUtils.lerp(a.phase + time * a.speed, b.phase + time * b.speed, t);
  return orbitalPoint(THREE.MathUtils.lerp(a.radius, b.radius, t), phase,
    THREE.MathUtils.lerp(a.tilt, b.tilt, t) + (variant === 'B' ? .15 : 0), out);
}
export function advanceOrbitalClock(time, delta, { paused = false, hidden = false, active = true } = {}) {
  // Drop hidden/resume gaps rather than integrating a large wall-clock step.
  return time + (paused || hidden || !active ? 0 : Math.min(.05, Math.max(0, delta)));
}

export function createFiveAOrbitalParts(config) {
  const group = new THREE.Group(); group.name = 'FiveAOrbitSystem';
  const sphereGeometry = new THREE.SphereGeometry(1, 40, 28);
  const nodes = new Map(), bindings = new Map(), targets = new Map();
  const journey = [new THREE.Vector3(), ...FIVE_A_RENDERER_STAGE_IDS.map(() => new THREE.Vector3())];
  const orbitPositions = [], orbitColors = [];
  let disposed = false, time = 0, reveal = 1, hover = 0, particles = null;
  const coreGroup = new THREE.Group(); coreGroup.name = 'FiveACore';
  const coreMaterial = config.skeleton ? new THREE.MeshBasicMaterial({ color: 0x8baec5, fog: false }) : config.particleStars ? makeParticleStarSupport(true) : makeSphereMaterial(true);
  const coreMesh = new THREE.Mesh(sphereGeometry, coreMaterial);
  const coreRadius=config.colorDepth?FIVE_A_COLOR_CORE_RADIUS:.48;
  coreMesh.name = 'FiveACorePrimaryHitTarget'; coreMesh.scale.setScalar(coreRadius);
  coreGroup.add(coreMesh);
  const coreLabel = makeLabel('5A', .56); coreLabel.group.name = 'FiveASceneTitle'; coreLabel.group.position.set(0,.64,0);
  coreGroup.add(coreLabel.group);
  if(config.colorDepth)coreLabel.group.position.y=.75;

  for (const [slot, id] of FIVE_A_RENDERER_STAGE_IDS.entries()) {
    const art = ORBITAL_STAGES[id], pose = new THREE.Group(), visual = new THREE.Group();
    pose.name = `FiveAOrbitPose${id}`; visual.name = `FiveAStageNode${id}`;
    pose.add(visual); group.add(pose);
    const material = config.skeleton ? new THREE.MeshBasicMaterial({ color: 0x5c9dbb, fog: false }) : config.particleStars ? makeParticleStarSupport(false) : makeSphereMaterial(false);
    const mesh = new THREE.Mesh(sphereGeometry, material); mesh.name = `FiveAOrbitalBody${id}`; mesh.scale.setScalar(art.size);
    visual.add(mesh);
    const label = makeLabel(`${id} ${art.label}`, .88); label.group.name = `FiveALabel${id}`; group.add(label.group);
    const binding = { scale: 1, energy: 1 }; bindings.set(id, binding);
    const node = { id, slot, art, pose, visual, mesh, material, label, opacity: 1 }; nodes.set(id, node);
    const refresh = () => {
      visual.scale.setScalar(binding.scale);
      node.opacity = binding.energy;
      if(material.uniforms) material.uniforms.uEnergy.value = binding.energy;
      visual.updateMatrix(); pose.updateMatrix();
      if(particles){ particles.matrices[slot+1].makeScale(art.size*binding.scale,art.size*binding.scale,art.size*binding.scale).setPosition(pose.position);particles.energy[slot+1]=binding.energy; }
    };
    targets.set(id, Object.freeze({ stageId: id, read() {
      if (disposed) throw new Error('Stage target disposed');
      const matrix = new THREE.Matrix4().multiplyMatrices(pose.matrix, visual.matrix);
      return { binding: { ...binding }, matrix: matrix.toArray(), pointScale: art.size * binding.scale, opacity: node.opacity };
    }, write(values) { if (disposed) throw new Error('Stage target disposed'); assertFiveAStageValues(values); Object.assign(binding, values); refresh(); } }));
    node.refresh = refresh;
    const v = new THREE.Vector3();
    for (let n = 0; n < 192; n++) {
      for (const k of [n,n+1]) {
        orbitalPoint(art.radius,k/192*Math.PI*2,art.tilt+(config.variant==='B'?.15:0),v);
        orbitPositions.push(v.x,v.y,v.z);
        const weight = .32 + .68 * Math.pow(.5+.5*Math.cos(k/192*Math.PI*2+.6),2);
        orbitColors.push(.16*weight,.33*weight,.45*weight);
      }
    }
  }
  const orbitGeometry = new THREE.BufferGeometry();
  orbitGeometry.setAttribute('position',new THREE.Float32BufferAttribute(orbitPositions,3));
  orbitGeometry.setAttribute('color',new THREE.Float32BufferAttribute(orbitColors,3));
  const orbitMaterial = new THREE.LineBasicMaterial({ vertexColors:true, transparent:true, opacity:.36, depthWrite:false, depthTest:true, fog:false });
  const lines = new THREE.LineSegments(orbitGeometry,orbitMaterial); lines.name='FiveAOrbitalTracks'; group.add(lines);
  particles = config.skeleton ? null : config.particleStars ? makeParticleStars(config.particleStars,config.energyStars,config.colorDepth) : makeOrbitalParticles();
  if(particles)group.add(particles.points);
  if(config.particleStars && particles)applyParticleStarOcclusion(orbitMaterial,particles.matrices);

  function update(delta, seconds, entrance) {
    time = seconds; reveal = THREE.MathUtils.smoothstep(entrance, .10, .72);
    for (const [id,node] of nodes) {
      orbitalPose(id,time,node.pose.position,config.variant);
      node.refresh(); journey[node.slot+1].copy(node.pose.position);
      if(node.material.uniforms)node.material.uniforms.uTime.value=time;
      node.label.group.position.copy(node.pose.position); node.label.group.position.y += node.art.size * bindings.get(id).scale + .14;
      node.label.material.opacity = reveal * .88;
    }
    orbitMaterial.opacity = reveal * .36;
    if(particles) {
      particles.material.uniforms.uTime.value=time;
      particles.matrices[0].makeScale(coreRadius,coreRadius,coreRadius);
      for(const n of nodes.values()) {
        particles.matrices[n.slot+1].makeScale(n.art.size*bindings.get(n.id).scale,n.art.size*bindings.get(n.id).scale,n.art.size*bindings.get(n.id).scale).setPosition(n.pose.position);
        particles.energy[n.slot+1]=bindings.get(n.id).energy;
      }
    }
  }
  const orbitSystem = { group, update,
    getJourneyStagePositions:()=>journey,
    resolveStageBindingTarget:id=>id==='A3'?targets.get(id):null,
    resolveStageRendererTarget(id) { if(disposed)throw new Error('Stage target disposed'); return targets.get(id)??null; },
    getStatus:()=>[...nodes.values()].map(n=>({id:n.id,uuid:n.visual.uuid,position:n.pose.position.toArray(),phase:n.art.phase+time*n.art.speed})),
    dispose() { disposed=true; for(const n of nodes.values()){n.material.dispose();n.label.dispose();} orbitGeometry.dispose();orbitMaterial.dispose();particles?.dispose(); group.clear(); }
  };
  const core = { group:coreGroup, hitTarget:coreMesh,
    setHover:active=>{hover=active?1:0;},
    update(delta, seconds) {
      if(coreMaterial.uniforms){coreMaterial.uniforms.uTime.value=seconds;coreMaterial.uniforms.uHover.value+=((hover?1:0)-coreMaterial.uniforms.uHover.value)*(1-Math.exp(-Math.max(0,delta)*9));if(particles?.material.uniforms.uHover)particles.material.uniforms.uHover.value=coreMaterial.uniforms.uHover.value;}
      else coreMaterial.color.set(hover?0x9ec5db:0x8baec5);
    },
    dispose(){coreMaterial.dispose();coreLabel.dispose();sphereGeometry.dispose();coreGroup.clear();} };
  const labelWorld=new THREE.Vector3(),labelView=new THREE.Vector3(),labelScale=new THREE.Vector3();
  // Only glyph anchors move. Fits and OrbitPose remain independent of phase.
  const labelBoxes=Array.from({length:6},()=>({x:0,y:0,w:0,h:14}));
  function settlePanelLabels(camera,panelOpen){
    if(!config.colorDepth||!panelOpen||!camera)return;
    const width=globalThis.window?.innerWidth||1600,height=globalThis.window?.innerHeight||900;
    coreGroup.parent.updateWorldMatrix(true,true);
    const project=(label,box,w)=>{label.getWorldPosition(labelWorld);labelView.copy(labelWorld).applyMatrix4(camera.matrixWorldInverse);labelWorld.project(camera);box.x=(labelWorld.x+1)*width/2;box.y=(1-labelWorld.y)*height/2;box.w=w;};
    project(coreLabel.group,labelBoxes[0],30);
    let index=1;
    for(const n of nodes.values()){
      const box=labelBoxes[index];project(n.label.group,box,n.id==='A5'?114:90);
      const originalY=box.y;let tries=0;
      while(tries++<8&&labelBoxes.slice(0,index).some(b=>Math.abs(box.x-b.x)<(box.w+b.w)/2+5&&Math.abs(box.y-b.y)<18))box.y-=18;
      n.label.group.parent.getWorldScale(labelScale);
      n.label.group.position.y+=(originalY-box.y)*2*(-labelView.z)/camera.projectionMatrix.elements[5]/height/labelScale.y;
      index++;
    }
  }
  return { core, orbitSystem, config, nodes, settlePanelLabels,
    attachParticleOcclusion:material=>{if(config.particleStars&&particles)applyParticleStarOcclusion(material,particles.matrices);},
    read:()=>({time,variant:config.variant,stages:Object.fromEntries([...nodes].map(([id,n])=>[id,{position:n.pose.position.toArray(),label:n.label.group.position.toArray(),binding:{...bindings.get(id)}}]))}) };
}

function makeLabel(text,width) {
  const canvas=document.createElement('canvas');canvas.width=768;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.clearRect(0,0,768,128);ctx.font='500 62px Inter, Arial, sans-serif';ctx.fillStyle='#b2d3e4';ctx.textAlign='center';ctx.fillText(text,384,82);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const material=new THREE.SpriteMaterial({map:texture,transparent:true,opacity:.88,depthWrite:false,depthTest:true,fog:false});
  const sprite=new THREE.Sprite(material);sprite.scale.set(width,width/6,1);
  // Constant readable pixel height without screen-position guessing. Parent
  // scale and perspective depth are removed only from glyph size, not anchors.
  const view=new THREE.Vector3(),worldScale=new THREE.Vector3(),viewport=new THREE.Vector2();
  sprite.onBeforeRender=(renderer,scene,camera)=>{
    view.setFromMatrixPosition(sprite.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
    sprite.parent.getWorldScale(worldScale);
    renderer.getSize(viewport);
    const glyphHeight = worldScale.y < .4 ? (text==='5A'?38:28) : (text==='5A'?48:36);
    const h=glyphHeight*2*(-view.z)/camera.projectionMatrix.elements[5]/viewport.y;
    sprite.scale.set(h*6/worldScale.x,h/worldScale.y,1);sprite.updateMatrixWorld();
  };
  const group=new THREE.Group();group.add(sprite);
  return {group,material,dispose(){material.dispose();texture.dispose();}};
}

function makeSphereMaterial(core) {
  return new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uEnergy:{value:1},uCore:{value:core?1:0},uHover:{value:0}},
    depthWrite:true,depthTest:true,fog:false,
    vertexShader:`varying vec3 vP; varying vec3 vN; varying vec3 vV;
      void main(){vP=position;vec4 mv=modelViewMatrix*vec4(position,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uTime,uEnergy,uCore,uHover;varying vec3 vP,vN,vV;
      float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
      float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
        return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
        mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
      void main(){
        vec3 p=vP;float t=uTime*.016;
        float macro=noise(p*3.3+vec3(t,0,-t*.6));
        float meso=noise(p*10.+macro*2.4);float fine=noise(p*48.+meso);
        float turbulence=macro*.55+meso*.33+fine*.12;
        float vein=pow(1.-abs(sin(p.y*12.+p.x*3.+macro*6.+t)),8.)*smoothstep(.28,.64,meso);
        vec3 n=normalize(vN),v=normalize(vV);float facing=max(dot(n,v),0.);
        float light=.20+.80*max(dot(n,normalize(vec3(-.5,.7,1.))),0.);
        float limb=pow(1.-facing,3.)*(.3+.7*light);
        float aggregation=smoothstep(.46,.79,turbulence);
        float energy=mix(.65,1.22,uCore)*uEnergy;
        vec3 base=mix(vec3(.009,.028,.062),vec3(.048,.125,.21),turbulence)*light;
        float depthActivity=noise(p*5.5+vec3(t*.3,-t,t*.6));
        vec3 activity=vec3(.18,.36,.50)*(aggregation*.72+vein*.23)*energy;
        activity+=uCore*vec3(.06,.14,.20)*smoothstep(.32,.78,depthActivity)*pow(facing,.8);
        vec3 col=base+activity+vec3(.10,.24,.36)*limb*(.35+.65*uCore);
        col+=vec3(.04,.09,.12)*pow(facing,2.)*uCore;
        col*=1.+uHover*.13;
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
}

function makeOrbitalParticles() {
  const matrices=Array.from({length:6},()=>new THREE.Matrix4()),energy=new Float32Array(6).fill(1);
  const positions=[],slots=[],sizes=[],seeds=[];
  let seed=7343;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let slot=0;slot<6;slot++)for(let i=0;i<(slot===0?900:480);i++){
    const z=random()*2-1,theta=random()*Math.PI*2,r=i%11===0?1.03+random()*.08:1.002+random()*.018;
    positions.push(Math.sqrt(1-z*z)*Math.cos(theta)*r,z*r,Math.sqrt(1-z*z)*Math.sin(theta)*r);
    slots.push(slot);sizes.push(i%71===0?2.5: .65+random()*.8);seeds.push(random()*6.28);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('aSlot',new THREE.Float32BufferAttribute(slots,1));geometry.setAttribute('aSize',new THREE.Float32BufferAttribute(sizes,1));geometry.setAttribute('aSeed',new THREE.Float32BufferAttribute(seeds,1));
  const material=new THREE.ShaderMaterial({uniforms:{uMatrices:{value:matrices},uEnergy:{value:energy},uTime:{value:0}},transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,fog:false,
    vertexShader:`attribute float aSlot,aSize,aSeed;uniform mat4 uMatrices[6];uniform float uEnergy[6];uniform float uTime;varying float vA;
      void main(){int s=int(aSlot+.5);vec3 p=position*(1.+.0015*sin(uTime*.2+aSeed));
      vec4 mv=modelViewMatrix*uMatrices[s]*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=aSize;
      vA=(.12+.18*pow(.5+.5*sin(aSeed*3.1),3.))*uEnergy[s];}`,
    fragmentShader:`varying float vA;void main(){float r=length(gl_PointCoord-.5);if(r>.5)discard;gl_FragColor=vec4(vec3(.32,.58,.78),(1.-smoothstep(.05,.5,r))*vA);}`});
  const points=new THREE.Points(geometry,material);points.name='FiveAOrbitalSurfaceParticles';points.frustumCulled=false;
  return {points,material,matrices,energy,dispose(){geometry.dispose();material.dispose();}};
}
