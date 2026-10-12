// Geometry helpers: GeoJSON in WGS84 -> batched Three.js meshes in a local frame.
// Frame: origin 80.49 E, 16.53 N; 1 scene unit = 10 m; +x east, -z north, +y up.
import * as THREE from '../../vendor/three.module.min.js';
import { mergeGeometries } from '../../vendor/BufferGeometryUtils.js';

export const LON0 = 80.49, LAT0 = 16.53, UNIT = 10;
const MX = 106740 / UNIT, MZ = 111320 / UNIT;
/** [lon, lat] -> {x: east, y: north} in scene units (2D, before the ground-plane rotation). */
export const project2 = ([lon, lat]) => ({ x: (lon - LON0) * MX, y: (lat - LAT0) * MZ });
export const toWorld = (lonlat, height = 0) => { const p = project2(lonlat); return new THREE.Vector3(p.x, height, -p.y); };

export function eachPolygon(geometry, fn) {
  if (!geometry) return;
  if (geometry.type === 'Polygon') fn(geometry.coordinates);
  else if (geometry.type === 'MultiPolygon') geometry.coordinates.forEach(fn);
}
export function eachLine(geometry, fn) {
  if (!geometry) return;
  if (geometry.type === 'LineString') fn(geometry.coordinates);
  else if (geometry.type === 'MultiLineString') geometry.coordinates.forEach(fn);
}

function shapeOf(polygon) {
  const rings = polygon.map((ring) => ring.map((c) => { const p = project2(c); return new THREE.Vector2(p.x, p.y); }));
  const shape = new THREE.Shape(rings[0]);
  for (const hole of rings.slice(1)) shape.holes.push(new THREE.Path(hole));
  return shape;
}

/** Flat, upward-facing geometry for one polygon at height y. */
export function flatPolygon(polygon, y = 0) {
  const geometry = new THREE.ShapeGeometry(shapeOf(polygon), 1);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, y, 0);
  return geometry;
}

/**
 * Merge every polygon of every feature into one geometry. Returns {geometry, ranges} where
 * ranges maps triangle index ranges back to features (used for picking).
 */
export function mergedPolygons(features, y = 0) {
  const parts = [], ranges = [];
  let triangles = 0;
  features.forEach((feature, index) => eachPolygon(feature.geometry, (polygon) => {
    if (!polygon[0] || polygon[0].length < 4) return;
    const g = flatPolygon(polygon, y).toNonIndexed();
    const count = g.attributes.position.count / 3;
    ranges.push({ start: triangles, end: triangles + count, index });
    triangles += count;
    parts.push(g);
  }));
  if (!parts.length) return null;
  const geometry = mergeGeometries(parts, false);
  parts.forEach((g) => g.dispose());
  return { geometry, ranges };
}

export function featureAtFace(ranges, faceIndex) {
  let lo = 0, hi = ranges.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (faceIndex < ranges[mid].start) hi = mid - 1;
    else if (faceIndex >= ranges[mid].end) lo = mid + 1;
    else return ranges[mid].index;
  }
  return -1;
}

/** One LineSegments object for all polygon rings (outlines). */
export function outlines(features, y, material) {
  const points = [];
  features.forEach((f) => eachPolygon(f.geometry, (polygon) => polygon.forEach((ring) => {
    for (let i = 1; i < ring.length; i++) {
      const a = project2(ring[i - 1]), b = project2(ring[i]);
      points.push(a.x, y, -a.y, b.x, y, -b.y);
    }
  })));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  return new THREE.LineSegments(geometry, material);
}

/** Ribbons for line features; width(feature) in metres. Flat quads per segment, merged. */
export function ribbons(features, y, widthOf) {
  const position = [], normal = [];
  for (const feature of features) {
    const half = widthOf(feature) / UNIT / 2;
    if (!half) continue;
    eachLine(feature.geometry, (line) => {
      for (let i = 1; i < line.length; i++) {
        const a = project2(line[i - 1]), b = project2(line[i]);
        const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
        if (length < 1e-3) continue;
        // Extend each quad by half a width so consecutive segments overlap at joins.
        const ux = dx / length, uy = dy / length, nx = -uy * half, ny = ux * half, ex = ux * half, ey = uy * half;
        const p1 = [a.x - ex + nx, a.y - ey + ny], p2 = [a.x - ex - nx, a.y - ey - ny], p3 = [b.x + ex - nx, b.y + ey - ny], p4 = [b.x + ex + nx, b.y + ey + ny];
        for (const [px, py] of [p1, p2, p3, p1, p3, p4]) { position.push(px, y, -py); normal.push(0, 1, 0); }
      }
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normal, 3));
  return geometry;
}

/** Scene-space bounds {minX, maxX, minZ, maxZ, centre: Vector3, size} for a feature list. */
export function bounds(features) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  const visit = (c) => { const p = project2(c); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, -p.y); maxZ = Math.max(maxZ, -p.y); };
  const walk = (coords) => (typeof coords[0] === 'number' ? visit(coords) : coords.forEach(walk));
  features.forEach((f) => f.geometry && walk(f.geometry.coordinates));
  return { minX, maxX, minZ, maxZ, centre: new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2), size: Math.max(maxX - minX, maxZ - minZ) };
}

/** A representative on-geometry point: the middle vertex of the longest line, or a polygon's bbox centre. */
export function anchorPoint(features) {
  let best = null, bestLength = -1;
  for (const f of features) eachLine(f.geometry, (line) => { if (line.length > bestLength) { bestLength = line.length; best = line[Math.floor(line.length / 2)]; } });
  return best ? toWorld(best) : bounds(features).centre;
}

export function material(color, extra = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0.02, ...extra });
}

/** Deterministic pseudo-random generator so artistic placement is stable between visits. */
export function seeded(seed = 101) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export function pointInRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
