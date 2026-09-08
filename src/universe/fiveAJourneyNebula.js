import * as THREE from 'three';

export const JOURNEY_CANDIDATES = Object.freeze({
  A: { name:'ascending migration', t:[.06,.25,.43,.65,.90], size:[.035,.053,.066,.052,.029], energy:[.55,.78,1.15,.82,.4], bend:.26, depth:.13, slope:.24 },
  B: { name:'broken braided arc', t:[.04,.24,.49,.69,.92], size:[.034,.053,.074,.050,.030], energy:[.46,.72,.98,.62,.32], bend:.31, depth:.18, slope:-.04, span:.94, offset:-.18 },
  C: { name:'offset grouped stream', t:[.03,.19,.38,.73,.92], size:[.033,.048,.069,.061,.029], energy:[.42,.7,1.12,.93,.4], bend:.32, depth:.32, slope:-.19 }
});
export const JOURNEY_COUNTS = Object.freeze({ clusters:14000, flow:1200, dust:2800 });

export function journeyPoint(t, candidate='B') {
  const c=JOURNEY_CANDIDATES[candidate];
  return [(t-.5)*(c.span??1.12),Math.sin(t*Math.PI)*c.bend+(c.offset??-.12)+c.slope*(t-.5),Math.sin(t*5.1+.3)*c.depth];
}
export function createJourneyData(candidate='B') {
  const c=JOURNEY_CANDIDATES[candidate];if(!c)throw new Error('Unknown Journey candidate');
  let s=91426;const random=()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296};
  const gaussian=()=>Math.sqrt(-2*Math.log(Math.max(random(),1e-8)))*Math.cos(random()*Math.PI*2);
  const count=Object.values(JOURNEY_COUNTS).reduce((a,b)=>a+b,0);
  const positions=new Float32Array(count*3),styles=new Float32Array(count*4);
  const put=(i,p,role,energy,size,phase)=>{positions.set(p,i*3);styles.set([role,energy,size,phase],i*4)};
  for(let i=0;i<JOURNEY_COUNTS.clusters;i++){
    const k=i%5,t=c.t[k],p=journeyPoint(t,candidate),g=gaussian(),r=c.size[k]*(random()<.2?.3:1);
    const tail=(random()-.5)*r;
    p[0]+=g*r+tail;p[1]+=gaussian()*r*.61+g*r*.25;p[2]+=gaussian()*r*.7;
    const hero=random()<.018,core=random()<.22;
    put(i,p,0,c.energy[k]*(hero?2.7:core?.38:.09+random()*.10),hero?1.8: .8+random()*.45,random()*6.283);
  }
  for(let i=0;i<JOURNEY_COUNTS.flow;i++){
    const t=random(),side=(random()-.5)*.015,bright=random()<.025;
    put(i+JOURNEY_COUNTS.clusters,[t,side,gaussian()*.009],1,bright?1.8:.11+random()*.1,bright?1.7:.75+random()*.3,random()*6.283);
  }
  for(let i=0;i<JOURNEY_COUNTS.dust;i++){
    const p=journeyPoint(random(),candidate);p[0]+=gaussian()*.046;p[1]+=gaussian()*.057;p[2]+=gaussian()*.063;
    put(i+JOURNEY_COUNTS.clusters+JOURNEY_COUNTS.flow,p,2,.028+random()*.04,.6+random()*.35,random()*6.283);
  }
  return {positions,styles,count};
}
export function createFiveAJourneyNebula({candidate='B'}={}) {
  const c=JOURNEY_CANDIDATES[candidate],data=createJourneyData(candidate);
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(data.positions,3));
  geometry.setAttribute('aStyle',new THREE.BufferAttribute(data.styles,4));
  const uniforms={uTime:{value:0},uVisibility:{value:0},uHover:{value:0},uIntent:{value:0},
    uBend:{value:c.bend},uDepth:{value:c.depth},uSlope:{value:c.slope},uSpan:{value:c.span??1.12},uOffset:{value:c.offset??-.12}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,depthTest:true,
    blending:THREE.AdditiveBlending,toneMapped:false,fog:false,
    vertexShader:/*glsl*/`
      attribute vec4 aStyle;
      uniform float uTime,uVisibility,uHover,uIntent,uBend,uDepth,uSlope,uSpan,uOffset;
      varying float vEnergy,vRole,vPhase;
      void main(){
        vec3 p=position;float fade=1.;vRole=aStyle.x;vPhase=aStyle.w;
        if(aStyle.x>.5&&aStyle.x<1.5){
          float t=fract(position.x+uTime*.017*(1.+uHover*.12));
          p=vec3((t-.5)*uSpan,sin(t*3.141593)*uBend+uOffset+uSlope*(t-.5)+position.y,sin(t*5.1+.3)*uDepth+position.z);
          fade=smoothstep(0.,.10,t)*(1.-smoothstep(.86,1.,t))*(.22+.78*pow(.5+.5*sin(t*43.+uTime*.14),3.));
        } else {p+=vec3(sin(uTime*.065+aStyle.w),cos(uTime*.053+aStyle.w),sin(uTime*.045+aStyle.w))*.002;}
        vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
        gl_PointSize=clamp(aStyle.z*6.5/max(1.,-mv.z),.6,3.1);
        vEnergy=aStyle.y*fade*uVisibility*(1.+uHover*.23+uIntent*.16)*(1.+.035*sin(uTime*.3+aStyle.w));
      }`,
    fragmentShader:/*glsl*/`
      varying float vEnergy,vRole,vPhase;
      void main(){
        vec2 q=gl_PointCoord-.5;float r=length(q)*2.;
        float alpha=exp(-r*r*3.2)*(1.-smoothstep(.72,1.,r));
        vec3 color=mix(vec3(.23,.43,.66),vec3(.70,.82,.95),smoothstep(.4,1.5,vEnergy));
        gl_FragColor=vec4(color*vEnergy,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const group=new THREE.Group();group.name='FiveAHomepageJourney';group.renderOrder=7;
  const points=new THREE.Points(geometry,material);points.name='FiveAJourneyGPU';points.renderOrder=8;
  // Flow positions are encoded parameters, so supply the actual curve envelope.
  geometry.boundingSphere=new THREE.Sphere(new THREE.Vector3(),1.5);
  group.add(points);group.userData.journey={candidate,name:c.name,particles:data.count,counts:JOURNEY_COUNTS,
    drawCalls:1,clusters:c.t.map(t=>journeyPoint(t,candidate)),internalStageBinding:false};
  return {group,pointCount:data.count,update(time,visibility,hover=0,intent=0){
    uniforms.uTime.value=time;uniforms.uVisibility.value=visibility;uniforms.uHover.value=hover;uniforms.uIntent.value=intent;
    group.visible=visibility>.001;
  },dispose(){geometry.dispose();material.dispose();group.clear()}};
}
