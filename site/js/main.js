import { $, $$, escapeHTML, niceDate, upperDate, tierOf, reducedMotion, plural } from './format.js';
import { state, setState, onState, initState } from './state.js';
import { initLedger, syncControls } from './ledger.js';
import { initPanel, openPanel, closePanel, panelOpen } from './panel.js';
import { initTimeline, syncTimeline, targetsDue, horizonCount, modes, compareLabel } from './timeline.js';
import { renderInsights } from './insights.js';

const fetchJSON = async (file) => { const res = await fetch(`./data/${file}.json`); if (!res.ok) throw new Error(`${file}: ${res.status}`); return res.json(); };
let toastTimer, sceneAPI = null;
const data = {};

function toast(message) {
  const el = $('#toast');
  el.textContent = message; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 4200);
}

/** Every count and date on the page comes from the datasets, never from markup. */
function fillStats() {
  const { projects, sources, stats } = data;
  const edition = projects.as_of;
  const values = {
    'edition-date': upperDate(edition), 'edition-date-short': niceDate(edition), 'project-count': projects.projects.length,
    'source-count': sources.length, 'mapped-count': projects.projects.filter((p) => p.map).length,
    'building-count': stats.buildings ? stats.buildings.in_capital_boundary.toLocaleString('en-IN') : '—',
    'road-count': stats.layers.roads?.features ?? '—', 'road-layer-count': stats.layers.roads?.layers ?? '—',
    'water-count': stats.layers.water?.features ?? '—', 'target-year': stats.capital_target_year ?? '—',
    'osm-date': stats.osm_base ? niceDate(stats.osm_base.slice(0, 10)) : 'unknown', 'gis-date': stats.gis_retrieved ? niceDate(stats.gis_retrieved) : 'unknown',
    'building-levels': stats.buildings ? stats.buildings.with_levels_tag.toLocaleString('en-IN') : '—',
    'landuse-count': stats.layers.landuse?.features ?? '—', 'allotment-count': stats.layers.allotments?.features ?? '—',
  };
  for (const [key, value] of Object.entries(values)) $$(`[data-stat="${key}"]`).forEach((el) => { el.textContent = value; });
  document.title = `Amaravati — A capital, taking shape · Evidence as of ${niceDate(edition)}`;
}

function openProject(id, { focus = true } = {}) {
  const project = data.projects.projects.find((p) => p.id === id);
  if (!project) return;
  openPanel(project, {
    mapped: sceneAPI?.hasProject(id), focus,
    onLocate: () => { setState({ project: null, explore: true }); closePanel({ restoreFocus: false }); sceneAPI?.focus(id); sceneAPI?.select(id); },
  });
  sceneAPI?.select(id);
}

function enterExplore() {
  $('#city').classList.add('exploring'); $('#close-explore').hidden = false;
  $('#view-title').textContent = 'Explore the capital';
  $('#view-subtitle').textContent = 'Select a landmark or project label to follow its evidence';
  $('#city').scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
  sceneAPI?.setExplore(true); sceneAPI?.resize();
}
function leaveExplore() {
  $('#city').classList.remove('exploring'); $('#close-explore').hidden = true;
  $('#view-title').textContent = 'The government spine'; $('#view-subtitle').textContent = 'An architectural massing study';
  sceneAPI?.setExplore(false); sceneAPI?.reset(); sceneAPI?.resize();
}

function syncCompare() {
  $('#compare-button').setAttribute('aria-pressed', String(state.compare));
  sceneAPI?.setCompare(state.compare);
  $('.compare-marker')?.remove();
  if (state.compare) {
    const marker = document.createElement('div');
    marker.className = 'compare-marker';
    marker.innerHTML = `<span>TODAY · EVIDENCE</span><span>${escapeHTML(compareLabel().toUpperCase())}</span>`;
    $('#city').append(marker);
  }
}

function syncScene() {
  syncTimeline();
  sceneAPI?.setTime(state.t, horizonCount(), state.mode, targetsDue(state.t).map((p) => p.id));
  syncCompare();
}

function applyState(changed) {
  if (changed.some((k) => ['filter', 'sort', 'q', 'project'].includes(k))) syncControls();
  if (changed.some((k) => ['t', 'mode', 'compare'].includes(k))) syncScene();
  if (changed.includes('explore')) (state.explore ? enterExplore : leaveExplore)();
  if (changed.includes('project')) {
    if (state.project) openProject(state.project); else { closePanel(); sceneAPI?.select(null); }
  }
}

function landTooltip(feature, kind, at) {
  const tip = $('#land-tip');
  if (!feature) { tip.hidden = true; return; }
  const p = feature.properties;
  tip.innerHTML = kind === 'allotment'
    ? `<b>${escapeHTML(p.name || 'Unnamed allotment')}</b><span>${escapeHTML(p.category || 'Uncategorised')} · ${escapeHTML(p.acres ?? '?')} acres</span><small>APCRDA land allotment (Feb 2025). Allotment is not construction.</small>`
    : `<b>${escapeHTML(p.programme)}</b><span>${escapeHTML(p.use || p.zoning || 'Land parcel')} · ${escapeHTML(p.acres ?? '?')} acres</span><small>APCRDA land programme layer.</small>`;
  tip.style.left = `${at.x}px`; tip.style.top = `${at.y}px`;
  tip.hidden = false;
}

function setLayer(name, visible) {
  const button = $(`.layer-buttons [data-layer="${name}"]`);
  if (button) { button.setAttribute('aria-pressed', String(visible)); button.classList.toggle('on', visible); }
  sceneAPI?.setLayer(name, visible);
  $$(`[data-legend="${name}"]`).forEach((el) => { el.hidden = !visible; });
}

