import * as THREE from 'three';

const POSITION_CONTROL_POINTS = Object.freeze([
  Object.freeze([-4.8, 1.6, 28]),
  Object.freeze([-4.15, 1.38, 20]),
  Object.freeze([-2.9, 1.02, 11]),
  Object.freeze([-1.15, 1.55, 0]),
  Object.freeze([1.15, 2.55, -14]),
  Object.freeze([4.15, 3.35, -29]),
  Object.freeze([8.4, 4.0, -48])
]);

const LOOK_AT_CONTROL_POINTS = Object.freeze([
  Object.freeze([-12, 2.7, -88]),
  Object.freeze([-9.5, 2.9, -93]),
  Object.freeze([-4.5, 3.25, -98]),
  Object.freeze([2.5, 4.0, -104]),
  Object.freeze([9.5, 4.8, -110]),
  Object.freeze([17, 5.8, -117]),
  Object.freeze([24, 7.2, -124])
]);

export function createHeroCinematicCamera({ aspect = 1 } = {}) {
  const camera = new THREE.PerspectiveCamera(49.5, aspect, 0.1, 420);
  const cameraPositionPath = createPath(POSITION_CONTROL_POINTS);
  const cameraLookAtPath = createPath(LOOK_AT_CONTROL_POINTS);
  const cameraPosition = new THREE.Vector3();
  const cameraTarget = new THREE.Vector3();

  camera.up.set(0, 1, 0);

  function update(progress, fov = 49.5) {
    const normalized = THREE.MathUtils.clamp(progress, 0, 1);
    cameraPositionPath.getPointAt(normalized, cameraPosition);
    cameraLookAtPath.getPointAt(normalized, cameraTarget);
    camera.position.copy(cameraPosition);
    camera.fov = fov;
    camera.updateProjectionMatrix();
    camera.lookAt(cameraTarget);

    return getState();
  }

  function resize(aspect) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  function getState() {
    return {
      position: cameraPosition.toArray(),
      target: cameraTarget.toArray(),
      fov: camera.fov
    };
  }

  update(0, 49.5);

  return Object.freeze({
    camera,
    cameraPositionPath,
    cameraLookAtPath,
    positionControlPoints: POSITION_CONTROL_POINTS,
    lookAtControlPoints: LOOK_AT_CONTROL_POINTS,
    update,
    resize,
    getState
  });
}

function createPath(points) {
  return new THREE.CatmullRomCurve3(
    points.map((point) => new THREE.Vector3(...point)),
    false,
    'centripetal',
    0.3
  );
}
