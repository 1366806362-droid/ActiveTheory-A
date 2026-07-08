import * as THREE from 'three';

const energyUniforms = {
  uTime: { value: 0 },
  uFresnelColor: { value: new THREE.Color(0x00d5ff) },
  uFresnelStrength: { value: 0.42 },
  uFlowColor: { value: new THREE.Color(0x1c7dff) },
  uFlowStrength: { value: 0.12 },
  uPulse: { value: 0 },
  uInteraction: { value: 0 }
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
float energyFlow = smoothstep(0.7, 1.0, energyBandA * 0.5 + energyBandB * 0.34 + energyNoise * 0.16);
float energyCoreDepth = smoothstep(0.15, 0.85, length(vEnergyPosition));
outgoingLight += uFresnelColor * energyFresnel * (uFresnelStrength + uPulse * 0.12 + uInteraction * 0.16);
outgoingLight += uFlowColor * energyFlow * (uFlowStrength + uInteraction * 0.035) * (0.75 + energyCoreDepth * 0.35);
        `
      );
  };

  material.customProgramCacheKey = () => 'active-theory-energy-core-v1';
  material.needsUpdate = true;

  return material;
}

export function updateEnergyShader(time, interactionStrength = 0) {
  energyUniforms.uTime.value = time;
  energyUniforms.uPulse.value = 0.5 + Math.sin(time * 0.72) * 0.5;
  energyUniforms.uFresnelStrength.value = 0.36 + energyUniforms.uPulse.value * 0.1;
  energyUniforms.uFlowStrength.value = 0.1 + Math.sin(time * 0.43) * 0.025;
  energyUniforms.uInteraction.value = interactionStrength;
}

export const energyShaderManager = {
  applyEnergyShader,
  updateEnergyShader
};