function wireControls() {
  $('#explore-button').addEventListener('click', () => setState({ explore: true }));
  $('#close-explore').addEventListener('click', () => setState({ explore: false, project: null }));
  $('#compare-button').addEventListener('click', () => {
    const compare = !state.compare;
    setState({ compare, t: compare && state.t === 0 ? 1 : state.t, explore: compare || state.explore });
    if (compare) { sceneAPI?.focus('secretariat'); $('#view-title').textContent = 'Compare today with a future view'; $('#view-subtitle').textContent = 'One camera. Left: evidence. Right: the selected scenario.'; }
  });
  $$('.layer-buttons button').forEach((button) => button.addEventListener('click', () => setLayer(button.dataset.layer, button.getAttribute('aria-pressed') !== 'true')));
  $('#reset-view').addEventListener('click', () => sceneAPI?.reset());
  $('#tour-button').addEventListener('click', () => {
    const running = $('#tour-button').getAttribute('aria-pressed') !== 'true';
    $('#tour-button').setAttribute('aria-pressed', String(running));
    $('#tour-button').setAttribute('aria-label', running ? 'Stop slow camera orbit' : 'Start slow camera orbit');
    $('#tour-button').textContent = running ? 'Ⅱ' : '▷';
    sceneAPI?.tour(running);
  });
  $('#due-list').addEventListener('click', (event) => { const b = event.target.closest('[data-project]'); if (b) setState({ project: b.dataset.project }, { push: true }); });
  // Section links scroll without replacing the shareable state in the hash.
  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (event) => {
    const target = document.getElementById(a.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' });
  }));
  const notes = $('#notes-dialog');
  let notesFocus = null;
  const openNotes = () => { notesFocus = document.activeElement; notes.showModal(); };
  ['about-button', 'data-button', 'method-button'].forEach((id) => $(`#${id}`).addEventListener('click', openNotes));
  $('#close-notes').addEventListener('click', () => notes.close());
  notes.addEventListener('close', () => notesFocus?.focus?.());
  notes.addEventListener('click', (event) => {
    if (event.target !== notes) return;
    const r = notes.getBoundingClientRect();
    if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) notes.close();
  });
  $('#copy-link').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(location.href); toast('Link to this view copied.'); } catch { toast('Copy the address bar to share this view.'); }
  });
}

async function init() {
  try {
    const [projects, sources, scenarios, stats, funding, history] = await Promise.all(['projects', 'sources', 'scenarios', 'stats', 'funding', 'history'].map(fetchJSON));
    Object.assign(data, { projects, sources, scenarios, stats, funding, history, sourceIndex: new Map(sources.map((s) => [s.id, s])) });
  } catch (error) {
    $('#project-list').innerHTML = '<p class="empty-results">Project data could not load. Run the supplied local server and reload this page.</p>';
    console.error(error); toast('Project data failed to load.');
    return;
  }
  fillStats();
  initTimeline(data);
  initState({ horizons: horizonCount(), modes: modes() });
  initLedger(data, { onOpen: (id) => setState({ project: id }, { push: true }) });
  initPanel(data, { onClose: () => setState({ project: null }) });
  wireControls();
  onState(applyState);
  syncScene();
  if (state.project) openProject(state.project, { focus: false });
  if (state.explore) enterExplore();

  try {
    const names = ['parcels', 'government', 'boundary', 'water', 'roads', 'roadsurfaces', 'bunds', 'allotments', 'allotments2019', 'landprogrammes', 'river', 'landuse', 'osmroads'];
    const values = await Promise.all(names.map(fetchJSON));
    const datasets = Object.fromEntries(names.map((n, i) => [n, values[i]]));
    renderInsights({ ...datasets, funding: data.funding, history: data.history, sourceIndex: data.sourceIndex, onShowLayer: (name) => { setLayer(name, true); setState({ explore: true }); } });
    const { createScene } = await import('./scene/index.js');
    sceneAPI = await createScene({
      host: $('#world'), labelsHost: $('#labels'), stage: $('#city'), datasets, projects: data.projects.projects, tierOf, reducedMotion,
      hooks: {
        onPick: (id) => setState({ project: id }, { push: true }),
        onLandPick: landTooltip,
        onContextLost: () => { $('#fallback').hidden = false; $('#labels').hidden = true; toast('3D rendering paused. Project evidence remains available below.'); },
        onQuality: (tier) => toast(`Visual quality set to ${tier.name} for smoother rendering.`),
      },
    });
    $('#loading').hidden = true;
    if (new URLSearchParams(location.search).has('debug')) window.__observatory = { sceneAPI, data, state };
    syncScene();
    sceneAPI.setExplore(state.explore);
    if (state.project) { sceneAPI.select(state.project); sceneAPI.focus(state.project); }
    $$('.layer-buttons button').forEach((b) => sceneAPI.setLayer(b.dataset.layer, b.getAttribute('aria-pressed') === 'true'));
    sceneAPI.buildingsReady.then((b) => { if (b) $('#building-status').textContent = `${plural(b.count, 'OSM building')} rendered${data.stats.buildings?.partial ? ' · partial coverage: some map tiles are still to be downloaded' : ''}`; });
  } catch (error) {
    console.error('3D view unavailable:', error);
    $('#loading').hidden = true; $('#fallback').hidden = false; $('#labels').hidden = true;
    $('#tour-button').disabled = true; $('#reset-view').disabled = true;
  }
}
init();
