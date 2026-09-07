import * as THREE from 'three';

// Homepage-only, opt-in. The approved legacy homepage and internal scene remain intact.
export function readMemoryFieldCandidate(search = '') {
  const value = new URLSearchParams(search).get('brandMindMemory');
  return value === '1' ? 'C' : ['A', 'B', 'C'].includes(value) ? value : null;
}

// Three different field arrangements, not three exposure settings.
export const MEMORY_CANDIDATES = Object.freeze({
  A: Object.freeze({ name: 'layered saddle', shear: 0.18, spread: 1, voidShift: 0.02,
    knots: [[-.29,.09,.12,.047,1.0],[-.10,-.08,.03,.068,1.25],[.12,.13,-.12,.052,.8],[.30,-.02,-.08,.041,.6],[.04,-.25,.16,.031,.6],[-.38,-.18,-.18,.028,.4]] }),
  B: Object.freeze({ name: 'interleaved memory banks', shear: -0.32, spread: 1.02, voidShift: -0.055,
    knots: [[-.26,.13,.17,.052,1.05],[-.075,-.07,.045,.071,1.2],[.15,.09,-.17,.042,.68],[.32,-.12,-.09,.033,.5],[.06,-.25,.11,.039,.62],[-.38,-.13,-.20,.026,.38]] }),
  C: Object.freeze({ name: 'asymmetric archipelago', shear: 0.48, spread: 1.08, voidShift: 0.075,
    knots: [[-.34,.03,.15,.047,.94],[-.13,.17,-.06,.043,.67],[.055,-.06,.08,.068,1.2],[.29,.13,-.15,.042,.57],[.24,-.21,.02,.028,.42],[-.20,-.25,-.20,.031,.43]] })
});
export const MEMORY_COUNTS = Object.freeze({ field: 23500, knots: 6900, dust: 4200, threads: 900 });
export const MEMORY_THREAD_PAIRS = Object.freeze([[0,1],[1,2],[2,3],[1,4],[0,5],[3,4]]);

function randomSource(seed) {
  let state = seed >>> 0;
  return () => { state = (Math.imul(1664525,state) + 1013904223) >>> 0; return state / 4294967296; };
}
function gaussian(random) { return Math.sqrt(-2*Math.log(Math.max(random(),1e-8)))*Math.cos(random()*Math.PI*2); }
function ellipsoid(x,y,z,cx,cy,cz,sx,sy,sz) { return Math.exp(-((x-cx)**2/sx**2+(y-cy)**2/sy**2+(z-cz)**2/sz**2)*1.8); }

// Soft overlapping anisotropic banks plus two voids. No spherical shell or radial orbit.
export function memoryDensity(x,y,z,candidate='B') {
  const c=MEMORY_CANDIDATES[candidate];
  const px=x/c.spread, py=y-c.shear*x;
  const warp=Math.sin(px*15+z*7)*.023+Math.sin(py*19-z*13)*.012;
  let mass=ellipsoid(px,py+warp,z,-.19,.075,-.015,.33,.16,.18)
    + .82*ellipsoid(px,py+warp,z,.15,-.095,-.05,.34,.17,.20)
    + .36*ellipsoid(px,py,z,.30,.12,-.11,.22,.14,.14);
  // One cohesion correction for selected C: knots are embedded in the same
  // field instead of sitting on top of unrelated noise. Fixed topology/counts.
  if(candidate==='C')for(const k of c.knots){
    mass+=.34*k[4]*ellipsoid(x,y,z,k[0],k[1],k[2],.16,.10,.16);
  }
  const voids=(1-.87*ellipsoid(px,py,z,.03,c.voidShift+.16,0,.12,.075,.38))
    *(1-.9*ellipsoid(px,py,z,-.25,-.12,0,.11,.07,.4));
  const texture=.62+.20*Math.sin(px*43+Math.sin(py*21)*1.6+z*27)*Math.sin(py*35-z*17);
  return Math.min(1,Math.max(0,mass*voids*texture));
}

