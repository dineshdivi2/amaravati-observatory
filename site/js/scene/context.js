// Mapped context: OSM land use, river, existing roads and rail; APCRDA planned networks.
import * as THREE from '../../vendor/three.module.min.js';
import { mergedPolygons, outlines, ribbons, material, seeded, eachPolygon, project2, pointInRing } from './build.js';
import { groundTexture, waterNormals } from './environment.js';

// Land-use colours are a dry-season reading of the delta landscape. Artistic, not classified imagery.
const LANDUSE = {
  farmland: 0x8b8a57, meadow: 0x7f8e52, grass: 0x7f8e52, village_green: 0x7f8e52, grassland: 0x86904f, greenfield: 0x8a8a5a,
  orchard: 0x5f7a40, plantation: 0x58723c, forest: 0x3e5a35, wood: 0x3e5a35, scrub: 0x77744a, heath: 0x77744a, wetland: 0x5c705c,
  residential: 0xa79a83, commercial: 0xa89b8b, retail: 0xa89b8b, institutional: 0xa39883, education: 0xa39883, religious: 0xa39883,
  industrial: 0x8d8b86, construction: 0x9b7150, brownfield: 0x957a5c, quarry: 0x9b9081, cemetery: 0x6c7a56, sand: 0xcab991,
};
const ROAD_WIDTH = { motorway: 16, trunk: 14, primary: 11, secondary: 9, tertiary: 7, unclassified: 5, residential: 4.5, rail: 3.5 };

export function buildGround(scene) {
  const texture = groundTexture();
  texture.repeat.set(220, 220);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), material(0x87845a, { map: texture }));
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  scene.add(ground);
  return ground;
}

function layered(color, order, extra = {}) {
  // Coplanar layers are separated with polygon offset rather than visible height steps.
  return material(color, { polygonOffset: true, polygonOffsetFactor: -order, polygonOffsetUnits: -order * 2, ...extra });
}

export function buildLanduse(group, landuse) {
  const byKind = new Map();
  for (const f of landuse.features) {
    const kind = f.properties.kind;
    if (!LANDUSE[kind]) continue;
    (byKind.get(kind) || byKind.set(kind, []).get(kind)).push(f);
  }
  const order = ['farmland', 'meadow', 'grass', 'grassland', 'greenfield', 'village_green', 'scrub', 'heath', 'wetland', 'sand', 'orchard', 'plantation', 'forest', 'wood', 'cemetery', 'quarry', 'brownfield', 'residential', 'institutional', 'education', 'religious', 'commercial', 'retail', 'industrial', 'construction'];
  for (const kind of order) {
    const features = byKind.get(kind);
    if (!features) continue;
    const merged = mergedPolygons(features, 0);
    if (!merged) continue;
    const texture = groundTexture();
    texture.repeat.set(1 / 30, 1 / 30); // ShapeGeometry UVs are in scene units
    const mesh = new THREE.Mesh(merged.geometry, layered(LANDUSE[kind], 1 + order.indexOf(kind) / 6, { map: texture }));
    mesh.receiveShadow = true;
    mesh.userData.kind = kind;
    group.add(mesh);
  }
  return byKind;
}

