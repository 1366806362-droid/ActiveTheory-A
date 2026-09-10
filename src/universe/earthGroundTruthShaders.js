// V1.3-only material bodies. Existing V1.2 shaders and all texture assets are unchanged.
// Inputs are geographic radiance/data, not independent HOME/closeup painted maps.
export function earthGroundTruthBody(kind,p){
  const f=x=>Number(x).toFixed(5);
  const scale=/*glsl*/`
    float footprint(){return max(length(dFdx(vUv)*vec2(4096.,2048.)),length(dFdy(vUv)*vec2(4096.,2048.)));}
    float minification(){return smoothstep(1.,4.,footprint());}
    vec3 tangentNormal(vec3 N,vec2 slope){
      vec3 dp1=dFdx(vP),dp2=dFdy(vP);vec2 du1=dFdx(vUv),du2=dFdy(vUv);
      vec3 a=cross(dp2,N),b=cross(N,dp1),T=a*du1.x+b*du2.x,B=a*du1.y+b*du2.y;
      float inv=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12));
      return normalize(N+(T*slope.x+B*slope.y)*inv);
    }
    float weatherTau(vec3 d){
      // Thin cirrus remains translucent; dense real weather retains its body.
      float macro=.68*d.g+.32*d.b;
      float density=max(0.,macro+.72*(d.r-d.g)*(1.-.30*minification()));
      return 3.4*pow(density,1.65);
    }
  `;
  if(kind==='surface')return scale+/*glsl*/`
    uniform sampler2D uSurfaceMap,uNormalMap,uCloudMap;uniform float uCloudOffset,uDisplayMode;
    void main(){
      vec3 albedo=texture2D(uSurfaceMap,vUv).rgb;
      vec4 geo=texture2D(uNormalMap,vUv);float land=geo.a,meso=luminance(albedo);
      vec3 N=normalize(vN),V=normalize(-vP),L=sun();
      float nl=dot(N,L),nv=max(dot(N,V),.001),mini=minification();
      vec3 terrainN=tangentNormal(N,(geo.xy*2.-1.)*.16*land*(1.-.45*mini));
      // Real geology / vegetation color is present but stays within the dark orbital palette.
      vec3 mineral=mix(vec3(meso)*vec3(.60,.76,.94),albedo*vec3(.72,.83,.93),${f(p.landTint)});
      float ice=smoothstep(.26,.65,meso)*land;
      mineral=mix(mineral,vec3(meso)*vec3(.82,.89,.96),ice*.75);
      float diffuse=max(dot(terrainN,L),0.);
      float sky=exp(-abs(nl)/.18),night=1.-smoothstep(-.10,.12,nl);
      vec3 terrain=mineral*(.018+.31*diffuse+.021*sky);
      float regional=sqrt(clamp(meso*5.,0.,1.));
      // Earthshine is hemisphere-wide diffuse return, with no noise or artificial city texture.
      vec3 earthshine=vec3(.0100,.0140,.0200)*${f(p.earthshine)};
      terrain+=earthshine*(.28+.72*regional)*night*(.32+.68*smoothstep(-.7,.05,nl));
      vec3 water=vec3(.0007,.0018,.0039)*(.38+.70*max(nl,0.));
      vec3 H=normalize(V+L);float nh=max(dot(N,H),0.);
      float rough=.23+.08*sqrt(max(meso,0.)),a2=pow(rough,4.);
      float D=a2/(3.14159*pow(nh*nh*(a2-1.)+1.,2.));
      float F=.020+.98*pow(1.-max(dot(V,H),0.),5.);
      float raw=D*F/(4.*max(nv,.06));
      water+=vec3(.30,.42,.57)*(raw/(1.+raw/.16))*max(nl,0.);
      water+=vec3(.003,.007,.014)*pow(1.-nv,3.)*(.10+.90*max(nl,0.));
      water+=earthshine*.12*night;
      vec2 uv=vUv+vec2(uCloudOffset,0.)+cloudRayOffset(vSunLocal,.0046);
      vec3 weather=texture2D(uCloudMap,uv).rgb;
      float shadow=exp(-weatherTau(weather)*.45/max(nl,.22));
      float directVisibility=smoothstep(-.06,.20,nl);
      vec3 color=mix(water,terrain,land)*mix(1.,shadow,.32*directVisibility);
      // Blue optical path over the surface increases toward the limb, not across the page.
      float path=1.-exp(-.055/max(nv,.065));
      color=mix(color,vec3(.008,.021,.040)*max(nl+.12,0.),path*.40);
      if(uDisplayMode>1.5)color=vec3(.001,.002,.004);
      gl_FragColor=vec4(color,uOpacity);
    }`;
  if(kind==='city')return scale+/*glsl*/`
    uniform sampler2D uCityMap,uNormalMap,uCloudMap;uniform float uCloudOffset;
    void main(){
      vec3 tiers=texture2D(uCityMap,vUv).rgb;
      float land=smoothstep(.75,.98,texture2D(uNormalMap,vUv).a);
      float night=1.-smoothstep(-.16,.16,dot(normalize(vN),sun()));
      vec2 uv=vUv+vec2(uCloudOffset,0.)+cloudRayOffset(vCameraLocal-vLocal,.0040);
      float tau=weatherTau(texture2D(uCloudMap,uv).rgb);
      // Mip compensation only for genuine minification, capped at 14%, using existing regional channel.
      float energy=.16*pow(tiers.r,.85)+1.25*pow(tiers.g,.62)*(1.+.14*minification())+3.6*pow(tiers.b,.85);
      float transmission=exp(-tau/sqrt(max(facing(),.30)));
      vec3 tint=mix(vec3(1.,.77,.48),vec3(1.,.93,.80),clamp(tiers.g*1.5+tiers.b,0.,1.));
      gl_FragColor=vec4(tint*energy,land*night*transmission*smoothstep(.015,.12,facing())*uOpacity);
    }`;
  if(kind==='cloud')return scale+/*glsl*/`
    uniform sampler2D uCloudMap;
    void main(){
      vec3 d=texture2D(uCloudMap,vUv).rgb,N=normalize(vN);
      float nl=dot(N,sun()),f=facing(),tau=weatherTau(d),macro=.68*d.g+.32*d.b;
      // Adaptive geometric footprint, never negative LOD or unstable procedural noise.
      vec2 texel=vec2(1./4096.,1./2048.)*max(2.,footprint());
      float w=texture2D(uCloudMap,vUv-vec2(texel.x,0.)).g;
      float e=texture2D(uCloudMap,vUv+vec2(texel.x,0.)).g;
      float s=texture2D(uCloudMap,vUv-vec2(0.,texel.y)).g;
      float n=texture2D(uCloudMap,vUv+vec2(0.,texel.y)).g;
      vec2 slope=vec2(w-e,s-n)*5.;slope/=1.+length(slope)/.35;
      vec3 relief=tangentNormal(N,slope*${f(p.weatherRelief)});
      vec2 offset=cloudRayOffset(vSunLocal,.0024);
      float ahead=texture2D(uCloudMap,vUv+offset).g;
      float selfShadow=exp(-max(ahead-macro,0.)*2.0);
      float day=smoothstep(-.07,.10,nl),diffuse=max(dot(relief,sun()),0.);
      float edge=1.-smoothstep(.22,.64,macro),twilight=exp(-abs(nl)/.12);
      vec3 color=vec3(.52,.59,.68)*(.57*diffuse+.045*twilight)*day*selfShadow;
      color+=vec3(.014,.025,.042)*pow(1.-f,2.)*max(nl,0.)*edge;
      color+=vec3(.0060,.0080,.0120)*${f(p.earthshine)}*(1.-day)*(.32+.68*smoothstep(-.65,.05,nl));
      float alpha=1.-exp(-tau);
      gl_FragColor=vec4(color,alpha*uOpacity*smoothstep(.004,.04,f));
    }`;
  if(kind==='atmosphere')return /*glsl*/`
    vec2 sphere(vec3 ro,vec3 rd,float radius){float b=dot(ro,rd),d=b*b-dot(ro,ro)+radius*radius;if(d<0.)return vec2(1.,-1.);float s=sqrt(d);return vec2(-b-s,-b+s);}
    void main(){
      vec3 ro=vCameraLocal,rd=normalize(vLocal-ro),L=normalize(vSunLocal);
      vec2 air=sphere(ro,rd,1.89),ground=sphere(ro,rd,1.85);
      float enter=max(air.x,0.),leave=air.y;
      if(ground.x>0.&&ground.y>ground.x)leave=min(leave,ground.x);
      if(leave<=enter)discard;
      // Apparent thickness is a bounded pixel-footprint compensation, not a fixed Fresnel glow.
      float pixel=max(length(dFdx(vLocal)),length(dFdy(vLocal)));
      float height=${f(p.airHeight)}*(1.+.10*smoothstep(.003,.015,pixel));
      float mu=dot(rd,L),rayPhase=.75*(1.+mu*mu),miePhase=phaseHG(mu,${f(p.mie)});
      float optical=0.;vec3 sum=vec3(0.);vec3 beta=vec3(.40,.96,2.12);
      for(int i=0;i<${p.steps};i++){
        float t0=.5-.5*cos(3.141593*float(i)/${f(p.steps)}),t1=.5-.5*cos(3.141593*float(i+1)/${f(p.steps)});
        float ds=(leave-enter)*(t1-t0);
        vec3 point=ro+rd*(enter+(leave-enter)*(.5*(t0+t1)));
        float r=length(point),h=max(r-1.85,0.),sunCos=dot(point/r,L);
        float rho=exp(-h/height),aerosol=exp(-h/.0020);
        float horizon=-sqrt(max(0.,1.-pow(1.85/r,2.)));
        float lit=smoothstep(horizon-.035,horizon+.035,sunCos);
        float sunDepth=rho*height/max(sunCos-horizon+.06,.06);
        vec3 transmission=exp(-beta*(optical+sunDepth)*3.2);
        vec3 scatter=beta*rho*rayPhase+vec3(.54,.65,.78)*aerosol*miePhase*.25;
        float airglow=.22+.78*smoothstep(-.35,.05,sunCos);
        sum+=transmission*scatter*ds*(.003*airglow+lit*1.5);
        optical+=rho*ds;
      }
      gl_FragColor=vec4(sum,1.);
    }`;
  throw new Error('Unknown V1.3 Earth layer');
}
