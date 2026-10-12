// Illustrative landmark massing placed on APCRDA planning parcels. Dimensions and facades are
// original illustrations, not official architectural models. Style follows the evidence tier:
// solid for work reported on site, outlined ghost for procured or planned work.
import * as THREE from '../../vendor/three.module.min.js';
import { material, bounds, seeded } from './build.js';

const box = new THREE.BoxGeometry(1, 1, 1);
const GHOST_FILL = new THREE.MeshStandardMaterial({ color: 0xe9cf98, transparent: true, opacity: 0.3, depthWrite: false, roughness: 0.6 });
const GHOST_EDGE = new THREE.LineBasicMaterial({ color: 0xffe2a0 });

function palette() {
  return {
    stone: material(0xe6d9bb, { roughness: 0.78 }), concrete: material(0xbdbba8, { roughness: 0.85 }),
    gold: material(0xd5b273, { metalness: 0.75, roughness: 0.32 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x5b8580, metalness: 0.1, roughness: 0.08, envMapIntensity: 1.6, clearcoat: 0.6 }),
  };
}

function add(parent, geometry, mat, x, y, z, sx = 1, sy = 1, sz = 1) {
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.position.set(x, y, z);
  mesh.scale.set(sx, sy, sz);
  mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const cube = (parent, mat, x, y, z, w, h, d) => add(parent, box, mat, x, y, z, w, h, d);

/** Replace a solid model with translucent fill and crisp edges (planned / procured tier). */
function ghost(group) {
  const meshes = [];
  group.traverse((o) => { if (o.isMesh) meshes.push(o); });
  for (const mesh of meshes) {
    mesh.material = GHOST_FILL;
    mesh.castShadow = false;
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 30), GHOST_EDGE);
    edges.position.copy(mesh.position); edges.rotation.copy(mesh.rotation); edges.scale.copy(mesh.scale);
    edges.raycast = () => {};
    mesh.parent.add(edges);
  }
}

const MODELS = {
  secretariat(group, m) {
    // Five towers on the SEC-HOD parcel; heights are illustrative.
    for (const [x, z, h] of [[-8, -10, 22], [8, -10, 18], [-8, 8, 17], [8, 8, 20], [0, 27, 27]]) {
      cube(group, m.concrete, x, 0.95, z, 8, 1.2, 8);
      cube(group, m.glass, x, h / 2 + 1.6, z, 5.5, h, 5.5);
      cube(group, m.stone, x, h + 2, z, 6.2, 0.8, 6.2);
      for (let j = 0; j < Math.floor(h / 1.2); j++) cube(group, m.stone, x, 2 + j * 1.2, z, 5.75, 0.16, 5.75);
      for (const sx of [-2.65, 2.65]) for (const sz of [-2.65, 2.65]) cube(group, m.gold, x + sx, h / 2 + 1.6, z + sz, 0.26, h, 0.26);
    }
    return 30;
  },
  assembly(group, m) {
    const cyl = (r1, r2, h, y, mat) => add(group, new THREE.CylinderGeometry(r1, r2, h, 48), mat, 0, y, 0);
    cyl(12, 13, 1, 1.1, m.stone); cyl(10, 11, 2, 2.4, m.stone); cyl(9, 10, 2, 4.2, m.glass); cyl(9.8, 9.8, 0.7, 5.6, m.stone);
    add(group, new THREE.ConeGeometry(1.8, 24, 8), m.gold, 0, 17.3, 0);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; cube(group, m.stone, Math.cos(a) * 9.3, 3.7, Math.sin(a) * 9.3, 0.45, 3.3, 0.45); }
    const ring = add(group, new THREE.TorusGeometry(15, 0.18, 6, 80), m.gold, 0, 0.9, 0);
    ring.rotation.x = Math.PI / 2;
    // A reflecting pool around the base, after the published masterplan imagery.
    const pool = add(group, new THREE.RingGeometry(16, 26, 64), new THREE.MeshPhysicalMaterial({ color: 0x2f5a58, roughness: 0.05, envMapIntensity: 1.4 }), 0, 0.12, 0);
    pool.rotation.x = -Math.PI / 2; pool.castShadow = false;
    return 40; // label sits above the spire, clear of the neighbouring Secretariat label
  },
  highcourt(group, m) {
    cube(group, m.stone, 0, 1, 0, 27, 1, 20); cube(group, m.glass, 0, 4.2, 0, 23, 5.5, 15); cube(group, m.stone, 0, 7.6, 0, 27, 1.2, 20); cube(group, m.stone, 0, 9, 0, 18, 1.7, 12);
    for (let i = -5; i <= 5; i++) cube(group, m.stone, i * 2, 4.3, 7.7, 0.5, 5, 0.5);
    add(group, new THREE.SphereGeometry(6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m.stone, 0, 9.8, 0);
    return 16;
  },
  housing(group, m) {
    for (let i = 0; i < 6; i++) {
      const x = (i % 3 - 1) * 8, z = (Math.floor(i / 3) - 0.5) * 13;
      cube(group, m.concrete, x, 5.7, z, 5, 10, 6);
      for (let j = 0; j < 7; j++) cube(group, m.stone, x, 1.5 + j * 1.3, z, 5.2, 0.15, 6.2);
    }
    return 12;
  },
};

