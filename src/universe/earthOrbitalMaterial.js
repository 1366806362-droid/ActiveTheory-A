import * as THREE from 'three';
import { earthGroundTruthBody } from './earthGroundTruthShaders.js';
import { resolveHomeRuntimeSearch } from './homeRuntimeProfile.js';

export const EARTH_ORBITAL_URLS = Object.freeze(Object.fromEntries([
  ['surface','surface'],['city','city'],['clouds','cloud'],['normal','normal-land']
].map(([key,file])=>[key,`/textures/hero/earth/orbital-v12/earth-orbital-${file}.webp`])));
export const EARTH_ORBITAL_PROFILES = Object.freeze({
  // A: thinner dry air / urban contrast; B: weather relief; C: diffuse humid air.
  A: Object.freeze({roughness:.13,normal:.12,cloud:1.9,height:.0045,mie:.65,bounce:.85,relief:.15,indirect:.8,urban:1.18,aerosol:.20}),
  B: Object.freeze({roughness:.20,normal:.23,cloud:2.8,height:.0060,mie:.72,bounce:1.0,relief:.28,indirect:1.0,urban:1.0,aerosol:.28}),
  C: Object.freeze({roughness:.28,normal:.16,cloud:3.5,height:.0080,mie:.80,bounce:.9,relief:.10,indirect:1.1,urban:.94,aerosol:.38})
});
export function readEarthOrbital(search=typeof window==='undefined'?'':window.location.search) {
  const q=new URLSearchParams(resolveHomeRuntimeSearch(search));
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
  // Project a thin cloud altitude along a local light/view ray into spherical UVs.
  // Geometry, rotation and filtering are shared; no screen-space or random offset.
  vec2 cloudRayOffset(vec3 direction,float height){
    vec3 n=normalize(vLocal),d=normalize(direction);
    float latitudeRadius=max(length(n.xz),.08);
    vec3 east=vec3(n.z,0.,-n.x)/latitudeRadius;
    vec3 north=normalize(vec3(0.,1.,0.)-n*n.y+vec3(1e-7,0.,0.));
    float distance=height/max(dot(n,d),.16);
    return vec2(dot(d,east)/(6.283185*1.85*latitudeRadius),dot(d,north)/(3.141593*1.85))*distance;
  }
  float cloudTransmission(float density,float viewCos){
    // Thin cirrus transmits; thick weather attenuates nonlinearly with slant depth.
    return exp(-3.2*pow(max(density,0.),1.4)/sqrt(max(viewCos,.30)));
  }
  float phaseHG(float mu,float g){return (1.-g*g)/pow(max(1.+g*g-2.*g*mu,.015),1.5);}
`;

export function createEarthOrbitalMaterial(kind,{candidate='B',cloudOffset={value:0},sharedTime={value:0},groundTruth=null}={}){
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
        float nightZone=1.-smoothstep(-.12,.12,nl);
        float skyReach=.18+.82*smoothstep(-.70,.10,nl);
        float regional=sqrt(clamp(meso*5.,0.,1.));
        // Low-energy diffuse sky return reveals geography only after dark adaptation.
        terrain+=vec3(.0065,.0080,.0100)*(.25+.75*regional)*nightZone*skyReach*${p.indirect.toFixed(3)};
        // Fresnel water BRDF has a separate roughness and low diffuse albedo.
        vec3 ocean=vec3(.0008,.0020,.0042)*(.42+.75*max(nl,0.));
        vec3 H=normalize(L+V);float nv=max(dot(N,V),.001),nh=max(dot(N,H),0.);
        float rough=${p.roughness.toFixed(3)}+meso*.12,a2=pow(rough,4.);
        float D=a2/(3.14159*pow(nh*nh*(a2-1.)+1.,2.));
        float F=.020+.98*pow(1.-max(dot(V,H),0.),5.);
        float rawSpec=D*F/(4.*max(nv,.06));
        // Smooth local energy shoulder avoids the old hard-clipped circular glint.
        float spec=rawSpec/(1.+rawSpec/.20)*max(nl,0.);
        ocean+=vec3(.36,.48,.62)*spec;
        ocean+=vec3(.002,.005,.011)*pow(1.-nv,3.)*(.12+.88*max(nl,0.));
        vec2 shadowUv=vUv+vec2(uCloudOffset,0.)+cloudRayOffset(vSunLocal,.0046);
        vec3 weather=texture2D(uCloudMap,shadowUv).rgb;
        float cloud=mix(weather.g,weather.b,.35);
        float groundTransmission=mix(1.,exp(-cloud*1.6),.26*smoothstep(-.08,.18,nl));
        vec3 color=mix(ocean,terrain,land)*groundTransmission;
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
        vec2 viewUv=vUv+vec2(uCloudOffset,0.)+cloudRayOffset(vCameraLocal-vLocal,.0040);
        float clouds=cloudCover(uCloudMap,viewUv);
        // Existing R/G/B geographic classes: weak settlement, urban belt, rare metro core.
        float settlement=.16*pow(tiers.r,.85);
        float urban=1.25*pow(tiers.g,.62)*${p.urban.toFixed(3)};
        float hero=3.6*pow(tiers.b,.85);
        float energy=settlement+urban+hero;
        vec3 tint=mix(vec3(1.,.76,.44),vec3(1.,.93,.78),clamp(tiers.g*1.5+tiers.b,0.,1.));
        float alpha=land*night*cloudTransmission(clouds,facing())*smoothstep(.015,.12,facing())*uOpacity;
        gl_FragColor=vec4(tint*energy,alpha);
      }`;
  }else if(kind==='cloud'){
    uniforms.uCloudMap={value:null};
    body=/*glsl*/`
      uniform sampler2D uCloudMap;
      void main(){
        vec3 data=texture2D(uCloudMap,vUv).rgb;
        float nl=dot(normalize(vN),sun()),f=facing();
        // Weather/mid fields own body, fine source residual only breaks thin edges.
        float body=.70*data.g+.30*data.b;
        float thickness=max(0.,body+.68*(data.r-data.g));
        float optical=1.-exp(-${p.cloud.toFixed(3)}*thickness);
        vec2 texel=vec2(1./4096.,1./2048.);
        float west=texture2D(uCloudMap,vUv-vec2(texel.x*2.,0.)).g;
        float east=texture2D(uCloudMap,vUv+vec2(texel.x*2.,0.)).g;
        float south=texture2D(uCloudMap,vUv-vec2(0.,texel.y*2.)).g;
        float north=texture2D(uCloudMap,vUv+vec2(0.,texel.y*2.)).g;
        vec3 N=normalize(vN),dp1=dFdx(vP),dp2=dFdy(vP);
        vec2 du1=dFdx(vUv),du2=dFdy(vUv);
        vec3 a=cross(dp2,N),b=cross(N,dp1);
        vec3 T=a*du1.x+b*du2.x,B=a*du1.y+b*du2.y;
        float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12));
        vec2 rawSlope=vec2(west-east,south-north)*8.;
        // Soft relief shoulder: avoid embossed plateaus at dense weather boundaries.
        vec2 slope=rawSlope/(1.+length(rawSlope)/.45);
        vec3 reliefNormal=normalize(N+${p.relief.toFixed(3)}*(T*inv*slope.x+B*inv*slope.y));
        vec2 sunOffset=cloudRayOffset(vSunLocal,.0024);
        float ahead=texture2D(uCloudMap,vUv+sunOffset).g;
        float aheadFar=texture2D(uCloudMap,vUv+sunOffset*2.).b;
        float shadow=exp(-max(.7*ahead+.3*aheadFar-body,0.)*2.4);
        float sunVisible=smoothstep(-.07,.10,nl);
        float diffuse=max(dot(reliefNormal,sun()),0.)*sunVisible;
        float twilight=exp(-abs(nl)/.11)*sunVisible;
        float thin=1.-smoothstep(.2,.7,body);
        float silverLining=pow(max(dot(normalize(vP),sun()),0.),5.)*thin*sunVisible;
        vec3 color=vec3(.49,.55,.63)*(diffuse*.65+.055*twilight)*shadow;
        color+=vec3(.0012,.0018,.0026)*(1.-sunVisible)*(.22+.78*smoothstep(-.6,.0,nl));
        color+=vec3(.030,.043,.061)*silverLining;
        color+=vec3(.025,.045,.070)*pow(1.-f,2.)*max(nl,0.)*thin;
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
        float optical=0.;vec3 sum=vec3(0.);
        float mu=dot(rd,L),rayPhase=.75*(1.+mu*mu),miePhase=phaseHG(mu,${p.mie.toFixed(3)});
        for(int i=0;i<8;i++){
          // Cosine bins put more samples near both shell/ground boundaries, no extra steps.
          float t0=.5-.5*cos(3.141593*float(i)/8.);
          float t1=.5-.5*cos(3.141593*float(i+1)/8.);
          float stepSize=(leave-enter)*(t1-t0);
          vec3 point=ro+rd*(enter+(leave-enter)*(.5*(t0+t1)));
          float h=max(length(point)-1.85,0.),sunCos=dot(normalize(point),L);
          float rho=exp(-h/${p.height.toFixed(4)}),aerosol=exp(-h/.0020);
          float horizon=-sqrt(max(0.,1.-pow(1.85/length(point),2.)));
          float lit=smoothstep(horizon-.035,horizon+.035,sunCos);
          float sunDepth=rho*${p.height.toFixed(4)}/max(sunCos-horizon+.06,.06);
          vec3 beta=vec3(.40,.96,2.12);
          vec3 transmission=exp(-beta*(optical+sunDepth)*3.2);
          float airglow=.25+.75*smoothstep(-.35,.05,sunCos);
          vec3 scattering=beta*rho*rayPhase+vec3(.54,.65,.78)*aerosol*miePhase*${p.aerosol.toFixed(3)};
          sum+=transmission*scattering*stepSize*(.004*airglow+lit*1.45);
          optical+=rho*stepSize;
        }
        gl_FragColor=vec4(sum,1.);
      }`;
  }else throw new Error('Unknown orbital layer');
  if(groundTruth)body=earthGroundTruthBody(kind,groundTruth);
  return new THREE.ShaderMaterial({name:groundTruth?`EarthGroundTruth-${kind}-${groundTruth.candidate}`:`EarthOrbital-${kind}-${candidate}`,uniforms,
    vertexShader:vertex,fragmentShader:common+body,transparent:kind!=='surface',
    depthWrite:kind==='surface',depthTest:kind!=='atmosphere',
    blending:['city','atmosphere'].includes(kind)?THREE.AdditiveBlending:THREE.NormalBlending,
    side:THREE.FrontSide,fog:false,toneMapped:!['city','atmosphere'].includes(kind)});
}
