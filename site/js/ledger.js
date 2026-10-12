import { $, $$, escapeHTML, niceDate, STATUSES, CATEGORIES, FILTERS, STALE_DAYS, evidenceAge, targetState, tierOf, parseDate, plural } from './format.js';
import { state, setState } from './state.js';

let registry, sourceIndex, searchIndex;
const list = $('#project-list');

export function stageHTML(project) {
  return `<span class="stage-badge tier-${tierOf(project)}"><i aria-hidden="true"></i>${escapeHTML(STATUSES[project.status] || project.status)}</span>`;
}

export function targetChip(project, asOf) {
  const kind = targetState(project, asOf);
  if (!kind) return '';
  const label = { met: 'Target met', passed: 'Target passed', due: 'Target', text: 'Target' }[kind];
  return `<span class="target-chip target-${kind}" title="Announced target, not a confirmed date">${label} · ${escapeHTML(niceDate(project.announced_target.date))}</span>`;
}

function staleHTML(project) {
  const age = evidenceAge(project, registry.as_of);
  if (age === null) return '<span class="stale-flag">Undated</span>';
  return age > STALE_DAYS ? `<span class="stale-flag" title="Latest evidence is ${age} days older than this edition">${Math.round(age / 30)} months old</span>` : '';
}

const sorters = {
  ledger: () => 0,
  latest: (a, b) => (b.evidence_date || '').localeCompare(a.evidence_date || ''),
  oldest: (a, b) => (a.evidence_date || '9999').localeCompare(b.evidence_date || '9999'),
  target: (a, b) => (parseDate(a.announced_target?.date)?.date ?? Infinity) - (parseDate(b.announced_target?.date)?.date ?? Infinity),
};

export function filteredProjects() {
  const query = state.q.toLowerCase().trim();
  const filter = FILTERS[state.filter] || (() => true);
  const rows = registry.projects.filter((p) => filter(p) && (!query || searchIndex.get(p.id).includes(query)));
  return state.sort === 'ledger' ? rows : [...rows].sort(sorters[state.sort] || sorters.ledger);
}

export function renderList() {
  const rows = filteredProjects();
  list.innerHTML = rows.length ? rows.map((p) => `<button class="project-row${state.project === p.id ? ' current' : ''}" data-project="${escapeHTML(p.id)}" aria-label="Read evidence for ${escapeHTML(p.name)}">
    <span class="project-name"><span class="row-number">${String(registry.projects.indexOf(p) + 1).padStart(2, '0')}</span><span><b>${escapeHTML(p.name)}</b><small>${escapeHTML(CATEGORIES[p.category] || p.category)}${p.map ? ' · <span class="mapped-mark" title="Located on real planning geometry">◇ mapped</span>' : ''}</small></span></span>
    <span class="project-date">${escapeHTML(niceDate(p.evidence_date))}${staleHTML(p)}</span>
    <span class="project-stage">${stageHTML(p)}${targetChip(p, registry.as_of)}</span>
    <span class="row-arrow" aria-hidden="true">↗</span></button>`).join('')
    : '<p class="empty-results">No projects match this search. Try a different name, contractor, status or source.</p>';
  $('#result-count').textContent = plural(rows.length, 'project');
}

export function initLedger(data, { onOpen }) {
  registry = data.projects;
  sourceIndex = new Map(data.sources.map((s) => [s.id, s]));
  // Search covers names, categories, summaries, status labels, contractors and source titles.
  searchIndex = new Map(registry.projects.map((p) => [p.id, [p.name, p.category, CATEGORIES[p.category], p.summary, STATUSES[p.status],
    p.contractor?.value, ...p.sources.map((id) => sourceIndex.get(id)?.title)].filter(Boolean).join(' ').toLowerCase()]));
  list.addEventListener('click', (event) => {
    const row = event.target.closest('.project-row');
    if (row) onOpen(row.dataset.project);
  });
  const filters = $('.filter-buttons');
  filters.innerHTML = [['all', 'All projects'], ['government', 'Government'], ['transport', 'Mobility'], ['housing', 'Housing'], ['other', 'City life']]
    .map(([key, label]) => `<button data-filter="${key}" aria-pressed="false">${label}${key === 'all' ? ` <span>${registry.projects.length}</span>` : ''}</button>`).join('');
  filters.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) setState({ filter: button.dataset.filter });
  });
  $('#project-search').addEventListener('input', (event) => setState({ q: event.target.value }));
  $('#project-sort').addEventListener('change', (event) => setState({ sort: event.target.value }));
  syncControls();
}

export function syncControls() {
  $$('.filter-buttons button').forEach((b) => { const on = b.dataset.filter === state.filter; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
  if ($('#project-search').value !== state.q) $('#project-search').value = state.q;
  $('#project-sort').value = state.sort;
  renderList();
}
