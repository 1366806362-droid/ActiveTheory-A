import * as THREE from 'three';

// Independent candidate: the approved HOME FINAL V1 materials remain untouched.
export const EARTH_REALISM_PROFILES = Object.freeze({
  A: Object.freeze({ name: 'dark orbital', night: .42, terrain: .78, ocean: .8, cloudThickness: 1.15, cloudShadow: .32, height: .012, mie: .14 }),
  B: Object.freeze({ name: 'balanced orbital', night: .58, terrain: 1, ocean: 1, cloudThickness: 1.65, cloudShadow: .43, height: .018, mie: .22 }),
  C: Object.freeze({ name: 'weather and scattering', night: .5, terrain: .85, ocean: .65, cloudThickness: 2.15, cloudShadow: .52, height: .026, mie: .32 })
});

export function readEarthRealism(search = typeof window === 'undefined' ? '' : window.location.search) {
  const params = new URLSearchParams(search);
  if (params.get('earthRealism') !== '1' || params.get('earthV3') !== '1' || params.get('earthV2') !== '1') return null;
  const candidate = params.get('earthRealismCandidate');
  return Object.hasOwn(EARTH_REALISM_PROFILES, candidate) ? candidate : 'B';
}

const vertexShader = /*glsl*/`
  varying vec2 vUv;
  varying vec3 vNormalView,vViewDirection,vNormalObject;
  void main(){
    vec4 p=modelViewMatrix*vec4(position,1.);
    vUv=uv;vNormalObject=normal;vNormalView=normalize(normalMatrix*normal);
    vViewDirection=normalize(-p.xyz);gl_Position=projectionMatrix*p;
  }`;
const common = /*glsl*/`
  varying vec2 vUv;
  varying vec3 vNormalView,vViewDirection,vNormalObject;
  uniform float uOpacity;
  vec3 sunlight(){return normalize(vec3(.72,.56,-.44));}
  float sunFacing(){return dot(normalize(vNormalView),sunlight());}
  float facing(){return clamp(dot(normalize(vNormalView),normalize(vViewDirection)),0.,1.);}
  float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float noise3(vec3 p){
    vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
      mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  float cloudDensity(sampler2D map,vec2 uv){
    // Existing weather coverage carries the large systems; smooth density retains thin edges.
    vec4 c=texture2D(map,uv);
    float fine=c.a*luminance(c.rgb);
    vec2 d=vec2(2./2048.,2./1024.);
    vec4 a=texture2D(map,uv+d),b=texture2D(map,uv-d);
    float broad=.5*(a.a*luminance(a.rgb)+b.a*luminance(b.rgb));
    return clamp(fine*.72+broad*.28,0.,1.);
  }
`;

