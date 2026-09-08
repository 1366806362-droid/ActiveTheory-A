import { Vector2, Vector3 } from 'three';

// Only the repaired candidate opts in. This attenuates high-pass eligibility,
// not the source image, base render, exposure, or global bloom settings.
export function createM3BloomCalibration(bloomPass, scene, camera) {
  const material = bloomPass.materialHighPassFilter;
  const original = material.fragmentShader;
  const uniforms = {
    m3CoreCenter: { value: new Vector2() },
    m3CoreRadius: { value: new Vector2(1, 1) },
    m3CoreRetention: { value: 1 },
    m3CoreEnabled: { value: 0 }
  };
  const center = new Vector3();
  const edgeX = new Vector3();
  const edgeY = new Vector3();
  let owner = null;
  let installed = false;
  let searched = false;

  function update() {
    // Universe construction is complete before the first render. Do not scan
    // a legacy scene graph every frame when no opt-in M3 owner exists.
    if (!searched) {
      owner = scene.getObjectByName('GalaxyV3HeroAssetV4LDI');
      searched = true;
    }
    const config = owner?.userData.coreBloomCalibration;
    if (!config) return;
    if (!installed) {
      const anchor = 'gl_FragColor = mix( outputColor, texel, alpha );';
      if (!original.includes(anchor)) throw new Error('M3 bloom shader contract changed');
      material.fragmentShader = `uniform vec2 m3CoreCenter;
uniform vec2 m3CoreRadius;
uniform float m3CoreRetention;
uniform float m3CoreEnabled;
${original}`.replace(anchor, `
        vec2 coreDistance = (vUv - m3CoreCenter) / m3CoreRadius;
        float coreMask = 1.0 - smoothstep(0.30, 1.0, length(coreDistance));
        alpha *= mix(1.0, m3CoreRetention, coreMask * m3CoreEnabled);
        ${anchor}`);
      Object.assign(material.uniforms, uniforms);
      material.needsUpdate = true;
      installed = true;
    }
    let visible = true;
    for (let object = owner; object; object = object.parent) visible &&= object.visible;
    uniforms.m3CoreEnabled.value = visible ? 1 : 0;
    if (!visible) return;
    owner.updateWorldMatrix(true, false);
    const x = (config.uv[0] - 0.5) * 16 / 9;
    const y = config.uv[1] - 0.5;
    center.set(x, y, 0);
    edgeX.set(x + config.radius[0] * 16 / 9, y, 0);
    edgeY.set(x, y + config.radius[1], 0);
    for (const point of [center, edgeX, edgeY]) owner.localToWorld(point).project(camera);
    uniforms.m3CoreCenter.value.set(center.x * .5 + .5, center.y * .5 + .5);
    uniforms.m3CoreRadius.value.set(Math.max(center.distanceTo(edgeX) * .5, .0001), Math.max(center.distanceTo(edgeY) * .5, .0001));
    uniforms.m3CoreRetention.value = config.retention;
  }

  function dispose() {
    if (!installed) return;
    material.fragmentShader = original;
    for (const key of Object.keys(uniforms)) delete material.uniforms[key];
    material.needsUpdate = true;
  }
  return { update, dispose };
}
