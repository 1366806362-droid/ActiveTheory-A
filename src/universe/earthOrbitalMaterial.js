import * as THREE from 'three';

export const EARTH_ORBITAL_URLS = Object.freeze(Object.fromEntries([
  ['surface','surface'],['city','city'],['clouds','cloud'],['normal','normal-land']
].map(([key,file])=>[key,`/textures/hero/earth/orbital-v12/earth-orbital-${file}.webp`])));
export const EARTH_ORBITAL_PROFILES = Object.freeze({
  A: Object.freeze({roughness:.13,normal:.12,cloud:1.9,height:.0045,mie:.65,bounce:.85}),
  B: Object.freeze({roughness:.20,normal:.23,cloud:2.8,height:.0060,mie:.72,bounce:1.0}),
  C: Object.freeze({roughness:.28,normal:.16,cloud:3.5,height:.0080,mie:.80,bounce:.9})
});
export function readEarthOrbital(search=typeof window==='undefined'?'':window.location.search) {
  const q=new URLSearchParams(search);
  if(q.get('earthOrbital')!=='1'||q.get('earthV2')!=='1'||q.get('earthV3')!=='1')return null;
  return Object.hasOwn(EARTH_ORBITAL_PROFILES,q.get('earthOrbitalCandidate'))?q.get('earthOrbitalCandidate'):'B';
}
const vertex=/*glsl*/`
  varying vec2 vUv;
  varying vec3 vN,vP,vLocal,vCameraLocal,vSunLocal;
  void main(){
    vec4 p=modelViewMatrix*vec4(position,1.);
    vUv=uv;vLocal=position;vP=p.xyz;vN=normalize(normalMatrix*normal);
    vCameraLocal=(inverse(modelViewMatrix)*vec4(0.,0.,0.,1.)).xyz;
    vSunLocal=normalize(inverse(mat3(modelViewMatrix))*normalize(vec3(.72,.56,-.44)));
    gl_Position=projectionMatrix*p;
  }`;
const common=/*glsl*/`
  varying vec2 vUv;
  varying vec3 vN,vP,vLocal,vCameraLocal,vSunLocal;
  uniform float uOpacity;
  vec3 sun(){return normalize(vec3(.72,.56,-.44));}
  float facing(){return clamp(dot(normalize(vN),normalize(-vP)),0.,1.);}
  float cloudCover(sampler2D map,vec2 uv){vec3 c=texture2D(map,uv).rgb;return mix(c.r,c.g,.18);}
  float phaseHG(float mu,float g){return (1.-g*g)/pow(max(1.+g*g-2.*g*mu,.015),1.5);}
`;

