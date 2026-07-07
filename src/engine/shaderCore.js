import * as THREE from 'three';

const shaderCoreUniforms = {
  uTime: { value: 0 },
  uFresnelColor: { value: new THREE.Color(0x00ccff) },
  uFresnelStrength: { value: 0.34 },
  uFlowColor: { value: new THREE.Color(0x0077cc) },
  uFlowStrength: { value: 0.1 }
};

export function applyShaderCore(material) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderCoreUniforms.uTime;
    shader.uniforms.uFresnelColor = shaderCoreUniforms.uFresnelColor;
    shader.uniforms.uFresnelStrength = shaderCoreUniforms.uFresnelStrength;
    shader.uniforms.uFlowColor = shaderCoreUniforms.uFlowColor;
    shader.uniforms.uFlowStrength = shaderCoreUniforms.uFlowStrength;

    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `
#include <common>
varying vec3 vShaderCorePosition;
        `
      )
      .replace(
        '#include <begin_vertex>',
        `
#include <begin_vertex>
vShaderCorePosition = transformed;
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
varying vec3 vShaderCorePosition;
        `
      )
      .replace(
        'vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;',
        `
vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
float shaderCoreFresnel = pow(1.0 - max(dot(normalize(normal), normalize(vViewPosition)), 0.0), 2.65);
float shaderCoreWaveA = sin(vShaderCorePosition.y * 10.0 + vShaderCorePosition.x * 3.5 + uTime * 0.75);
float shaderCoreWaveB = sin((vShaderCorePosition.z + vShaderCorePosition.x) * 7.0 - uTime * 0.42);
float shaderCoreFlow = smoothstep(0.78, 1.0, shaderCoreWaveA * 0.7 + shaderCoreWaveB * 0.3);
vec3 shaderCoreEnergy = uFresnelColor * shaderCoreFresnel * uFresnelStrength;
shaderCoreEnergy += uFlowColor * shaderCoreFlow * uFlowStrength;
outgoingLight += shaderCoreEnergy;
        `
      );
  };

  material.customProgramCacheKey = () => 'active-theory-shader-core-v1';
  material.needsUpdate = true;

  return material;
}

export function updateShaderCore(renderState, delta, time) {
  shaderCoreUniforms.uTime.value = time;
}

export const shaderCoreManager = {
  applyShaderCore,
  updateShaderCore
};