/**
 * Build one landmark per mapped landmark project. Returns [{id, group, anchor, centre}].
 * parcelsFor(project) returns the APCRDA features the project is mapped to.
 */
export function buildLandmarks(parent, projects, parcelsFor, tierOf) {
  const m = palette();
  const out = [];
  for (const project of projects) {
    if (!project.map?.landmark) continue;
    const features = parcelsFor(project);
    if (!features.length) continue;
    const group = new THREE.Group();
    const place = bounds([features[0]]).centre;
    group.position.copy(place);
    const model = MODELS[project.id] || MODELS.housing;
    const height = model(group, m);
    if (tierOf(project) !== 'site') ghost(group);
    group.traverse((o) => { if (o.isMesh) o.userData.project = project.id; });
    parent.add(group);
    out.push({ id: project.id, group, anchor: new THREE.Vector3(place.x, height + 7, place.z), centre: place.clone() });
  }
  return out;
}

/** Speculative massing for the "illustrative growth" mode. Explicitly fictional. */
export function buildIllustration(layer, landmarks) {
  const parent = new THREE.Group();
  layer.add(parent);
  const proxyMaterial = new THREE.MeshStandardMaterial({ color: 0xe3c181, transparent: true, opacity: 0.12, depthWrite: false });
  const proxies = [];
  const secretariat = landmarks.find((l) => l.id === 'secretariat');
  if (secretariat) for (const [x, z, h] of [[-8, -10, 22], [8, -10, 18], [-8, 8, 17], [8, 8, 20], [0, 27, 27]]) {
    const mesh = add(parent, box, proxyMaterial, secretariat.centre.x + x, h * 0.65 + 2, secretariat.centre.z + z, 7, h * 1.3, 7);
    mesh.castShadow = false;
    proxies.push(mesh);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0xf4cf87, transparent: true, opacity: 0.6 }));
    edges.position.copy(mesh.position); edges.scale.copy(mesh.scale);
    parent.add(edges);
  }
  const vision = new THREE.Group();
  const rand = seeded(907);
  const visionMaterial = new THREE.MeshStandardMaterial({ color: 0xbda987, transparent: true, opacity: 0.45, depthWrite: false });
  for (let i = 0; i < 120; i++) {
    const x = (rand() < 0.5 ? -1 : 1) * (60 + rand() * 260), z = (rand() - 0.5) * 700, h = 2 + rand() * 10;
    const mesh = add(vision, box, visionMaterial, x, h / 2 + 0.6, z, 4 + rand() * 5, h, 5 + rand() * 7);
    mesh.castShadow = false;
  }
  parent.add(vision);
  let last = false;
  return {
    set(index, horizons) {
      // Opacity grows with the horizon; the masterplan view adds the fictional urban field.
      proxyMaterial.opacity = 0.06 + (index / Math.max(1, horizons - 1)) * 0.16;
      last = index === horizons - 1;
    },
    show(visible) { parent.visible = visible; vision.visible = visible && last; },
  };
}