export function createEarthOrbitalMaterial(kind,{candidate='B',cloudOffset={value:0},sharedTime={value:0}}={}){
  const p=EARTH_ORBITAL_PROFILES[candidate];if(!p)throw new Error('Unknown orbital candidate');
  const uniforms={uOpacity:{value:1},uTime:sharedTime,uCloudOffset:cloudOffset,
    uSunDirectionObject:{value:new THREE.Vector3()},uDisplayMode:{value:0},uLayerMode:{value:5}};
  let body;
  if(kind==='surface'){
    Object.assign(uniforms,{uSurfaceMap:{value:null},uNormalMap:{value:null},uCloudMap:{value:null}});
    body=/*glsl*/`
      uniform sampler2D uSurfaceMap,uNormalMap,uCloudMap;uniform float uCloudOffset,uDisplayMode;
      void main(){
        vec3 albedo=texture2D(uSurfaceMap,vUv).rgb;
        vec4 data=texture2D(uNormalMap,vUv);float land=data.a;
        vec3 N=normalize(vN),V=normalize(-vP),L=sun();
        // Cotangent frame: geographic normal detail, not arbitrary per-frame noise.
        vec3 dp1=dFdx(vP),dp2=dFdy(vP);vec2 du1=dFdx(vUv),du2=dFdy(vUv);
        vec3 a=cross(dp2,N),b=cross(N,dp1);
        vec3 T=a*du1.x+b*du2.x,B=a*du1.y+b*du2.y;
        float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12));
        vec3 mapN=data.rgb*2.-1.;mapN.xy*=${p.normal.toFixed(3)}*land;
        vec3 terrainN=normalize(mat3(T*inv,B*inv,N)*normalize(mapN));
        float nl=dot(N,L),diffuse=max(dot(terrainN,L),0.);
        // Day-map radiance is decoded once. Rough land preserves regional geology/color.
        float meso=luminance(albedo);
        vec3 charcoal=mix(vec3(meso)*vec3(.62,.77,1.02),albedo*vec3(.72,.84,1.02),.18);
        float scatter=exp(-abs(nl)/.18);
        float bounce=(.032+.022*max(nl+.45,0.)+.052*scatter)*${p.bounce.toFixed(3)};
        vec3 terrain=charcoal*(bounce+.34*diffuse);
        terrain+=vec3(.0006,.0013,.0024)*scatter;
        // Fresnel water BRDF has a separate roughness and low diffuse albedo.
        vec3 ocean=vec3(.0008,.0020,.0042)*(.42+.75*max(nl,0.));
        vec3 H=normalize(L+V);float nv=max(dot(N,V),.001),nh=max(dot(N,H),0.);
        float rough=${p.roughness.toFixed(3)}+meso*.12,a2=pow(rough,4.);
        float D=a2/(3.14159*pow(nh*nh*(a2-1.)+1.,2.));
        float F=.020+.98*pow(1.-max(dot(V,H),0.),5.);
        float spec=min(D*F/(4.*max(nv,.06)),.28)*max(nl,0.);
        ocean+=vec3(.36,.48,.62)*spec;
        ocean+=vec3(.002,.005,.011)*pow(1.-nv,3.)*(.12+.88*max(nl,0.));
        float cloud=cloudCover(uCloudMap,vUv+vec2(uCloudOffset-.0016,.0008));
        vec3 color=mix(ocean,terrain,land)*(1.-cloud*.36*max(nl+.15,0.));
        // Atmosphere bounce on the ground stays separate from the outer gas integration.
        color+=vec3(.0010,.0035,.0075)*scatter*pow(1.-nv,1.5);
        if(uDisplayMode>1.5)color=vec3(.001,.002,.004);
        gl_FragColor=vec4(color,uOpacity);
      }`;
  }else if(kind==='city'){
    Object.assign(uniforms,{uCityMap:{value:null},uNormalMap:{value:null},uCloudMap:{value:null}});
    body=/*glsl*/`
      uniform sampler2D uCityMap,uNormalMap,uCloudMap;uniform float uCloudOffset;
      void main(){
        vec3 tiers=texture2D(uCityMap,vUv).rgb;
        float land=smoothstep(.75,.98,texture2D(uNormalMap,vUv).a);
        float nl=dot(normalize(vN),sun());float night=1.-smoothstep(-.16,.16,nl);
        float clouds=cloudCover(uCloudMap,vUv+vec2(uCloudOffset,0.));
        float energy=.21*tiers.r+.70*tiers.g+2.8*tiers.b;
        vec3 tint=mix(vec3(.86,.59,.30),vec3(1.,.91,.73),clamp(tiers.g+tiers.b,0.,1.));
        float alpha=land*night*(1.-.83*clouds)*smoothstep(.015,.12,facing())*uOpacity;
        gl_FragColor=vec4(tint*energy,alpha);
      }`;
  }else if(kind==='cloud'){
    uniforms.uCloudMap={value:null};
    body=/*glsl*/`
      uniform sampler2D uCloudMap;
      void main(){
        vec3 data=texture2D(uCloudMap,vUv).rgb;
        float nl=dot(normalize(vN),sun()),f=facing();
        // Real mesoscale cloud bands supply erosion. No stochastic runtime resynthesis.
        float thickness=max(0.,data.r*.78+data.g*.18+data.b*.04);
        float optical=1.-exp(-${p.cloud.toFixed(3)}*thickness);
        float neighbor=texture2D(uCloudMap,vUv+vec2(-.0016,.0008)).g;
        float shadow=exp(-max(neighbor-data.g,0.)*3.2);
        float diffuse=max(nl,0.);
        float twilight=exp(-abs(nl)/.13);
        float thin=1.-smoothstep(.2,.7,data.g);
        vec3 color=vec3(.49,.55,.63)*(diffuse*.65+.08*twilight)*shadow;
        color+=vec3(.0015,.0024,.0042)*(1.-diffuse);
        color+=vec3(.035,.060,.095)*pow(1.-f,2.)*max(nl,0.)*thin;
        gl_FragColor=vec4(color,optical*uOpacity*smoothstep(.004,.04,f));
      }`;
  }else if(kind==='atmosphere'){
    body=/*glsl*/`
      vec2 sphere(vec3 ro,vec3 rd,float radius){
        float b=dot(ro,rd),d=b*b-dot(ro,ro)+radius*radius;
        if(d<0.)return vec2(1.,-1.);
        float s=sqrt(d);return vec2(-b-s,-b+s);
      }
      void main(){
        // Camera-relative ray chord, clipped by the ground; no fixed screen-space rim.
        vec3 ro=vCameraLocal,rd=normalize(vLocal-ro),L=normalize(vSunLocal);
        vec2 air=sphere(ro,rd,1.89);float enter=max(air.x,0.),leave=air.y;
        vec2 ground=sphere(ro,rd,1.85);if(ground.x>0.&&ground.y>ground.x)leave=min(leave,ground.x);
        if(leave<=enter)discard;
        float stepSize=(leave-enter)/8.,optical=0.;vec3 sum=vec3(0.);
        float mu=dot(rd,L),rayPhase=.75*(1.+mu*mu),miePhase=phaseHG(mu,${p.mie.toFixed(3)});
        for(int i=0;i<8;i++){
          vec3 point=ro+rd*(enter+(float(i)+.5)*stepSize);
          float h=max(length(point)-1.85,0.),sunCos=dot(normalize(point),L);
          float rho=exp(-h/${p.height.toFixed(4)}),aerosol=exp(-h/.0020);
          float horizon=-sqrt(max(0.,1.-pow(1.85/length(point),2.)));
          float lit=smoothstep(horizon-.035,horizon+.035,sunCos);
          float sunDepth=rho*${p.height.toFixed(4)}/max(sunCos-horizon+.06,.06);
          vec3 beta=vec3(.40,.96,2.12);
          vec3 transmission=exp(-beta*(optical+sunDepth)*3.2);
          vec3 scattering=beta*rho*rayPhase+vec3(.54,.65,.78)*aerosol*miePhase*.28;
          sum+=transmission*scattering*stepSize*(.006+lit*1.45);
          optical+=rho*stepSize;
        }
        gl_FragColor=vec4(sum,1.);
      }`;
  }else throw new Error('Unknown orbital layer');
  return new THREE.ShaderMaterial({name:`EarthOrbital-${kind}-${candidate}`,uniforms,
    vertexShader:vertex,fragmentShader:common+body,transparent:kind!=='surface',
    depthWrite:kind==='surface',depthTest:kind!=='atmosphere',
    blending:['city','atmosphere'].includes(kind)?THREE.AdditiveBlending:THREE.NormalBlending,
    side:THREE.FrontSide,fog:false,toneMapped:!['city','atmosphere'].includes(kind)});
}
