// Project highlights, announced-target markers and the land layers (allotments, programmes).
import * as THREE from '../../vendor/three.module.min.js';
import { mergedPolygons, outlines, ribbons, bounds, anchorPoint, featureAtFace } from './build.js';

const HIGHLIGHT = 0xf3cf86;

/** Resolve a project's `map` spec against the loaded datasets. */
export function featuresFor(spec, datasets) {
  if (!spec) return [];
  const match = (where) => (f) => Object.entries(where).every(([key, value]) => (Array.isArray(value) ? value.includes(f.properties[key]) : f.properties[key] === value));
  let features = (datasets[spec.dataset]?.features || []).filter(match(spec.where || {}));
  if (!features.length && spec.fallback) features = featuresFor(spec.fallback, datasets);
  if (spec.also) features = features.concat(featuresFor(spec.also, datasets));
  return features;
}

function highlightObject(features) {
  const group = new THREE.Group();
  const polygons = features.filter((f) => /Polygon/.test(f.geometry?.type));
  const lines = features.filter((f) => /LineString/.test(f.geometry?.type));
  const fill = new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -20, polygonOffsetUnits: -40 });
  const merged = mergedPolygons(polygons, 0.3);
  if (merged) group.add(new THREE.Mesh(merged.geometry, fill));
  if (polygons.length) group.add(outlines(polygons, 0.45, new THREE.LineBasicMaterial({ color: HIGHLIGHT })));
  if (lines.length) group.add(new THREE.Mesh(ribbons(lines, 0.35, () => 14), fill));
  group.traverse((o) => { o.raycast = () => {}; o.renderOrder = 5; });
  return group;
}

/**
 * Builds overlays for every mapped project. Returns an API used by the scene:
 * show(id) highlights one project; due(ids) marks projects whose targets fall due.
 */
export function buildProjectOverlays(parent, projects, datasets) {
  const entries = new Map();
  for (const project of projects) {
    const features = featuresFor(project.map, datasets);
    if (!features.length) continue;
    const highlight = highlightObject(features);
    highlight.visible = false;
    parent.add(highlight);
    const box = bounds(features);
    const anchor = project.map.landmark ? box.centre.clone() : anchorPoint(features);
    // Target marker: a ring that the timeline switches on in "announced targets" mode.
    const marker = new THREE.Mesh(new THREE.RingGeometry(1, 1.25, 64), new THREE.MeshBasicMaterial({ color: HIGHLIGHT, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    marker.rotation.x = -Math.PI / 2;
    marker.position.set(anchor.x, 0.6, anchor.z);
    const radius = Math.min(60, Math.max(14, box.size * 0.08));
    marker.scale.setScalar(radius);
    marker.visible = false;
    marker.raycast = () => {};
    parent.add(marker);
    entries.set(project.id, { id: project.id, features, highlight, marker, radius, box, anchor: new THREE.Vector3(anchor.x, 4, anchor.z), landmark: Boolean(project.map.landmark) });
  }
  let selected = null, dueIds = new Set();
  return {
    entries,
    show(id) {
      if (selected) entries.get(selected).highlight.visible = false;
      selected = entries.has(id) ? id : null;
      if (selected) entries.get(selected).highlight.visible = true;
    },
    due(ids) {
      dueIds = new Set(ids);
      for (const [id, e] of entries) e.marker.visible = dueIds.has(id);
    },
    hideMarkers(hidden) { for (const [id, e] of entries) e.marker.visible = !hidden && dueIds.has(id); },
    animate(time) {
      for (const id of dueIds) {
        const e = entries.get(id);
        if (!e) continue;
        const pulse = (time * 0.5) % 1;
        e.marker.scale.setScalar(e.radius * (1 + pulse * 0.6));
        e.marker.material.opacity = 0.9 * (1 - pulse);
      }
    },
  };
}

// Land allotment categories folded into five groups so the legend stays readable.
export const ALLOTMENT_GROUPS = [
  ['Central government', /^goi/i, 0x7fa8c9],
  ['State government', /^goap/i, 0xc99a5b],
  ['Education & health', /school|universit|health/i, 0x9cc28a],
  ['Hotels & commerce', /hotel|ppp|^\d\*/i, 0xd18c7e],
  ['Other', /./, 0xb3a7c9],
];
export const PROGRAMME_COLOURS = { 'Land for monetisation': 0xd8b25f, 'Mortgaged to HUDCO': 0xc0705f, 'R5 zone housing': 0x8fb3a1, 'Industrial area': 0x8e8aa8 };
export const allotmentGroup = (category) => ALLOTMENT_GROUPS.find(([, test]) => test.test(category || '')) || ALLOTMENT_GROUPS.at(-1);

/** Fill + outline per colour group; returns pickable meshes with face->feature lookup. */
function landLayer(parent, features, groupOf, colours, y) {
  const pickables = [];
  const byGroup = new Map();
  for (const f of features) { const key = groupOf(f); (byGroup.get(key) || byGroup.set(key, []).get(key)).push(f); }
  for (const [key, list] of byGroup) {
    const merged = mergedPolygons(list, y);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged.geometry, new THREE.MeshStandardMaterial({ color: colours[key], transparent: true, opacity: 0.5, depthWrite: false, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -14, polygonOffsetUnits: -28 }));
    mesh.userData.pick = (faceIndex) => list[featureAtFace(merged.ranges, faceIndex)];
    mesh.renderOrder = 3;
    parent.add(mesh);
    parent.add(outlines(list, y + 0.1, new THREE.LineBasicMaterial({ color: colours[key], transparent: true, opacity: 0.9 })));
    pickables.push(mesh);
  }
  return pickables;
}

export function buildLandLayers(allotmentGroupObj, programmeGroupObj, datasets) {
  const colours = Object.fromEntries(ALLOTMENT_GROUPS.map(([name, , colour]) => [name, colour]));
  const allotments = landLayer(allotmentGroupObj, datasets.allotments.features, (f) => allotmentGroup(f.properties.category)[0], colours, 0.22);
  const programmes = landLayer(programmeGroupObj, datasets.landprogrammes.features, (f) => f.properties.programme, PROGRAMME_COLOURS, 0.18);
  return { allotments, programmes };
}