export function buildRiver(group, river) {
  const normals = waterNormals();
  normals.repeat.set(1 / 40, 1 / 40);
  const water = new THREE.MeshPhysicalMaterial({ color: 0x2f5a58, roughness: 0.16, metalness: 0, normalMap: normals, normalScale: new THREE.Vector2(0.3, 0.3),
    envMapIntensity: 1.2, polygonOffset: true, polygonOffsetFactor: -8, polygonOffsetUnits: -16 });
  const merged = mergedPolygons(river.features, 0.02);
  if (merged) {
    const mesh = new THREE.Mesh(merged.geometry, water);
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return (time) => { normals.offset.set(time * 0.004, time * 0.0025); };
}

export function buildPlannedWater(group, water, bunds) {
  const planned = mergedPolygons(water.features, 0.04);
  if (planned) group.add(new THREE.Mesh(planned.geometry, layered(0x3f7d7c, 9, { transparent: true, opacity: 0.55, roughness: 0.3, depthWrite: false })));
  group.add(outlines(water.features, 0.12, new THREE.LineBasicMaterial({ color: 0x8fc7c0, transparent: true, opacity: 0.55 })));
  const bundGeometry = ribbons(bunds.features, 0.25, () => 9);
  const bund = new THREE.Mesh(bundGeometry, material(0x9b8a68));
  bund.receiveShadow = true;
  group.add(bund);
}

export function buildPlannedRoads(group, surfaces, centrelines) {
  const merged = mergedPolygons(surfaces.features, 0.06);
  if (merged) {
    const mesh = new THREE.Mesh(merged.geometry, layered(0xc6c0a8, 10, { transparent: true, opacity: 0.72, depthWrite: false }));
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  const lines = [];
  for (const f of centrelines.features) {
    const coords = f.geometry.type === 'LineString' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const line of coords) for (let i = 1; i < line.length; i++) {
      const a = project2(line[i - 1]), b = project2(line[i]);
      lines.push(a.x, 0.2, -a.y, b.x, 0.2, -b.y);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  const dashed = new THREE.LineSegments(geometry, new THREE.LineDashedMaterial({ color: 0xf0d79c, dashSize: 4, gapSize: 3, transparent: true, opacity: 0.7 }));
  dashed.computeLineDistances();
  group.add(dashed);
}

export function buildExistingRoads(group, osmroads) {
  const roads = osmroads.features.filter((f) => f.properties.kind !== 'rail');
  const rail = osmroads.features.filter((f) => f.properties.kind === 'rail');
  const asphalt = new THREE.Mesh(ribbons(roads, 0.08, (f) => ROAD_WIDTH[f.properties.kind] || 4), layered(0x55554f, 12, { roughness: 0.95 }));
  asphalt.receiveShadow = true;
  group.add(asphalt);
  if (rail.length) {
    const ballast = new THREE.Mesh(ribbons(rail, 0.14, () => 6), layered(0x6f655a, 13));
    const track = new THREE.Mesh(ribbons(rail, 0.18, () => 2), layered(0x3a3631, 14, { metalness: 0.4, roughness: 0.5 }));
    group.add(ballast, track);
  }
}

/**
 * Instanced trees scattered inside OSM wood, orchard and plantation polygons and sparsely in
 * village residential areas. Positions are artistic; only the containing land use is mapped.
 */
export function buildTrees(group, byKind, budget) {
  if (!budget) return null;
  const rand = seeded(311);
  const targets = [['forest', 1], ['wood', 1], ['orchard', 0.8], ['plantation', 0.8], ['residential', 0.25], ['village_green', 0.4]];
  const polygons = [];
  for (const [kind, density] of targets) for (const f of byKind.get(kind) || []) eachPolygon(f.geometry, (poly) => {
    const ring = poly[0].map(project2).map((p) => [p.x, p.y]);
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const [x, y] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    polygons.push({ ring, minX, maxX, minY, maxY, weight: (maxX - minX) * (maxY - minY) * density });
  });
  const total = polygons.reduce((s, p) => s + p.weight, 0);
  if (!total) return null;
  const crowns = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), material(0x3d5e37, { roughness: 1 }), budget);
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.08, 0.12, 1, 5), material(0x5b4c3a), budget);
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let n = 0;
  for (const poly of polygons) {
    const count = Math.round((poly.weight / total) * budget);
    for (let tries = 0, placed = 0; placed < count && tries < count * 4 && n < budget; tries++) {
      const x = poly.minX + rand() * (poly.maxX - poly.minX), y = poly.minY + rand() * (poly.maxY - poly.minY);
      if (!pointInRing(x, y, poly.ring)) continue;
      const size = 0.45 + rand() * 0.55;
      dummy.position.set(x, size * 0.5, -y); dummy.scale.set(1, size, 1); dummy.updateMatrix(); trunks.setMatrixAt(n, dummy.matrix);
      dummy.position.y = size * 1.25; dummy.scale.set(size * 0.75, size * 0.62, size * 0.75); dummy.rotation.y = rand() * 6.28; dummy.updateMatrix(); crowns.setMatrixAt(n, dummy.matrix);
      dummy.rotation.y = 0;
      crowns.setColorAt(n, color.setHSL(0.24 + rand() * 0.06, 0.32 + rand() * 0.12, 0.2 + rand() * 0.08));
      n++; placed++;
    }
  }
  crowns.count = trunks.count = n;
  crowns.castShadow = true;
  crowns.receiveShadow = true;
  group.add(trunks, crowns);
  return n;
}
