import * as THREE from 'three';

// Identity colors are art, never a risk or conversion scale. Values are sRGB.
export const FIVE_A_IDENTITY_COLORS = Object.freeze({
  A1: '#7bd8ee', A2: '#83d6b6', A3: '#b8a5ea', A4: '#e0c394', A5: '#d39b92'
});
export const FIVE_A_COLOR_CORE_RADIUS = .576;

export function resolveFiveAColorDepth(search = '') {
  const q = new URLSearchParams(search), value = q.get('fiveAColorDepth');
  if (!['1', 'A', 'B'].includes(value)) return null;
  return { variant: value === 'B' ? 'B' : 'A', background: q.get('fiveABackground') !== '0' };
}

export function makeFiveAIdentityPalette(stageIds) {
  return [new THREE.Color('#b4d9f6'), ...stageIds.map(id => {
    if (!Object.hasOwn(FIVE_A_IDENTITY_COLORS, id)) throw new Error(`Unknown FiveA art identity: ${id}`);
    return new THREE.Color(FIVE_A_IDENTITY_COLORS[id]);
  })];
}

// Two draw calls: one continuous gas field, one batch spanning far stars and
// near dust. It belongs to FiveAScene; no scene.background/fog or global loop.
export function createFiveAEnvironment(variant = 'A') {
  const group = new THREE.Group(); group.name = 'FiveAColorDepthEnvironment';
  const uniforms = { uTime: { value: 0 }, uOpacity: { value: 0 }, uVariant: { value: variant === 'B' ? 1 : 0 } };
  const gasGeometry = new THREE.PlaneGeometry(17, 11);
  const gasMaterial = new THREE.ShaderMaterial({ uniforms, transparent: true, depthWrite: false, depthTest: true, fog: false,
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform float uTime,uOpacity,uVariant;varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){vec2 p=(vUv-.5)*vec2(1.55,1.);p+=vec2(uTime*.0008,-uTime*.0004);
        p.x*=mix(1.,.82,uVariant);p.y+=uVariant*.06;
        float n=noise(p*7.),detail=noise(p*18.+n*1.3);
        float left=exp(-dot((p-vec2(-.23,.05))*vec2(2.8,4.3),(p-vec2(-.23,.05))*vec2(2.8,4.3)));
        float right=exp(-dot((p-vec2(.24,-.10))*vec2(3.5,3.4),(p-vec2(.24,-.10))*vec2(3.5,3.4)));
        float field=(left+right*.62)*(.28+.72*n)*(.65+.35*detail);
        field*=1.-.75*exp(-dot((p-vec2(.02,.11))*vec2(6.,7.),(p-vec2(.02,.11))*vec2(6.,7.)));
        field*=smoothstep(0.,.16,vUv.x)*smoothstep(0.,.16,1.-vUv.x)*smoothstep(0.,.15,vUv.y)*smoothstep(0.,.15,1.-vUv.y);
        vec3 blue=mix(vec3(.055,.082,.125),vec3(.082,.076,.118),smoothstep(.25,.80,n));
        gl_FragColor=vec4(blue,field*uOpacity*mix(.56,.82,uVariant));
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }` });
  const gas = new THREE.Mesh(gasGeometry, gasMaterial); gas.position.set(.15,.1,-4.0); gas.name = 'FiveAMidFarGas'; gas.raycast=()=>{}; group.add(gas);
  const count=220, positions=new Float32Array(count*3),sizes=new Float32Array(count),seeds=new Float32Array(count);
  let seed=58139; const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let i=0;i<count;i++){const near=i>=208;positions.set([(random()-.5)*(near?8:19),(random()-.5)*(near?6:12),near?1+random()*1.5:-5-random()*6],i*3);sizes[i]=near?1.3:.65+Math.pow(random(),5)*1.15;seeds[i]=random()*6.28;}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSize',new THREE.BufferAttribute(sizes,1));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,fog:false,
    vertexShader:`uniform float uTime,uOpacity;attribute float aSize,aSeed;varying float vA;void main(){vec3 p=position;bool near=p.z>0.;p.x+=sin(uTime*.011+aSeed)*(near?.035:.006);p.y+=cos(uTime*.009+aSeed)*.015;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);gl_PointSize=aSize;vA=uOpacity*(near?.09:.18+.20*fract(aSeed*2.71));if(aSeed>6.)vA*=.9+.1*sin(uTime*.19+aSeed);}`,
    fragmentShader:`varying float vA;void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;gl_FragColor=vec4(vec3(.31,.40,.53),vA*(1.-smoothstep(.1,1.,r)));
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  const points=new THREE.Points(geometry,material);points.name='FiveAFarStarsNearDust';points.raycast=()=>{};group.add(points);
  let clock=0;
  return {group,update(delta,entrance,panel,hidden,reduced){if(!hidden&&!reduced&&entrance>.01)clock+=Math.min(.05,Math.max(0,delta));uniforms.uTime.value=clock;uniforms.uOpacity.value=THREE.MathUtils.smoothstep(entrance,.25,.92)*(1-panel*.55);group.visible=entrance>.01;},
    dispose(){gasGeometry.dispose();gasMaterial.dispose();geometry.dispose();material.dispose();group.clear();}};
}
