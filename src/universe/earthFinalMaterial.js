import * as THREE from 'three';

// One material per existing sphere. These presets are confined to homeFinalV1.
export const EARTH_FINAL_CANDIDATES = Object.freeze({
  A: Object.freeze({ name:'dark cinematic', surface:.84, cities:.78, clouds:.72, haze:.82, sunrise:.9 }),
  B: Object.freeze({ name:'balanced', surface:1, cities:1, clouds:1, haze:1, sunrise:1 }),
  C: Object.freeze({ name:'atmospheric hero', surface:.94, cities:.92, clouds:1.16, haze:1.22, sunrise:1.12 })
});
export const EARTH_FINAL_RADII = Object.freeze({ surface:1.85, atmosphere:1.995 });

// The closest approach of the view ray, not shell Fresnel, locates the true ground limb.
export function atmosphericHeight(facing) {
  const {surface,atmosphere}=EARTH_FINAL_RADII;
  return (atmosphere*Math.sqrt(Math.max(0,1-facing*facing))-surface)/(atmosphere-surface);
}

const vertexShader=/*glsl*/`
  varying vec2 vUv;
  varying vec3 vNormalView,vViewDirection,vNormalObject;
  void main(){
    vec4 p=modelViewMatrix*vec4(position,1.);
    vUv=uv;vNormalObject=normal;vNormalView=normalize(normalMatrix*normal);
    vViewDirection=normalize(-p.xyz);gl_Position=projectionMatrix*p;
  }`;
const common=/*glsl*/`
  varying vec2 vUv;
  varying vec3 vNormalView,vViewDirection,vNormalObject;
  uniform float uOpacity,uGain;
  // A shared view-space light keeps independently rotating cloud and surface terminators aligned.
  vec3 sunlight(){return normalize(vec3(.72,.56,-.44));}
  float sunFacing(){return dot(normalize(vNormalView),sunlight());}
  float facing(){return clamp(dot(normalize(vNormalView),normalize(vViewDirection)),0.,1.);}
  float field(vec3 p){return .5+.18*sin(p.x*3.7+p.y*2.1)+.17*sin(p.z*4.3-p.y*1.8)+.15*sin(p.x*8.1-p.z*3.);}
`;

