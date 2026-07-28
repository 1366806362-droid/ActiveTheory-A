import * as THREE from 'three';
import { createGeoV4OrganicEnvironment } from './geoV4OrganicEnvironment.js';
import { createGeoV4BusinessTissue } from './geoV4BusinessTissue.js';
import { createGeoV4NeuralStreams } from './geoV4NeuralStreams.js';
import { createGeoV4SignalCore } from './geoV4SignalCore.js';

export function createGeoV4Visual(resources) {
  const group = new THREE.Group();
  const pointer = { x: 0, y: 0 };
  const environment = createGeoV4OrganicEnvironment(resources);
  const business = createGeoV4BusinessTissue(resources);
  const streams = createGeoV4NeuralStreams(resources);
  const core = createGeoV4SignalCore(resources);
  const debug = resolveV4Debug();

  group.name = 'GEO V4 Organic Neural Space';
  group.add(environment.group, business.group, streams.group, core.group);
  environment.setDebugLayer(debug.layer);
  business.setDebugRegion(debug.layer);
  streams.setDebugStream(debug.layer);
  core.setDebugLayer(debug.layer);
  business.setLabelsVisible(debug.layer !== 'organism');

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
    },
    dispose() {
      window.removeEventListener('pointermove', handlePointer);
      environment.dispose();
      business.dispose();
      streams.dispose();
      core.dispose();
      group.clear();
    },
    diagnostics: Object.freeze({
      version: 'v4.1.4-unified-organism',
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
      debugLayer: debug.layer
    })
  };
}

function resolveV4Debug() {
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('geoV4Layer');
  const allowed = new Set([
    'full',
    'environment',
    'rear',
    'mid',
    'foreground',
    'surface',
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
    'organism'
  ]);
  return Object.freeze({
    layer: allowed.has(requested) ? requested : 'full'
  });
}