export function createEarthRealismMaterial(kind, { candidate = 'B', sharedTime = { value: 0 }, cloudOffset = { value: 0 } } = {}) {
  const p = EARTH_REALISM_PROFILES[candidate];
  if (!p) throw new Error('Unknown Earth realism candidate');
  const uniforms = {
    uOpacity: { value: 1 }, uTime: sharedTime, uCloudOffset: cloudOffset,
    uSunDirectionObject: { value: new THREE.Vector3() }, uDisplayMode: { value: 0 }, uLayerMode: { value: 5 }
  };
  let body;
  if (kind === 'surface') {
    Object.assign(uniforms, { uSurfaceMap: { value: null }, uCloudMap: { value: null } });
    body = /*glsl*/`
      uniform sampler2D uSurfaceMap,uCloudMap;uniform float uCloudOffset,uDisplayMode;
      void main(){
        vec3 tex=texture2D(uSurfaceMap,vUv).rgb;
        float luma=luminance(tex);
        float land=smoothstep(.43,.91,(tex.r+tex.g*.25)/(tex.b+.001))*smoothstep(.0008,.009,luma);
        float sun=sunFacing(),f=facing(),day=smoothstep(-.60,.42,sun);
        float twilight=exp(-pow((sun+.10)/.24,2.));
        // Keep continent and regional texture values, rather than flattening the land mask.
        float regional=clamp(luma/.026,0.,1.7);
        vec3 terrain=vec3(.007,.014,.023)+tex*vec3(1.55,1.8,2.15);
        terrain*=mix(.70,1.12,smoothstep(.005,.040,luma));
        vec3 ocean=vec3(.0011,.0034,.008)+tex*vec3(.075,.10,.15);
        vec3 color=mix(ocean,terrain*${p.terrain.toFixed(3)},land);
        // The source atlas is already night-graded: retain reflected terrain energy
        // instead of applying a second full day/night exposure to its dark texels.
        color*=mix(${(.42*p.night).toFixed(4)},1.75,day);
        color+=mix(vec3(.0007,.0017,.0036),vec3(.0019,.0039,.0061)*(.4+regional),land)*twilight;
        // Low-amplitude screen-space slope from existing regional terrain; no displacement/noisy mesh.
        vec3 N=normalize(vNormalView);
        vec3 dx=dFdx(N),dy=dFdy(N);
        float h=log(1.+luma*36.);
        vec3 slope=normalize(N-dx*dFdx(h)*3.5-dy*dFdy(h)*3.5);
        float terrainLight=clamp(1.+(dot(slope,sunlight())-dot(N,sunlight()))*2.,.88,1.12);
        color*=mix(1.,terrainLight,land);
        // Ocean glint is view-dependent and suppressed on land and the night hemisphere.
        vec3 H=normalize(sunlight()+normalize(vViewDirection));
        float glint=pow(max(dot(N,H),0.),100.)*(.025+.11*pow(1.-f,5.));
        color+=vec3(.14,.23,.33)*glint*day*(1.-land)*${p.ocean.toFixed(3)};
        float shadow=cloudDensity(uCloudMap,vUv+vec2(uCloudOffset-.002,.001));
        color*=1.-shadow*${p.cloudShadow.toFixed(3)}*day;
        float aerial=pow(1.-f,3.)*smoothstep(-.3,.5,sun);
        color+=vec3(.002,.009,.022)*aerial;
        if(uDisplayMode>1.5) color=vec3(.002,.004,.009);
        gl_FragColor=vec4(color,uOpacity);
      }`;
  } else if (kind === 'city') {
    Object.assign(uniforms, { uCityMap: { value: null }, uCloudMap: { value: null } });
    body = /*glsl*/`
      uniform sampler2D uCityMap,uCloudMap;uniform float uCloudOffset;
      void main(){
        vec4 tex=texture2D(uCityMap,vUv);
        float signal=luminance(tex.rgb);
        // Population hierarchy follows the existing urban atlas, not random cells.
        float settlement=pow(smoothstep(.045,.65,signal),1.5);
        float metro=pow(smoothstep(.40,.90,signal),2.);
        float hero=pow(smoothstep(.88,.998,signal),3.);
        float energy=.30*settlement+1.15*metro+2.1*hero;
        float night=1.-smoothstep(-.18,.28,sunFacing());
        float cloud=cloudDensity(uCloudMap,vUv+vec2(uCloudOffset,0.));
        float alpha=tex.a*night*smoothstep(.008,.15,facing())*uOpacity*(1.-cloud*.7);
        vec3 gold=mix(vec3(.64,.34,.12),vec3(1.,.82,.56),smoothstep(.65,.98,signal));
        gl_FragColor=vec4(gold*energy,alpha);
      }`;
  } else if (kind === 'cloud') {
    uniforms.uCloudMap = { value: null };
    body = /*glsl*/`
      uniform sampler2D uCloudMap;
      void main(){
        float density=cloudDensity(uCloudMap,vUv);
        // Three scales modulate optical thickness inside the existing weather systems.
        float weather=.50+.27*noise3(vNormalObject*9.)+.23*noise3(vNormalObject*32.);
        float edge=noise3(vNormalObject*135.);
        float thickness=max(0.,density*(.50+weather)-.06*edge);
        float optical=1.-exp(-thickness*${p.cloudThickness.toFixed(3)});
        float sun=sunFacing(),day=smoothstep(-.26,.42,sun);
        float twilight=exp(-pow((sun+.06)/.25,2.));
        float neighbor=cloudDensity(uCloudMap,vUv+vec2(.0016,-.001));
        float relief=clamp(1.+(density-neighbor)*1.8,.62,1.35);
        vec3 color=mix(vec3(.004,.008,.014),vec3(.32,.40,.50),day)*relief;
        color+=vec3(.010,.020,.037)*twilight;
        float silver=pow(1.-facing(),2.5)*day;
        color+=vec3(.025,.047,.08)*silver;
        float alpha=optical*uOpacity*smoothstep(.008,.09,facing());
        gl_FragColor=vec4(color,alpha);
      }`;
  } else if (kind === 'atmosphere') {
    body = /*glsl*/`
      void main(){
        float f=facing();
        float height=1.995*sqrt(max(0.,1.-f*f))-1.85;
        float sun=sunFacing();
        float illumination=smoothstep(-.18,.60,sun);
        // Tangent optical depth peaks at the ground limb and decays by scale height.
        float column=exp(-max(height,0.)/${p.height.toFixed(4)})*exp(min(height,0.)/.035);
        float inner=exp(-abs(height)/.010);
        float haze=exp(-max(height,0.)/${(p.height*2.1).toFixed(4)})*exp(min(height,0.)/.075);
        float boundary=1.-smoothstep(.085,.14,height);
        float angle=dot(normalize(vViewDirection),sunlight());
        float rayleigh=.75*(1.+angle*angle);
        float arc=max(0.,dot(normalize(vNormalView.xy),normalize(sunlight().xy)));
        float sunrise=pow(arc,48.)*inner*${p.mie.toFixed(3)};
        vec3 scatter=vec3(.013,.051,.14)*column*(.008+.45*illumination)*rayleigh;
        scatter+=vec3(.005,.020,.062)*haze*(.006+.32*illumination);
        scatter+=vec3(.11,.28,.48)*inner*illumination*.40;
        scatter+=vec3(.58,.73,.85)*sunrise;
        gl_FragColor=vec4(scatter*boundary,1.);
      }`;
  } else throw new Error('Unknown Earth realism layer');
  const additive = kind === 'city' || kind === 'atmosphere';
  return new THREE.ShaderMaterial({ name: `EarthRealism-${kind}-${candidate}`, uniforms,
    vertexShader, fragmentShader: common + body, transparent: kind !== 'surface',
    depthTest: kind !== 'atmosphere', depthWrite: kind === 'surface',
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.FrontSide, fog: false, toneMapped: !additive });
}
