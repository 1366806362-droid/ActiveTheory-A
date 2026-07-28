import * as THREE from 'three';
import { createGeoV4OrganicEnvironment } from './geoV4OrganicEnvironment.js';
import { createGeoV4BusinessTissue } from './geoV4BusinessTissue.js';
import { createGeoV4NeuralStreams } from './geoV4NeuralStreams.js';
import { createGeoV4SignalCore } from './geoV4SignalCore.js';
import { createGeoV4SharedTissueField } from './geoV4SharedTissueField.js';
import { createGeoV4HybridMembrane } from './geoV4HybridMembrane.js';

export function createGeoV4Visual(resources) {
  const group = new THREE.Group();
  const pointer = { x: 0, y: 0 };
  const sharedField = createGeoV4SharedTissueField();
  const debug = resolveV4Debug();
  const hybridEnabled = debug.membrane === 'hybrid';
  const environment = hybridEnabled
    ? createGeoV4HybridMembrane(resources, sharedField)
    : createGeoV4OrganicEnvironment(resources, sharedField);
  const business = createGeoV4BusinessTissue(resources, sharedField);
  const streams = createGeoV4NeuralStreams(resources, sharedField);
  const core = createGeoV4SignalCore(resources);
  let hybridResourcesApplied = false;

  group.name = hybridEnabled
    ? 'GEO V4 Hybrid Organic Neural Space'
    : 'GEO V4 Organic Neural Space';
  group.add(environment.group, business.group, streams.group, core.group);
  environment.setDebugLayer(debug.layer);
  business.setDebugRegion(debug.layer);
  streams.setDebugStream(debug.layer);
  core.setDebugLayer(debug.layer);
  business.setLabelsVisible(
    debug.layer !== 'organism'
      && debug.layer !== 'field'
      && debug.layer !== 'membrane'
  );

  const handlePointer = (event) => {
    pointer.x = event.clientX / Math.max(window.innerWidth, 1) * 2 - 1;
    pointer.y = event.clientY / Math.max(window.innerHeight, 1) * 2 - 1;
  };
  window.addEventListener('pointermove', handlePointer, { passive: true });

  return {
    group,
    particleCount: environment.particleCount
      + business.particleCount
      + streams.particleCount
      + core.particleCount,
    update(time, reveal = 1) {
      environment.update(time, reveal, pointer);
      business.update(time, reveal, pointer);
      streams.update(time, reveal, pointer);
      core.update(time, reveal, pointer);
      if (hybridEnabled && window.__GEO_V4_STATUS__) {
        Object.assign(window.__GEO_V4_STATUS__, environment.diagnostics);
        if (
          environment.diagnostics.hybridAssetLoaded
          && !hybridResourcesApplied
          && window.__GEO_V4_STATUS__.resources
        ) {
          const hybridGeometryCount = environment.diagnostics.hybridGeometryCount;
          const hybridMaterialCount = environment.diagnostics.hybridMaterialCount;
          window.__GEO_V4_STATUS__.resources.geometryCount += hybridGeometryCount;
          window.__GEO_V4_STATUS__.resources.materialCount += hybridMaterialCount;
          window.__GEO_V4_STATUS__.resources.objectCount += hybridGeometryCount;
          hybridResourcesApplied = true;
        }
      }
    },
    dispose() {
      window.removeEventListener('pointermove', handlePointer);
      environment.dispose();
      business.dispose();
      streams.dispose();
      core.dispose();
      sharedField.dispose();
      group.clear();
    },
    diagnostics: Object.freeze({
      version: hybridEnabled
        ? 'v4.1.8-hybrid-organic-membrane'
        : 'v4.1.7-volumetric-cellular-membrane',
      membraneMode: hybridEnabled ? 'hybrid' : 'procedural',
      sharedFieldInstances: 1,
      environmentInstances: 1,
      businessTissueInstances: 1,
      streamInstances: 1,
      coreInstances: 1,
      particleCount: environment.particleCount
        + business.particleCount
        + streams.particleCount
        + core.particleCount,
      membraneSegments: environment.segmentCount,
      foregroundParticles: environment.foregroundParticleCount,
      debugLayer: debug.layer,
      ...(hybridEnabled ? environment.diagnostics : {})
    })
  };
}

function resolveV4Debug() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('geoV4Layer');
  const membrane = params.get('geoV4Membrane') === 'hybrid'
    ? 'hybrid'
    : 'procedural';
  const allowed = new Set([
    'full',
    'environment',
    'rear',
    'mid',
    'foreground',
    'surface',
    'membrane',
    'cells',
    'fibers',
    'cavity',
    'core',
    'chamber',
    'bands',
    'seed',
    'answer',
    'citation',
    'keyword',
    'fields',
    'streams',
    'tissue',
    'organism',
    'field'
  ]);
  return Object.freeze({
    layer: allowed.has(requested) ? requested : 'full',
    membrane
  });
}
