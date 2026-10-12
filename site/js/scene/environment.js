// Sky, sunlight, image-based lighting and atmosphere. Procedural; no imagery is used.
import * as THREE from '../../vendor/three.module.min.js';
import { Sky } from '../../vendor/Sky.js';

// Late-afternoon sun from the west-south-west, as in the design brief's warm early-evening light.
const SUN_ELEVATION = 16, SUN_AZIMUTH = 245;
export const HAZE = 0xc8bda2;

export function createEnvironment(renderer, scene, quality) {
  const sky = new Sky();
  sky.scale.setScalar(20000);
  const u = sky.material.uniforms;
  u.turbidity.value = 7.5;
  u.rayleigh.value = 1.6;
  u.mieCoefficient.value = 0.006;
  u.mieDirectionalG.value = 0.82;
  const sunDirection = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - SUN_ELEVATION), THREE.MathUtils.degToRad(SUN_AZIMUTH));
  u.sunPosition.value.copy(sunDirection);

  // Bake the sky into an environment map for physically based reflections (glass, water).
  const pmrem = new THREE.PMREMGenerator(renderer);
  const skyScene = new THREE.Scene();
  skyScene.add(sky.clone());
  const envTarget = pmrem.fromScene(skyScene, 0, 0.1, 30000);
  scene.environment = envTarget.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
  scene.add(sky);
  scene.fog = new THREE.FogExp2(HAZE, 0.00042);

  const sun = new THREE.DirectionalLight(0xffdcae, 3.1);
  sun.position.copy(sunDirection).multiplyScalar(900);
  sun.target.position.set(0, 0, 0);
  scene.add(sun, sun.target);
  const hemi = new THREE.HemisphereLight(0xdfe8f0, 0x4a4a32, 0.55);
  scene.add(hemi);

  function setShadows(size) {
    sun.castShadow = size > 0;
    if (!size) return;
    sun.shadow.mapSize.set(size, size);
    const s = sun.shadow.camera;
    s.left = -520; s.right = 520; s.top = 520; s.bottom = -520; s.near = 10; s.far = 2200;
    sun.shadow.normalBias = 0.6;
    sun.shadow.bias = -0.0004;
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    s.updateProjectionMatrix();
  }
  setShadows(quality.shadows);
  /** Keep the shadow frustum centred on what the camera is looking at. */
  function followTarget(target) {
    sun.target.position.set(target.x, 0, target.z);
    sun.position.copy(sunDirection).multiplyScalar(900).add(sun.target.position);
  }
  return { sun, setShadows, followTarget };
}

/** Tileable value-noise canvas, used for ground grain and water ripples. */
function noiseCanvas(size, octaves, seed) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(size, size);
  let s = seed;
  const rand = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const field = new Float32Array(size * size);
  for (let o = 0; o < octaves; o++) {
    const cells = 4 << o, grid = Array.from({ length: cells * cells }, rand), amp = 1 / (1 << o);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const gx = (x / size) * cells, gy = (y / size) * cells, x0 = Math.floor(gx), y0 = Math.floor(gy);
      const fx = gx - x0, fy = gy - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      const at = (i, j) => grid[((j % cells) * cells) + (i % cells)];
      const top = at(x0, y0) * (1 - sx) + at(x0 + 1, y0) * sx, bottom = at(x0, y0 + 1) * (1 - sx) + at(x0 + 1, y0 + 1) * sx;
      field[y * size + x] += (top * (1 - sy) + bottom * sy) * amp;
    }
  }
  return { canvas, ctx, image, field };
}

export function groundTexture() {
  const size = 256, { canvas, ctx, image, field } = noiseCanvas(size, 5, 7);
  for (let i = 0; i < field.length; i++) {
    const v = 0.82 + (field[i] / 1.94) * 0.3;
    image.data.set([Math.min(255, 255 * v), Math.min(255, 255 * v), Math.min(255, 255 * v * 0.97), 255], i * 4);
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Normal map derived from a noise height field; scrolled each frame to animate the river surface. */
export function waterNormals() {
  const size = 256, { canvas, ctx, image, field } = noiseCanvas(size, 4, 23);
  const at = (x, y) => field[((y + size) % size) * size + ((x + size) % size)];
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * 2.2, dy = (at(x, y + 1) - at(x, y - 1)) * 2.2;
    const len = Math.hypot(dx, dy, 1);
    image.data.set([(-dx / len * 0.5 + 0.5) * 255, (-dy / len * 0.5 + 0.5) * 255, (1 / len * 0.5 + 0.5) * 255, 255], (y * size + x) * 4);
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(60, 60);
  return texture;
}
