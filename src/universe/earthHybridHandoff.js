import * as THREE from 'three';

export const EARTH_HANDOFF=Object.freeze({hero:6,full:14,deadZone:.25});
// A single-view orbital hero must not silently become a free-orbit globe after
// a long dwell. Monotonic finite drift preserves the initial captured phase and
// initial angular velocity without a clamp, reversal, or independent clock.
export function earthHeroRotation(time,surfaceInitial,cloudInitial,angularSpeed,cloudMultiplier=1.11){
  const t=Math.max(0,Number.isFinite(time)?time:0),extent=Math.PI/60;
  return {surfaceAngle:surfaceInitial-extent*Math.tanh(t*angularSpeed/extent),
    cloudAngle:cloudInitial-extent*cloudMultiplier*Math.tanh(t*angularSpeed/extent)};
}
const smooth=(a,b,x)=>{const t=THREE.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
// Continuous angular play operator: no visibility toggle, no second clock.
export function createEarthHandoffState(){
  let angle=null;
  return {update(measured){
    const value=Math.max(0,Number.isFinite(measured)?measured:90);
    if(angle===null)angle=value;
    else if(value>angle+EARTH_HANDOFF.deadZone)angle=value-EARTH_HANDOFF.deadZone;
    else if(value<angle-EARTH_HANDOFF.deadZone)angle=value+EARTH_HANDOFF.deadZone;
    const mix=smooth(EARTH_HANDOFF.hero,EARTH_HANDOFF.full,angle);
    return {angle,measured:value,mix,zone:mix===0?'HERO':mix===1?'FALLBACK':'HANDOFF'};
  }};
}

const project=/*glsl*/`
 uniform sampler2D uHeroSurface,uHeroCity,uHeroCloud;
 uniform mat4 uCapture;uniform vec3 uCaptureCamera;
 uniform float uTanFov,uHandoff,uCalibration;
 vec3 grade(vec3 c){float y=dot(c,vec3(.2126,.7152,.0722));return mix(vec3(y)*vec3(.83,.94,1.08),c,.30);}
 vec2 heroUv(){vec3 p=(uCapture*vec4(vLocal,1.)).xyz;return .5+.5*p.xy/(-p.z*uTanFov);}
 float supported(vec2 uv){
   float facing=dot(normalize(vLocal),normalize(uCaptureCamera-vLocal));
   float edge=min(min(uv.x,uv.y),min(1.-uv.x,1.-uv.y));
   return smoothstep(0.,.035,facing)*smoothstep(0.,.012,edge);
 }
 vec3 calibrated(vec3 color,vec3 reference,float weight){
   float a=dot(color,vec3(.2126,.7152,.0722)),b=dot(reference,vec3(.2126,.7152,.0722));
   float gain=clamp(b/max(a,.008),.70,1.85);
   return mix(color,color*gain,weight);
 }
`;

export function createEarthMaterialHandoff({surface,city,cloud,manifest,maps,initialSurface=-1.7,initialCloud=0}){
  const state=createEarthHandoffState(),originalSurface=surface.material,originalCloud=cloud.material;
  const capture=new THREE.Matrix4().fromArray(manifest.cameraLocal).invert();
  const shared={uHeroSurface:{value:maps.surface},uHeroCity:{value:maps.city},uHeroCloud:{value:maps.cloud},
    uTanFov:{value:Math.tan(manifest.cameraFov*Math.PI/360)},uHandoff:{value:0},uCalibration:{value:0}};
  const addCapture=(uniforms,phase)=>{
    const rotation=new THREE.Matrix4().makeRotationY(phase),matrix=capture.clone().multiply(rotation);
    return {...uniforms,...shared,uCapture:{value:matrix},uCaptureCamera:{value:new THREE.Vector3().setFromMatrixPosition(matrix.clone().invert())}};
  };
  const surfaceCode=originalSurface.fragmentShader.replace('void main()','void realtimeSurface()');
  const cityCode=city.material.fragmentShader.slice(city.material.fragmentShader.indexOf('uniform sampler2D uCityMap'))
    .replace('uniform sampler2D uCityMap,uNormalMap,uCloudMap;uniform float uCloudOffset;','uniform sampler2D uCityMap;uniform float uCityOpacity;')
    .replace('void main()','void realtimeCity()').replaceAll('*uOpacity','*uCityOpacity');
  const body=new THREE.ShaderMaterial({name:'EarthHybrid-HandoffBody',vertexShader:originalSurface.vertexShader,
    uniforms:addCapture({...originalSurface.uniforms,uCityMap:city.material.uniforms.uCityMap,uCityOpacity:city.material.uniforms.uOpacity},initialSurface),
    fragmentShader:surfaceCode+cityCode+project+/*glsl*/`
      void main(){
        realtimeSurface();vec3 rt=gl_FragColor.rgb;realtimeCity();vec3 rtCity=gl_FragColor.rgb*gl_FragColor.a;
        vec2 uv=heroUv();float support=supported(uv);vec4 s=texture2D(uHeroSurface,uv),c=texture2D(uHeroCity,uv);
        float night=1.-smoothstep(-.16,.16,dot(normalize(vN),sun()));
        vec3 hero=grade(s.rgb/max(s.a,.01)),heroCity=c.rgb*night;
        vec4 low=textureLod(uHeroSurface,uv,4.);vec3 lowHero=grade(low.rgb/max(low.a,.01));
        vec3 matched=calibrated(rt,lowHero,uCalibration*support);
        vec3 matchedCity=calibrated(rtCity,heroCity,uCalibration*support);
        float w=(1.-uHandoff)*support*smoothstep(.001,.03,s.a);
        gl_FragColor=vec4(mix(matched+matchedCity,hero+heroCity,w),1.);
      }`,depthWrite:true,depthTest:true,fog:false});
  const weather=new THREE.ShaderMaterial({name:'EarthHybrid-HandoffCloud',vertexShader:originalCloud.vertexShader,
    uniforms:addCapture(originalCloud.uniforms,initialCloud),
    fragmentShader:originalCloud.fragmentShader.replace('void main()','void realtimeCloud()')+project+/*glsl*/`
      void main(){realtimeCloud();vec4 rt=gl_FragColor;vec2 uv=heroUv();float support=supported(uv);
        vec4 h=texture2D(uHeroCloud,uv);vec3 color=grade(h.rgb/max(h.a,.001));
        vec4 low=textureLod(uHeroCloud,uv,4.);
        vec3 matched=calibrated(rt.rgb,grade(low.rgb/max(low.a,.001)),uCalibration*support);
        float alpha=mix(rt.a,clamp(rt.a*clamp(low.a/max(rt.a,.06),.8,1.6),0.,1.),uCalibration*support);
        float w=(1.-uHandoff)*support;
        float a=mix(alpha,h.a,w);vec3 premul=mix(matched*alpha,color*h.a,w);
        gl_FragColor=vec4(premul/max(a,.001),a);
      }`,transparent:true,depthWrite:false,depthTest:true,fog:false});
  surface.material=body;cloud.material=weather;
  const previousCity=city.visible;city.visible=false;
  return {
    update(angle){const s=state.update(angle);shared.uHandoff.value=s.mix;
      shared.uCalibration.value=Math.sin(Math.PI*s.mix)*.85;city.visible=false;return s;},
    forceMix(value){shared.uHandoff.value=value;shared.uCalibration.value=0;},
    dispose(){surface.material=originalSurface;cloud.material=originalCloud;city.visible=previousCity;body.dispose();weather.dispose();}
  };
}
