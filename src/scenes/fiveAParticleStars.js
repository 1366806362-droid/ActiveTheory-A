import * as THREE from 'three';

export const PARTICLE_STAR_BUDGET = Object.freeze({ core: 14000, satellite: 2600, total: 27000, outerRadius: 1.10 });
export const ENERGY_STAR_BUDGETS = Object.freeze({
  A: Object.freeze({ core: 8000, satellite: 1350, total: 14750, outerRadius: 1.14 }),
  B: Object.freeze({ core: 7000, satellite: 1100, total: 12500, outerRadius: 1.14 })
});

// View-ray attenuation through another star's finite volume. This supplements
// normal depth testing: rear tracks/particles cannot shine through the entire
// translucent star, while no large black depth-only disc erases its interior.
const OCCLUSION_GLSL = `
float starVisibility(vec3 pointView, int ownSlot) {
  vec3 ray=normalize(pointView);float visibility=1.;
  for(int k=0;k<6;k++){if(k==ownSlot)continue;
    vec3 c=(modelViewMatrix*uMatrices[k]*vec4(0,0,0,1)).xyz;
    float radius=length((modelViewMatrix*uMatrices[k])[0].xyz)*.94;
    float along=dot(c,ray),impact=length(c-ray*along);
    if(along>0. && length(pointView)>along && impact<radius)
      visibility*=mix(.015,1.,smoothstep(.25,1.,impact/radius));
  }return visibility;
}
`;

export function applyParticleStarOcclusion(material,matrices) {
  const uniform={value:matrices};
  if(material.isShaderMaterial){
    material.uniforms.uMatrices=uniform;
    material.vertexShader='uniform mat4 uMatrices[6];\n'+OCCLUSION_GLSL+material.vertexShader;
    material.vertexShader=material.vertexShader.replace('vAlpha = aAlpha * shimmer;', 'vAlpha = aAlpha * shimmer * starVisibility(viewPosition.xyz,-1);');
  }else{
    material.onBeforeCompile=shader=>{
      shader.uniforms.uMatrices=uniform;
      shader.vertexShader='uniform mat4 uMatrices[6]; varying float vStarVisibility;\n'+OCCLUSION_GLSL+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <project_vertex>','#include <project_vertex>\nvStarVisibility=starVisibility(mvPosition.xyz,-1);');
      shader.fragmentShader='varying float vStarVisibility;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','diffuseColor.a*=vStarVisibility;\n#include <opaque_fragment>');
    };
    material.customProgramCacheKey=()=> 'fivea-particle-star-track-occlusion-v1';
  }
}