export function createMemoryParticleData(candidate='B', seed=72194) {
  if (!MEMORY_CANDIDATES[candidate]) throw new Error('Unknown memory candidate');
  const c=MEMORY_CANDIDATES[candidate], random=randomSource(seed);
  const count=Object.values(MEMORY_COUNTS).reduce((a,b)=>a+b,0);
  const positions=new Float32Array(count*3), styles=new Float32Array(count*4);
  const anchors=new Float32Array(count*3);
  let cursor=0;
  const put=(x,y,z,role,energy,size,phase,anchor=[x,y,z])=>{
    positions.set([x,y,z],cursor*3); anchors.set(anchor,cursor*3);
    styles.set([role,energy,size,phase],cursor*4);cursor++;
  };
  for(let i=0;i<MEMORY_COUNTS.field;i++){
    let x,y,z,density;
    do { x=(random()-.5)*1.38;y=(random()-.5)*.91;z=(random()-.5)*.62;density=memoryDensity(x,y,z,candidate); } while(random()>density);
    put(x,y,z,0,(.10+random()*.16)*(candidate==='C'?.74:1),.60+random()*.65,random()*6.283);
  }
  for(let i=0;i<MEMORY_COUNTS.knots;i++){
    const k=c.knots[i%c.knots.length], t=random(), radius=k[3]*(t<.24?.23:t<.72?.63:1.2);
    const gx=gaussian(random),gy=gaussian(random),gz=gaussian(random);
    // Each knot is a skewed clump with a split shoulder, never a spherical glow sprite.
    const x=k[0]+gx*radius, y=k[1]+gy*radius*.63+gx*radius*.28,z=k[2]+gz*radius*.8;
    const energy=k[4]*(t<.015?2.3:t<.24?.48:.16)*( .82+random()*.36 );
    put(x,y,z,1,energy,t<.015?1.6+random()*.7:.75+random()*.55,random()*6.283,k.slice(0,3));
  }
  for(let i=0;i<MEMORY_COUNTS.dust;i++){
    let x,y,z;
    do{x=(random()-.5)*1.6;y=(random()-.5)*1.0;z=(random()-.5)*.8;}while(random()>memoryDensity(x,y,z,candidate)*.65+.025);
    put(x,y,z,2,.025+random()*.065,.50+random()*.65,random()*6.283);
  }
  for(let i=0;i<MEMORY_COUNTS.threads;i++){
    const pair=MEMORY_THREAD_PAIRS[i%6],a=c.knots[pair[0]],b=c.knots[pair[1]];
    const t=.12+random()*.67, bend=Math.sin(t*Math.PI)*(.065+(i%6)*.006);
    const x=a[0]+(b[0]-a[0])*t+gaussian(random)*.002;
    const y=a[1]+(b[1]-a[1])*t+bend+gaussian(random)*.002;
    const z=a[2]+(b[2]-a[2])*t-Math.sin(t*Math.PI)*.06;
    const gaps=Math.max(0,Math.sin(t*25+(i%6)*1.8));
    put(x,y,z,3,(.13+.08*random())*gaps*Math.sin(t*Math.PI)*(candidate==='C'?2.1:1),.7+random()*.35,t*6.283,[x,y,z]);
  }
  return {positions,styles,anchors,count};
}

const particleVertex = /* glsl */`
  attribute vec4 aStyle;
  attribute vec3 aAnchor;
  uniform float uTime, uVisibility, uHover, uIntent;
  varying float vEnergy, vRole;
  void main(){
    vec3 p=position;
    // Correlated, tiny translation preserves each association clump; no CPU updates.
    vec3 drift=vec3(sin(uTime*.075+aAnchor.x*7.),cos(uTime*.065+aAnchor.y*9.),sin(uTime*.052+aAnchor.z*11.));
    p+=drift*.007;
    vec4 mv=modelViewMatrix*vec4(p,1.);
    gl_Position=projectionMatrix*mv;
    float shimmer=1.+.065*sin(uTime*.42+aStyle.w);
    float threadWave=mix(1.,.70+.30*sin(uTime*.31-aStyle.w*2.),step(2.5,aStyle.x));
    vEnergy=aStyle.y*shimmer*threadWave*uVisibility*(1.+uHover*.23+uIntent*.16);
    vRole=aStyle.x;
    gl_PointSize=clamp(aStyle.z*6.0/max(1.,-mv.z),.55,3.2);
  }`;