export function createEarthFinalMaterial(kind,{candidate='B',sunDirection=new THREE.Vector3(1,0,0),sharedTime={value:0}}={}) {
  const preset=EARTH_FINAL_CANDIDATES[candidate];
  if(!preset)throw new Error('Unknown Earth final candidate');
  const uniforms={uOpacity:{value:1},uGain:{value:1},uTime:sharedTime,
    uSunDirectionObject:{value:sunDirection.clone()},uDisplayMode:{value:0},uLayerMode:{value:5}};
  let fragmentShader;
  if(kind==='surface'){
    uniforms.uSurfaceMap={value:null};uniforms.uGain.value=preset.surface;
    fragmentShader=common+/*glsl*/`
      uniform sampler2D uSurfaceMap;uniform float uDisplayMode;
      void main(){
        vec3 tex=texture2D(uSurfaceMap,vUv).rgb;
        float luma=dot(tex,vec3(.2126,.7152,.0722));
        // This source is already night-graded sRGB. Its decoded land luminance is ~.01,
        // not a daytime .1; retain its tonal structure instead of crushing it a second time.
        float land=smoothstep(.42,.95,(tex.r+tex.g*.25)/(tex.b+.001))*smoothstep(.001,.013,luma);
        float illumination=smoothstep(-.70,.50,sunFacing());
        float detail=pow(clamp(luma*8.,0.,1.),.55);
        vec3 ocean=vec3(.0013,.004,.0105),terrain=vec3(.017,.031,.054);
        vec3 color=mix(ocean,terrain,land)*mix(.22,2.2,illumination);
        color+=vec3(.08,.12,.17)*detail*land*mix(.10,.7,illumination);
        color+=tex*vec3(.32,.37,.46)*detail*mix(.13,1.15,illumination);
        color*=.8+.4*field(vNormalObject);
        float reflection=pow(1.-facing(),2.)*smoothstep(-.16,.52,sunFacing());
        color+=mix(vec3(.008,.023,.045),vec3(.008,.017,.028),land)*reflection;
        if(uDisplayMode>1.5)color=vec3(.002,.006,.015);
        gl_FragColor=vec4(color*uGain,uOpacity);
      }`;
  }else if(kind==='city'){
    uniforms.uCityMap={value:null};uniforms.uGain.value=preset.cities;
    fragmentShader=common+/*glsl*/`
      uniform sampler2D uCityMap;
      void main(){
        vec4 tex=texture2D(uCityMap,vUv);float luma=dot(tex.rgb,vec3(.38,.54,.08));
        float peak=max(tex.r,max(tex.g,tex.b));
        float weak=smoothstep(.10,.64,luma),metro=smoothstep(.52,.86,luma);
        float hero=smoothstep(.86,.995,peak)*smoothstep(.75,.98,luma);
        float regional=.5+.5*field(vNormalObject*2.4);
        float energy=(weak*.27+metro*.90+hero*2.1)*regional;
        float night=1.-smoothstep(-.05,.42,sunFacing());
        float alpha=tex.a*night*smoothstep(.01,.24,facing())*uOpacity*uGain;
        vec3 gold=mix(vec3(.72,.43,.14),vec3(1.,.82,.5),hero);
        gl_FragColor=vec4(gold*energy,alpha);
      }`;
  }else if(kind==='cloud'){
    uniforms.uCloudMap={value:null};uniforms.uGain.value=preset.clouds;
    fragmentShader=common+/*glsl*/`
      uniform sampler2D uCloudMap;
      void main(){
        vec2 d=vec2(1./2048.,1./1024.);
        vec4 tex=texture2D(uCloudMap,vUv)*.4;
        tex+=(texture2D(uCloudMap,vUv+d)+texture2D(uCloudMap,vUv-d)
          +texture2D(uCloudMap,vUv+vec2(d.x,-d.y))+texture2D(uCloudMap,vUv+vec2(-d.x,d.y)))*.15;
        float density=dot(tex.rgb,vec3(.2126,.7152,.0722));
        float erosion=.55+.45*field(vNormalObject*13.);
        float light=smoothstep(-.30,.50,sunFacing());
        float alpha=tex.a*smoothstep(.03,.55,density)*erosion*(.014+.986*light)*uOpacity*uGain;
        alpha*=smoothstep(.012,.15,facing());
        vec3 silver=mix(vec3(.026,.048,.08),vec3(.48,.60,.74),light);
        gl_FragColor=vec4(silver*(.55+.45*density),min(alpha,.62));
      }`;
  }else if(kind==='atmosphere'){
    uniforms.uGain.value=preset.haze;uniforms.uSunrise={value:preset.sunrise};
    fragmentShader=common+/*glsl*/`
      uniform float uSunrise;
      void main(){
        float f=facing();
        float impact=1.995*sqrt(max(0.,1.-f*f));
        float height=(impact-1.85)/(1.995-1.85);
        float inner=exp(-abs(height)*7.);
        float outer=exp(-max(height,0.)*3.5)*exp(min(height,0.)*5.);
        float boundary=1.-smoothstep(.55,1.,height);
        float lit=smoothstep(-.24,.64,sunFacing());
        float localArc=pow(max(0.,dot(normalize(vNormalView.xy),normalize(sunlight().xy))),64.);
        float sunrise=localArc*inner*uSunrise;
        vec3 haze=vec3(.012,.052,.16)*outer*(.025+.30*lit)*uGain;
        vec3 rim=mix(vec3(.012,.044,.12),vec3(.16,.39,.71),lit)*inner*(.08+.38*lit);
        vec3 color=(haze+rim+vec3(.74,.87,1.)*sunrise*.40)*boundary;
        gl_FragColor=vec4(color,1.);
      }`;
  }else throw new Error('Unknown Earth final layer');
  const additive=kind==='city'||kind==='atmosphere';
  return new THREE.ShaderMaterial({name:`EarthFinal-${kind}-${candidate}`,uniforms,vertexShader,fragmentShader,
    transparent:kind!=='surface',depthTest:kind!=='atmosphere',depthWrite:kind==='surface',
    blending:additive?THREE.AdditiveBlending:THREE.NormalBlending,
    side:THREE.FrontSide,fog:false,toneMapped:!additive});
}