// The original sphere remains the full-size CPU pick proxy. Only its rendered
// support is inset: it occludes rear tracks without hiding the luminous shell.
export function makeParticleStarSupport(core) {
  return new THREE.ShaderMaterial({depthWrite:true,depthTest:true,fog:false,
    uniforms:{uTime:{value:0},uEnergy:{value:1},uHover:{value:0},uCore:{value:core?1:0}},
    vertexShader:`varying vec3 vN,vV;void main(){vec4 mv=modelViewMatrix*vec4(position*.17,1.);vN=normalize(normalMatrix*normal);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
    fragmentShader:`uniform float uEnergy,uCore,uHover;varying vec3 vN,vV;
      void main(){float f=max(0.,dot(normalize(vN),normalize(vV)));vec3 c=vec3(.012,.026,.045)*(.35+.65*f)*(0.75+.25*uEnergy)*(1.+.18*uCore);
      gl_FragColor=vec4(c,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`
  });
}

export function makeParticleStars(variant='B', energyVariant=null) {
  if (energyVariant === 'A' || energyVariant === 'B') return makeEnergyParticleStars(energyVariant);
  const matrices=Array.from({length:6},()=>new THREE.Matrix4()), energy=new Float32Array(6).fill(1);
  const count=PARTICLE_STAR_BUDGET.total, positions=new Float32Array(count*3), slots=new Float32Array(count), sizes=new Float32Array(count), seeds=new Float32Array(count), radii=new Float32Array(count);
  let seed=381947,at=0; const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let slot=0;slot<6;slot++)for(let i=0;i<(slot===0?PARTICLE_STAR_BUDGET.core:PARTICLE_STAR_BUDGET.satellite);i++,at++){
    // Finite radial thickness, small internal population and 4% bound dust.
    let z,theta,clump;
    do {z=random()*2-1;theta=random()*Math.PI*2;clump=.55+.22*Math.sin(theta*3+z*4)+.18*Math.cos(theta*5-z*3);} while(random()>clump);
    const kind=random(),r=kind<(slot===0?.35:.25)?.10+.64*Math.pow(random(),.65):kind>.96?1.0+.10*random():.72+.28*Math.pow(random(),.62);
    positions.set([Math.sqrt(1-z*z)*Math.cos(theta)*r,z*r,Math.sqrt(1-z*z)*Math.sin(theta)*r],at*3);
    slots[at]=slot;radii[at]=r;seeds[at]=random()*6.283185;
    sizes[at]=i%97===0?2.7:1.2+random()*.7;
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,array,size]of [['position',positions,3],['aSlot',slots,1],['aSize',sizes,1],['aSeed',seeds,1],['aRadius',radii,1]])geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
  const material=new THREE.ShaderMaterial({uniforms:{uMatrices:{value:matrices},uEnergy:{value:energy},uTime:{value:0},uHover:{value:0},uHeight:{value:900},uDpr:{value:1},uFlow:{value:variant==='B'?1:0}},
    transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,fog:false,
    vertexShader:`attribute float aSlot,aSize,aSeed,aRadius;uniform mat4 uMatrices[6];uniform float uEnergy[6],uTime,uHover,uHeight,uDpr,uFlow;
      varying float vAlpha,vHot;varying vec3 vColor;
      ${OCCLUSION_GLSL}
      void main(){int s=int(aSlot+.5);vec3 p=position;float t=uTime*.024;
        float turn=t*(.7+.3*sin(aSeed));mat2 rot=mat2(cos(turn),-sin(turn),sin(turn),cos(turn));p.xz=rot*p.xz;
        p*=1.+.003*sin(uTime*.23+aSeed*4.);
        vec4 center=modelViewMatrix*uMatrices[s]*vec4(0,0,0,1);vec4 mv=modelViewMatrix*uMatrices[s]*vec4(p,1);
        vec3 localView=normalize((modelViewMatrix*uMatrices[s]*vec4(p,0.)).xyz);
        float facing=dot(localView,normalize(-center.xyz));float depth=.18+.82*smoothstep(-.5,.65,facing);
        float inner=1.-smoothstep(.5,.82,aRadius);float edge=1.-smoothstep(.97,1.11,aRadius);
        float hot=step(.987,fract(aSeed*13.7));float mid=step(.89,fract(aSeed*8.3));
        float flow=uFlow*pow(.5+.5*sin(p.y*8.+p.x*3.+t+aSeed*.15),10.);
        float emphasis=.78+.22*uEnergy[s];float activity=.84+.16*sin(uTime*.32+aSeed*5.);
        vAlpha=(.22+.22*fract(aSeed*2.3)+.10*inner)*depth*edge*activity;
        vAlpha*=s==0?1.0:.95;vAlpha*=1.+(s==0?uHover*.16:0.);
        vAlpha*=starVisibility(mv.xyz,s);
        float e=(.95+mid*1.10+hot*4.0+flow*.42+inner*.38)*emphasis;
        e+=max(0.,uEnergy[s]-.85)*(mid*.42+hot*.65);
        vColor=mix(vec3(.25,.49,.78),vec3(.78,.90,1.),.42+.38*fract(aSeed*4.1))*e;
        vHot=hot;
        float radius=length((modelViewMatrix*uMatrices[s])[0].xyz);
        float projected=radius*uHeight*projectionMatrix[1][1]/(2.*-center.z);
        gl_PointSize=clamp(aSize*sqrt(projected/(s==0?90.:25.)),.55,2.9)*uDpr;
        gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`varying float vAlpha,vHot;varying vec3 vColor;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        float shape=(1.-smoothstep(.28,.95,r));
        gl_FragColor=vec4(vColor,shape*vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const points=new THREE.Points(geometry,material);points.name='FiveAOrbitalSurfaceParticles';points.frustumCulled=false;
  const viewport=new THREE.Vector2();points.onBeforeRender=renderer=>{renderer.getSize(viewport);material.uniforms.uHeight.value=viewport.y;material.uniforms.uDpr.value=renderer.getPixelRatio();};
  return {points,material,matrices,energy,dispose(){geometry.dispose();material.dispose();}};
}

function makeEnergyParticleStars(variant) {
  const profile=variant==='A'
    ? { coreFraction:.22, midFraction:.50, coreGain:1.18, midGain:1.02, shellGain:.72, dustGain:.34 }
    : { coreFraction:.17, midFraction:.46, coreGain:1.08, midGain:.96, shellGain:.76, dustGain:.30 };
  const budget=ENERGY_STAR_BUDGETS[variant];
  const matrices=Array.from({length:6},()=>new THREE.Matrix4()),energy=new Float32Array(6).fill(1);
  const count=budget.total,positions=new Float32Array(count*3),slots=new Float32Array(count),sizes=new Float32Array(count),seeds=new Float32Array(count),radii=new Float32Array(count),zones=new Float32Array(count),biases=new Float32Array(count);
  let seed=913731,at=0;const random=()=>((seed=Math.imul(seed,1664525)+1013904223|0)>>>0)/4294967296;
  for(let slot=0;slot<6;slot++){
    const bodyCount=slot===0?budget.core:budget.satellite;
    for(let i=0;i<bodyCount;i++,at++){
      const pick=random();let zone,r;
      if(pick<profile.coreFraction){zone=0;r=.025+.34*Math.pow(random(),1.55);}
      else if(pick<profile.coreFraction+profile.midFraction){zone=1;r=.20+.60*Math.pow(random(),.82);}
      else if(pick<.955){zone=2;r=.70+.33*Math.pow(random(),.72);}
      else {zone=3;r=1.01+.13*Math.pow(random(),1.35);}
      let z,theta,accept;
      do {
        z=random()*2-1;theta=random()*Math.PI*2;
        const lobe=.56+.22*Math.sin(theta*3.0+z*5.1+slot*.71)+.15*Math.cos(theta*5.0-z*3.2-slot*.43);
        const voidField=.5+.5*Math.sin(theta*2.0-z*4.3+slot*1.17);
        accept=Math.max(.16,lobe-(voidField>.87?.30:0));
      } while(random()>accept);
      const radial=Math.sqrt(Math.max(0,1-z*z)),cluster=.5+.5*Math.sin(theta*4.0+z*6.0+slot*.83);
      positions.set([radial*Math.cos(theta)*r,z*r,radial*Math.sin(theta)*r],at*3);
      slots[at]=slot;radii[at]=r;zones[at]=zone;seeds[at]=random()*6.283185;
      const hero=random()<(zone===0?.020:zone===1?.010:.003);
      const medium=random()<(zone===0?.22:zone===1?.13:.055);
      sizes[at]=(hero?2.7:medium?1.65:.72+random()*.50)*(slot===0?1.08:1.0);
      biases[at]=(zone===0?profile.coreGain:zone===1?profile.midGain:zone===2?profile.shellGain:profile.dustGain)*(.76+.36*cluster)*(hero?2.6:medium?1.32:1);
    }
  }
  const geometry=new THREE.BufferGeometry();
  for(const [name,array,size]of [['position',positions,3],['aSlot',slots,1],['aSize',sizes,1],['aSeed',seeds,1],['aRadius',radii,1],['aZone',zones,1],['aBias',biases,1]])geometry.setAttribute(name,new THREE.BufferAttribute(array,size));
  const material=new THREE.ShaderMaterial({uniforms:{uMatrices:{value:matrices},uEnergy:{value:energy},uTime:{value:0},uHover:{value:0},uHeight:{value:900},uDpr:{value:1}},
    transparent:true,depthWrite:false,depthTest:true,blending:THREE.AdditiveBlending,fog:false,
    vertexShader:`attribute float aSlot,aSize,aSeed,aRadius,aZone,aBias;uniform mat4 uMatrices[6];uniform float uEnergy[6],uTime,uHover,uHeight,uDpr;
      varying float vAlpha,vSharpness;varying vec3 vColor;
      ${OCCLUSION_GLSL}
      void main(){int s=int(aSlot+.5);vec3 p=position;float t=uTime*.018;
        float zoneFlow=aZone<1.5?1.:.34;float turn=t*zoneFlow*(.55+.22*sin(aSeed*2.));mat2 rot=mat2(cos(turn),-sin(turn),sin(turn),cos(turn));p.xz=rot*p.xz;
        p.xy+=vec2(sin(aSeed*5.+t),cos(aSeed*3.-t*.8))*(aZone<1.5?.006:.0025);p*=1.+.0025*sin(uTime*.19+aSeed*4.);
        vec4 center=modelViewMatrix*uMatrices[s]*vec4(0,0,0,1);vec4 mv=modelViewMatrix*uMatrices[s]*vec4(p,1);
        vec3 localView=normalize((modelViewMatrix*uMatrices[s]*vec4(p,0.)).xyz);float facing=dot(localView,normalize(-center.xyz));
        float depth=.24+.76*smoothstep(-.72,.52,facing);float core=1.-smoothstep(.16,.48,aRadius);float mid=1.-smoothstep(.48,.88,aRadius);
        float zoneAlpha=aZone<.5?.78:aZone<1.5?.48:aZone<2.5?.24:.095;
        if(s>0)zoneAlpha*=aZone<.5?.76:aZone<1.5?1.12:aZone<2.5?1.92:1.24;
        float dataEnergy=clamp(uEnergy[s],.55,1.35);float energyResponse=.72+.28*dataEnergy;
        float activity=.92+.08*sin(uTime*.25+aSeed*4.7);vAlpha=zoneAlpha*(.70+.30*fract(aSeed*2.17))*depth*activity;
        vAlpha*=energyResponse*(1.+(s==0?uHover*.14:0.))*starVisibility(mv.xyz,s);
        float centerField=.64+(s==0?1.35:.96)*core+.36*mid;float dataLift=max(0.,dataEnergy-.82)*(core*.62+mid*.24);
        float satelliteBalance=s==0?1.:(aZone<.5?.80:aZone<1.5?.94:1.12);
        float luminance=aBias*centerField*(s==0?1.08:.92)*satelliteBalance+dataLift;
        vec3 deep=vec3(.075,.19,.36),icy=vec3(.48,.73,.94),silver=vec3(.86,.93,1.);
        float colorMix=clamp(.18+.58*core+.18*fract(aSeed*3.7),0.,1.);vColor=mix(deep,icy,colorMix);
        vColor=mix(vColor,silver,clamp((luminance-1.55)*.34,0.,.62))*luminance;
        vSharpness=aZone<1.5?.78:.58;
        float radius=length((modelViewMatrix*uMatrices[s])[0].xyz);float projected=radius*uHeight*projectionMatrix[1][1]/(2.*-center.z);
        float shellRead=(s>0 && aZone>1.5 && aZone<2.5)?1.48:1.;
        gl_PointSize=clamp(aSize*shellRead*sqrt(projected/(s==0?74.:20.)),.62,s==0?4.2:3.35)*uDpr;gl_Position=projectionMatrix*mv;
      }`,
    fragmentShader:`varying float vAlpha,vSharpness;varying vec3 vColor;
      void main(){float r=length(gl_PointCoord-.5)*2.;if(r>1.)discard;
        float soft=1.-smoothstep(vSharpness,1.,r);float nucleus=1.-smoothstep(0.,.38,r);float shape=soft*(.72+.28*nucleus);
        gl_FragColor=vec4(vColor,shape*vAlpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`});
  const points=new THREE.Points(geometry,material);points.name='FiveAOrbitalSurfaceParticles';points.frustumCulled=false;
  const viewport=new THREE.Vector2();points.onBeforeRender=renderer=>{renderer.getSize(viewport);material.uniforms.uHeight.value=viewport.y;material.uniforms.uDpr.value=renderer.getPixelRatio();};
  return {points,material,matrices,energy,budget,energyVariant:variant,dispose(){geometry.dispose();material.dispose();}};
}

// Static whole-orbit bound, independent of live phase and Snapshot values.
// Includes maximum authorized scale, outer dust and anchor lift. Pixel padding
// reserves the entire label sprite, not just the visible glyphs.
export function fitParticleStarPanel(camera,width,height,panelLeft,referencePosition) {
  const radius=3.10,padding=94,right=Math.max(padding*2+1,Math.min(width,panelLeft));
  const center=new THREE.Vector3(...referencePosition).applyMatrix4(camera.matrixWorldInverse);
  const depth=-center.z, half=Math.max(1,Math.min((right-2*padding)/2,(height-2*padding)/2));
  const focal=camera.projectionMatrix.elements[5]*height/2;
  const scale=Math.min(.68,half*depth/(radius*(focal+half)));
  center.x=(right/2/width*2-1)*depth/(camera.projectionMatrix.elements[0]);center.y=0;
  center.applyMatrix4(camera.matrixWorld);
  return {position:center.toArray(),scale,radius,padding,viewport:[width,height],panelLeft:right};
}
