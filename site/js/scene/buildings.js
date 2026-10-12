// OSM building footprints from site/data/buildings.bin (format in scripts/fetch_osm.py).
// Height: OSM `height` tag, else `building:levels` x 3.2 m, else an assumed single storey.
import * as THREE from '../../vendor/three.module.min.js';
import { UNIT } from './build.js';

const STOREY = 3.2, DEFAULT_HEIGHT = 3.4, CHUNK = 6000;
const PLASTER = [0xd9cdb6, 0xcfc1a5, 0xe3dac7, 0xc5b59c, 0xdac8ad, 0xbfb5a3, 0xd4c4b4, 0xcbbfa9].map((c) => new THREE.Color(c));

export function decodeBuildings(buffer) {
  const view = new DataView(buffer);
  if (String.fromCharCode(...new Uint8Array(buffer, 0, 4)) !== 'AOB1') throw new Error('Unknown building format');
  const count = view.getUint32(4, true);
  const buildings = new Array(count);
  let offset = 8, levels = 0, heights = 0;
  for (let i = 0; i < count; i++) {
    const n = view.getUint8(offset), lv = view.getUint8(offset + 1), dm = view.getUint16(offset + 2, true);
    offset += 4;
    const ring = new Float32Array(n * 2);
    for (let j = 0; j < n * 2; j += 2) {
      ring[j] = view.getInt16(offset, true) / 2 / UNIT; // east, scene units
      ring[j + 1] = -view.getInt16(offset + 2, true) / 2 / UNIT; // north -> -z
      offset += 4;
    }
    const height = dm ? dm / 10 : lv ? lv * STOREY : DEFAULT_HEIGHT;
    levels += lv > 0; heights += dm > 0;
    buildings[i] = { ring, height: height / UNIT, measured: Boolean(dm || lv) };
  }
  return { buildings, stats: { count, withLevels: levels, withHeight: heights } };
}

function chunkGeometry(list) {
  let vertices = 0;
  for (const b of list) { const n = b.ring.length / 2; vertices += n * 6 + (n - 2) * 3; }
  const position = new Float32Array(vertices * 3), normal = new Float32Array(vertices * 3), color = new Float32Array(vertices * 3);
  let v = 0;
  const shade = new THREE.Color();
  const push = (x, y, z, nx, ny, nz, c, k) => {
    position[v * 3] = x; position[v * 3 + 1] = y; position[v * 3 + 2] = z;
    normal[v * 3] = nx; normal[v * 3 + 1] = ny; normal[v * 3 + 2] = nz;
    color[v * 3] = c.r * k; color[v * 3 + 1] = c.g * k; color[v * 3 + 2] = c.b * k;
    v++;
  };
  for (const [index, b] of list.entries()) {
    const r = b.ring, n = r.length / 2, h = b.height;
    shade.copy(PLASTER[(index * 2654435761 >>> 0) % PLASTER.length]);
    let area = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += r[i * 2] * r[j * 2 + 1] - r[j * 2] * r[i * 2 + 1]; }
    const sign = area > 0 ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      // The quad's front face is (-dz, dx) for edge a->b; swap ends on rings where that faces inward.
      const [ia, ib] = sign > 0 ? [j, i] : [i, j];
      const ax = r[ia * 2], az = r[ia * 2 + 1], bx = r[ib * 2], bz = r[ib * 2 + 1];
      let nx = -(bz - az), nz = bx - ax;
      const len = Math.hypot(nx, nz) || 1; nx /= len; nz /= len;
      // Darker wall bases fake ambient occlusion where buildings meet the ground.
      push(ax, 0, az, nx, 0, nz, shade, 0.62); push(bx, 0, bz, nx, 0, nz, shade, 0.62); push(bx, h, bz, nx, 0, nz, shade, 0.94);
      push(ax, 0, az, nx, 0, nz, shade, 0.62); push(bx, h, bz, nx, 0, nz, shade, 0.94); push(ax, h, az, nx, 0, nz, shade, 0.94);
    }
    const contour = [];
    for (let i = 0; i < n; i++) contour.push(new THREE.Vector2(r[i * 2], r[i * 2 + 1]));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []);
    for (const [a, b2, c] of triangles) {
      // Face +y needs a negative x-z cross product; order each triangle explicitly.
      const cross = (r[b2 * 2] - r[a * 2]) * (r[c * 2 + 1] - r[a * 2 + 1]) - (r[b2 * 2 + 1] - r[a * 2 + 1]) * (r[c * 2] - r[a * 2]);
      for (const k of cross < 0 ? [a, b2, c] : [a, c, b2]) push(r[k * 2], h, r[k * 2 + 1], 0, 1, 0, shade, 1.04);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(position.subarray(0, v * 3), 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normal.subarray(0, v * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(color.subarray(0, v * 3), 3));
  geometry.computeBoundingSphere();
  return geometry;
}

/** Build meshes chunk by chunk between frames so the page stays responsive. */
export async function buildBuildings(group, decoded, { castShadow }) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  // Sort spatially (coarse grid) so each chunk is compact and frustum culling works.
  const list = [...decoded.buildings].sort((a, b) => (Math.floor(a.ring[1] / 120) - Math.floor(b.ring[1] / 120)) || (a.ring[0] - b.ring[0]));
  for (let start = 0; start < list.length; start += CHUNK) {
    const mesh = new THREE.Mesh(chunkGeometry(list.slice(start, start + CHUNK)), mat);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    group.add(mesh);
    await new Promise((resolve) => (window.requestIdleCallback ? requestIdleCallback(resolve, { timeout: 120 }) : setTimeout(resolve, 16)));
  }
  return mat;
}
