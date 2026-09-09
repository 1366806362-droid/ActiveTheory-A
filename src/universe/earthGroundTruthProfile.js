// V1.3 is an independent opt-in; all old Earth URLs retain their prior behavior.
export const EARTH_V13_PHASES=Object.freeze([0,90,180,270]);
export const EARTH_V13_PROFILES=Object.freeze({
  A:Object.freeze({name:'Orbital Documentary',steps:8,earthshine:.80,weatherRelief:.14,airHeight:.0055,mie:.60,landTint:.42}),
  B:Object.freeze({name:'Cinematic Photoreal',steps:12,earthshine:1.0,weatherRelief:.20,airHeight:.0062,mie:.68,landTint:.30}),
  C:Object.freeze({name:'Deep Night Atmospheric',steps:16,earthshine:.85,weatherRelief:.12,airHeight:.0072,mie:.72,landTint:.20})
});
export function readEarthGroundTruth(search=typeof window==='undefined'?'':window.location.search){
  const q=new URLSearchParams(search);
  if(!['earthV13','earthOrbital','earthV2','earthV3'].every(k=>q.get(k)==='1'))return null;
  const candidate=Object.hasOwn(EARTH_V13_PROFILES,q.get('earthV13Candidate'))?q.get('earthV13Candidate'):'B';
  const phase=q.has('earthPhase')?Number(q.get('earthPhase')):0;
  const steps=Number(q.get('earthAirSteps'));
  return {...EARTH_V13_PROFILES[candidate],candidate,
    phaseDegrees:EARTH_V13_PHASES.includes(phase)?phase:0,
    steps:[8,12,16].includes(steps)?steps:EARTH_V13_PROFILES[candidate].steps,
    rotationPeriod:3600};
}
