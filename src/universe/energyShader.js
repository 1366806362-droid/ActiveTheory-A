import * as THREE from 'three';

const energyUniforms = {
  uTime: { value: 0 },
  uFresnelColor: { value: new THREE.Color(0x00d5ff) },
  uFresnelStrength: { value: 0.42 },
  uFlowColor: { value: new THREE.Color(0x1c7dff) },
  uFlowStrength: { value: 0.12 },
  uPulse: { value: 0 },
  uInteraction: { value: 0 },
  shaderTime: 0,
  lastTime: null
};

export function applyEnergyShader(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = energyUniforms.uTime;
    shader.uniforms.uFresnelColor = energyUniforms.uFresnelColor;
    shader.uniforms.uFresnelStrength = energyUniforms.uFresnelStrength;
    shader.uniforms.uFlowColor = energyUniforms.uFlowColor;
    shader.uniforms.uFlowStrength = energyUniforms.uFlowStrength;
    shader.uniforms.uPulse = energyUniforms.uPulse;
    shader.uniforms.uInteraction = energyUniforms.uInteraction;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
#include <common>
varying vec3 vEnergyPosition;
        `
      )
      .replace(
        '#include <begin_vertex>',
        `
#include <begin_vertex>
vEnergyPosition = transformed;
        `
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `
#include <common>
uniform float uTime;
uniform vec3 uFresnelColor;
uniform float uFresnelStrength;
uniform vec3 uFlowColor;
uniform float uFlowStrength;
uniform float uPulse;
uniform float uInteraction;
varying vec3 vEnergyPosition;
        `
      )
      .replace(
        'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        `
vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
float energyView = 1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0);
float energyFresnel = pow(energyView, 2.85);
float energyNoise = sin(vEnergyPosition.x * 17.0 + uTime * 0.33) * sin(vEnergyPosition.y * 13.0 - uTime * 0.27);
float energyBandA = sin(vEnergyPosition.y * 18.0 + vEnergyPosition.x * 5.0 + uTime * 0.84);
float energyBandB = sin(length(vEnergyPosition.xz) * 13.0 - uTime * 0.52);
float energyBandC = sin((vEnergyPosition.x + vEnergyPosition.y - vEnergyPosition.z) * 9.0 + uTime * 1.18);
float energyBandD = sin(length(vEnergyPosition.xy) * 19.0 - uTime * 0.76 + vEnergyPosition.z * 4.0);
float energyFlow = smoothstep(0.54, 1.0, energyBandA * 0.4 + energyBandB * 0.28 + energyBandC * 0.18 + energyBandD * 0.12 + energyNoise * 0.12);
float energyVein = smoothstep(0.79, 1.0, energyBandA * energyBandB * 0.46 + energyBandC * 0.3 + energyBandD * 0.2 + uPulse * 0.18);
float whiteSpark = smoothstep(0.972, 1.0, sin(vEnergyPosition.x * 31.0 + uTime * 1.7) * sin(vEnergyPosition.y * 23.0 - uTime * 1.2));
float energyCoreDepth = smoothstep(0.15, 0.85, length(vEnergyPosition));
float inwardGlow = pow(max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 3.2);
float centerEnergy = pow(max(1.0 - length(vEnergyPosition) * 0.92, 0.0), 2.4);
float localHighlight = smoothstep(0.78, 1.0, sin(vEnergyPosition.x * 8.0 + uTime * 0.42) + sin(vEnergyPosition.z * 11.0 - uTime * 0.38));
outgoingLight += uFresnelColor * energyFresnel * (uFresnelStrength + uPulse * 0.2 + uInteraction * 0.32);
outgoingLight += uFlowColor * inwardGlow * (0.1 + uPulse * 0.05 + uInteraction * 0.04);
outgoingLight += uFlowColor * centerEnergy * (0.18 + uPulse * 0.08 + uInteraction * 0.04);
outgoingLight += uFlowColor * energyFlow * (uFlowStrength + uInteraction * 0.07) * (0.72 + energyCoreDepth * 0.32);
outgoingLight += vec3(0.35, 0.95, 1.0) * energyVein * (0.03 + uPulse * 0.026 + uInteraction * 0.016);
outgoingLight += vec3(0.7, 0.98, 1.0) * localHighlight * energyFresnel * 0.025;
outgoingLight += vec3(0.9, 0.98, 1.0) * whiteSpark * (0.012 + uInteraction * 0.008);
        `
      );
  };

  material.customProgramCacheKey = () => 'active-theory-energy-core-v1';
  material.needsUpdate = true;

  return material;
}

export function updateEnergyShader(time, interaction = {}) {
  const proximity = interaction.proximity ?? 0;
  const flowSpeed = 1 + proximity * 0.55;
  const delta = energyUniforms.lastTime === null ? 0 : Math.max(time - energyUniforms.lastTime, 0);

  energyUniforms.lastTime = time;
  energyUniforms.shaderTime += delta * flowSpeed;
  energyUniforms.uTime.value = energyUniforms.shaderTime;
  energyUniforms.uPulse.value = 0.5 + Math.sin(time * (0.72 + proximity * 0.18)) * 0.5;
  energyUniforms.uFresnelStrength.value = 0.42 + energyUniforms.uPulse.value * 0.15 + proximity * 0.18;
  energyUniforms.uFlowStrength.value = 0.11 + Math.sin(time * 0.38) * 0.03 + proximity * 0.07;
  energyUniforms.uInteraction.value = proximity;
}

export const energyShaderManager = {
  applyEnergyShader,
  updateEnergyShader
};
