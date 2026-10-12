// The 3D planning study: assembles environment, mapped context, landmarks and overlays.
import * as THREE from '../../vendor/three.module.min.js';
import { OrbitControls } from '../../vendor/OrbitControls.js';
import { createEnvironment } from './environment.js';
import { buildGround, buildLanduse, buildRiver, buildPlannedWater, buildPlannedRoads, buildExistingRoads, buildTrees } from './context.js';
import { buildLandmarks, buildIllustration } from './landmarks.js';
import { buildProjectOverlays, buildLandLayers, featuresFor } from './overlays.js';
import { decodeBuildings, buildBuildings } from './buildings.js';
import { outlines, mergedPolygons, material } from './build.js';
import { initialQuality, frameMonitor } from './quality.js';

export const LAYERS = ['landmarks', 'buildings', 'roads', 'planned', 'water', 'landuse', 'parcels', 'allotments', 'programmes'];
const HOME = { position: new THREE.Vector3(230, 210, 330), target: new THREE.Vector3(0, 0, 0) };

export async function createScene({ host, labelsHost, stage, datasets, projects, tierOf, reducedMotion, hooks }) {
  let quality = initialQuality();
  const renderer = new THREE.WebGLRenderer({ antialias: quality.antialias, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, quality.pixelRatio));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.62;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 1, 12000);
  camera.position.copy(HOME.position);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  Object.assign(controls, { enableDamping: true, dampingFactor: 0.065, minDistance: 40, maxDistance: 2200, maxPolarAngle: Math.PI * 0.46, minPolarAngle: 0.15, autoRotateSpeed: 0.25 });
  const env = createEnvironment(renderer, scene, quality);

  const layers = Object.fromEntries(LAYERS.map((key) => { const g = new THREE.Group(); g.name = key; scene.add(g); return [key, g]; }));
  const base = new THREE.Group();
  scene.add(base);
  buildGround(base);
  const landuseKinds = buildLanduse(layers.landuse, datasets.landuse);
  const animateRiver = buildRiver(layers.water, datasets.river);
  buildPlannedWater(layers.water, datasets.water, datasets.bunds);
  buildPlannedRoads(layers.planned, datasets.roadsurfaces, datasets.roads);
  buildExistingRoads(layers.roads, datasets.osmroads);
  base.add(outlines(datasets.boundary.features, 0.5, new THREE.LineBasicMaterial({ color: 0xe9c57d, transparent: true, opacity: 0.8 })));

  const government = mergedPolygons(datasets.government.features, 0.1);
  if (government) layers.parcels.add(new THREE.Mesh(government.geometry, material(0x7f8c69, { polygonOffset: true, polygonOffsetFactor: -10, polygonOffsetUnits: -20 })));
  const parcels = mergedPolygons(datasets.parcels.features, 0.16);
  if (parcels) layers.parcels.add(new THREE.Mesh(parcels.geometry, material(0xb0ad8f, { transparent: true, opacity: 0.85, polygonOffset: true, polygonOffsetFactor: -12, polygonOffsetUnits: -24 })));
  layers.parcels.add(outlines(datasets.parcels.features, 0.3, new THREE.LineBasicMaterial({ color: 0xd8c697, transparent: true, opacity: 0.7 })));
  layers.parcels.traverse((o) => { o.receiveShadow = true; });

  const trees = new THREE.Group();
  layers.landuse.add(trees);
  const treeCount = buildTrees(trees, landuseKinds, quality.trees) || 0;

  const landmarks = buildLandmarks(layers.landmarks, projects, (p) => featuresFor(p.map, datasets), tierOf);
  const illustration = buildIllustration(layers.landmarks, landmarks);
  const overlays = buildProjectOverlays(scene, projects, datasets);
  const land = buildLandLayers(layers.allotments, layers.programmes, datasets);
  layers.allotments.visible = false;
  layers.programmes.visible = false;

  // Labels: modelled landmarks always; other mapped projects while exploring.
  const labels = [];
  const projectIndex = new Map(projects.map((p, i) => [p.id, i]));
  for (const [id, entry] of overlays.entries) {
    const project = projects[projectIndex.get(id)];
    const landmark = landmarks.find((l) => l.id === id);
    const button = document.createElement('button');
    button.className = `landmark-label${landmark ? '' : ' project-label'}`;
    button.innerHTML = `<span class="label-index">${String(projectIndex.get(id) + 1).padStart(2, '0')}</span>${project.name.replace(/ and HoD towers| complex$/i, '').toUpperCase()}`;
    button.setAttribute('aria-label', `Read project evidence: ${project.name}`);
    button.addEventListener('click', () => hooks.onPick(id));
    labelsHost.append(button);
    labels.push({ id, el: button, anchor: landmark ? landmark.anchor : entry.anchor, landmark: Boolean(landmark), visible: null });
  }

  const pickables = [];
  layers.landmarks.traverse((o) => { if (o.isMesh && o.userData.project) pickables.push(o); });
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
  let down = null;
  renderer.domElement.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY }; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const targets = [...(layers.landmarks.visible ? pickables : []), ...(layers.allotments.visible ? land.allotments : []), ...(layers.programmes.visible ? land.programmes : [])];
    const hit = raycaster.intersectObjects(targets, false)[0];
    if (!hit) { hooks.onLandPick(null); return; }
    if (hit.object.userData.project) hooks.onPick(hit.object.userData.project);
    else hooks.onLandPick(hit.object.userData.pick(hit.faceIndex), layers.allotments.visible && land.allotments.includes(hit.object) ? 'allotment' : 'programme', { x: e.clientX - rect.left, y: e.clientY - rect.top });
  });

  // OSM buildings stream in after the first frame.
  let buildingStats = null, buildingMaterial = null;
  const buildingsReady = fetch('./data/buildings.bin').then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`buildings: ${r.status}`))))
    .then(async (buffer) => {
      const decoded = decodeBuildings(buffer);
      buildingStats = decoded.stats;
      buildingMaterial = await buildBuildings(layers.buildings, decoded, { castShadow: quality.buildingShadows });
      return buildingStats;
    }).catch((error) => { console.warn('Buildings unavailable:', error); return null; });

  // --- View state -------------------------------------------------------------------------
  let compare = false, exploring = false, timeIndex = 0, horizons = 1, mode = 'announced_targets';
  let desiredTarget = null, desiredCamera = null, frame = 0, onScreen = true, last = performance.now();
  let width = 0, height = 0, narrow = innerWidth <= 760;
  let frameCount = 0;
  function resize() {
    width = host.clientWidth; height = host.clientHeight; narrow = innerWidth <= 760;
    if (!width || !height) return;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(host);
  resize();

  function applyScenario(showFuture) {
    illustration.show(showFuture && mode === 'accelerated_illustration' && timeIndex > 0);
    overlays.hideMarkers(!showFuture);
  }

  const monitor = frameMonitor(quality, (next, average) => {
    quality = next;
    renderer.setPixelRatio(Math.min(devicePixelRatio, next.pixelRatio));
    env.setShadows(next.shadows);
    trees.visible = next.trees > 0;
    layers.buildings.children.forEach((m) => { m.castShadow = next.buildingShadows; });
    resize();
    hooks.onQuality?.(next, average);
  });

  const projected = new THREE.Vector3();
  function render(now) {
    frame = requestAnimationFrame(render);
    const delta = now - last; last = now;
    // Pause while the stage is scrolled away (checked every 30 frames; hidden tabs already stop rAF).
    if (frameCount++ % 30 === 0) { const r = stage.getBoundingClientRect(); onScreen = r.bottom > -100 && r.top < innerHeight + 100; }
    if (!onScreen) return;
    monitor(delta);
    const time = now / 1000;
    if (desiredTarget) {
      const k = reducedMotion ? 1 : 0.075;
      controls.target.lerp(desiredTarget, k); camera.position.lerp(desiredCamera, k);
      if (controls.target.distanceTo(desiredTarget) < 0.1 && camera.position.distanceTo(desiredCamera) < 0.1) desiredTarget = desiredCamera = null;
    }
    controls.update();
    env.followTarget(controls.target);
    if (!reducedMotion) { animateRiver(time); overlays.animate(time); }
    if (compare) {
      const stageRect = stage.getBoundingClientRect(), hostRect = host.getBoundingClientRect();
      const split = Math.max(0, Math.min(width, stageRect.left + stageRect.width / 2 - hostRect.left));
      renderer.setScissorTest(true);
      applyScenario(false); renderer.setScissor(0, 0, split, height); renderer.setViewport(0, 0, width, height); renderer.render(scene, camera);
      applyScenario(true); renderer.setScissor(split, 0, width - split, height); renderer.render(scene, camera);
      renderer.setScissorTest(false);
    } else {
      applyScenario(true);
      renderer.render(scene, camera);
    }
    for (const label of labels) {
      projected.copy(label.anchor).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width, y = (-projected.y * 0.5 + 0.5) * height;
      const overlapsIntro = !exploring && (narrow ? y + host.offsetTop < 475 : x < width * 0.33);
      const visible = (label.landmark ? layers.landmarks.visible : exploring) && !overlapsIntro && projected.z < 1
        && projected.x > -0.95 && projected.x < 0.95 && projected.y > -0.8 && projected.y < 0.65 && (!narrow || (x > 70 && x < width - 70));
      if (visible !== label.visible) { label.el.hidden = !visible; label.visible = visible; }
      if (visible) label.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
    }
  }
  frame = requestAnimationFrame(render);

  renderer.domElement.addEventListener('webglcontextlost', (event) => { event.preventDefault(); hooks.onContextLost?.(); });
  addEventListener('pagehide', () => { cancelAnimationFrame(frame); controls.dispose(); renderer.dispose(); }, { once: true });

  function fly(target, offset) { desiredTarget = target.clone(); desiredCamera = target.clone().add(offset); }

  return {
    debug: { scene, camera, controls, overlays, landmarks, layers },
    resize,
    buildingsReady,
    stats: () => ({ trees: treeCount, buildings: buildingStats, quality: quality.name }),
    hasProject: (id) => overlays.entries.has(id),
    reset() { fly(HOME.target, HOME.position.clone().sub(HOME.target)); controls.autoRotate = false; },
    setTime(index, count, nextMode, dueIds) {
      timeIndex = index; horizons = count; mode = nextMode;
      illustration.set(index, count);
      overlays.due(index > 0 && mode === 'announced_targets' ? dueIds : []);
    },
    setCompare(value) { compare = value; },
    setExplore(value) { exploring = value; },
    setLayer(name, visible) { if (layers[name]) layers[name].visible = visible; },
    tour(value) { controls.autoRotate = value; },
    focus(id) {
      const entry = overlays.entries.get(id);
      if (!entry) return;
      if (entry.landmark) { fly(entry.box.centre, new THREE.Vector3(72, 92, 115)); return; }
      const distance = THREE.MathUtils.clamp(entry.box.size * 0.75, 140, 1500);
      fly(entry.box.centre, new THREE.Vector3(0.45, 0.62, 0.8).normalize().multiplyScalar(distance));
    },
    select(id) {
      overlays.show(id);
      labels.forEach((l) => l.el.classList.toggle('selected', l.id === id));
    },
  };
}