const particleFragment = /* glsl */`
  varying float vEnergy,vRole;
  void main(){
    float r=length(gl_PointCoord-.5)*2.;
    float alpha=exp(-r*r*3.)*(1.-smoothstep(.72,1.,r));
    vec3 color=mix(vec3(.23,.40,.62),vec3(.66,.78,.91),smoothstep(.25,1.2,vEnergy));
    if(vRole>2.5)color=vec3(.40,.57,.76);
    gl_FragColor=vec4(color*vEnergy,alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const fieldVertex=/* glsl */`
  varying vec3 vLocal;
  void main(){vec4 p=instanceMatrix*vec4(position,1.);vLocal=p.xyz;gl_Position=projectionMatrix*modelViewMatrix*p;}`;
const fieldFragment=/* glsl */`
  uniform float uTime,uVisibility,uHover,uShear,uSpread,uVoid,uCohesion;
  uniform vec4 uKnots[6];
  varying vec3 vLocal;
  float hash(vec3 p){p=fract(p*.3183099+vec3(.1,.2,.3));p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float bank(vec3 p,vec3 c,vec3 s){vec3 q=(p-c)/s;return exp(-dot(q,q)*1.8);}
  void main(){
    vec3 p=vLocal;p.x/=uSpread;p.y-=uShear*p.x;
    p.y+=sin(p.x*15.+p.z*7.)*.023+sin(p.y*19.-p.z*13.)*.012;
    float mass=bank(p,vec3(-.19,.075,-.015),vec3(.33,.16,.18))
      +.82*bank(p,vec3(.15,-.095,-.05),vec3(.34,.17,.20))
      +.36*bank(p,vec3(.30,.12,-.11),vec3(.22,.14,.14));
    for(int i=0;i<6;i++)mass+=uCohesion*.34*uKnots[i].w*bank(vLocal,uKnots[i].xyz,vec3(.16,.10,.16));
    float voids=(1.-.87*bank(p,vec3(.03,uVoid+.16,0),vec3(.12,.075,.38)))
      *(1.-.9*bank(p,vec3(-.25,-.12,0),vec3(.11,.07,.4)));
    vec3 flow=p*14.+vec3(uTime*.008,0.,uTime*.005);
    float n=.5*noise(flow)+.28*noise(flow*2.1)+.14*noise(flow*4.3)+.08*noise(flow*8.6);
    float density=mass*voids*smoothstep(.14,.82,n)*(.98+.02*sin(uTime*.12));
    // Linear, sub-bloom field. This is 3D density sampled on shared depth slices,
    // not Gaussian point sprites. Only the tiny knots can exceed bloom threshold.
    gl_FragColor=vec4(vec3(.060,.105,.180),density*mix(.38,.55,uCohesion)*uVisibility*(1.+.22*uHover));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

export function createBrandMindMemoryField({candidate='C',seed=72194}={}) {
  const config=MEMORY_CANDIDATES[candidate];
  if(!config)throw new Error('Unknown memory candidate');
  const group=new THREE.Group();group.name='BrandMindContinuousMemoryField';group.renderOrder=7;
  const data=createMemoryParticleData(candidate,seed);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('aStyle',new THREE.BufferAttribute(data.styles,4));
  geometry.setAttribute('aAnchor',new THREE.BufferAttribute(data.anchors,3));
  const uniforms={uTime:{value:0},uVisibility:{value:0},uHover:{value:0},uIntent:{value:0},
    uShear:{value:config.shear},uSpread:{value:config.spread},uVoid:{value:config.voidShift},uCohesion:{value:candidate==='C'?1:0},
    uKnots:{value:config.knots.map(k=>new THREE.Vector4(k[0],k[1],k[2],k[4]))}};
  const material=new THREE.ShaderMaterial({uniforms,vertexShader:particleVertex,fragmentShader:particleFragment,
    transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,fog:false});
  const particles=new THREE.Points(geometry,material);particles.name='BrandMindMemoryMicrostructure';particles.renderOrder=8;
  const fieldGeometry=new THREE.PlaneGeometry(1.8,1.3);
  const fieldMaterial=new THREE.ShaderMaterial({uniforms,vertexShader:fieldVertex,fragmentShader:fieldFragment,
    transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,toneMapped:false,fog:false,side:THREE.DoubleSide});
  const field=new THREE.InstancedMesh(fieldGeometry,fieldMaterial,5);field.name='BrandMindContinuousDensity';field.renderOrder=7;
  const matrix=new THREE.Matrix4();for(let i=0;i<5;i++)field.setMatrixAt(i,matrix.makeTranslation(0,0,(i-2)*.075));
  field.instanceMatrix.needsUpdate=true;field.computeBoundingSphere();
  group.add(field,particles);
  group.userData.memoryField={candidate,name:config.name,particles:data.count,counts:MEMORY_COUNTS,drawCalls:2,
    knots:config.knots.map(k=>k.slice()),threads:MEMORY_THREAD_PAIRS,depthSlices:5};
  return {group,pointCount:data.count,
    update(time,visibility,hover=0,intent=0){uniforms.uTime.value=time;uniforms.uVisibility.value=visibility;
      uniforms.uHover.value=hover;uniforms.uIntent.value=intent;group.visible=visibility>.001;},
    dispose(){geometry.dispose();material.dispose();fieldGeometry.dispose();fieldMaterial.dispose();group.clear();}
  };
}
