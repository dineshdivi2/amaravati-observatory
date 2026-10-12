import { $, $$, escapeHTML, niceDate, parseDate, upperDate, isDelivered } from './format.js';
import { state, setState } from './state.js';

export const MODE_LABELS = {
  conservative: { label: 'Evidence only', note: 'Shows only what published evidence supports today.' },
  announced_targets: { label: 'Announced targets', note: 'Marks projects whose announced target falls on or before this date. Targets are not confirmed delivery.' },
  accelerated_illustration: { label: 'Illustrative growth', note: 'Adds speculative massing. Shapes and timing are not predictions.' },
};
let horizons = [];
let projects = [];
let asOf;

/** Projects whose calendar target falls on or before the horizon and are not yet reported delivered. */
export function targetsDue(index) {
  const horizon = horizons[index];
  if (!horizon || index === 0) return [];
  const limit = horizon.date ? parseDate(horizon.date).date : new Date(Date.UTC(9999, 0, 1));
  return projects.filter((p) => {
    const target = parseDate(p.announced_target?.date);
    return target && target.date <= limit && !isDelivered(p);
  });
}

export const horizonCount = () => horizons.length;
export const modes = () => Object.keys(MODE_LABELS);

export function initTimeline(data) {
  asOf = data.scenarios.baseline;
  projects = data.projects.projects;
  horizons = [{ date: asOf, label: 'Today', kind: 'evidence' }, ...data.scenarios.horizons];
  $('.time-stops').innerHTML = horizons.map((h, i) => `<button data-time="${i}" aria-pressed="false"><span class="stop-dot"></span><b>${escapeHTML(i === 0 ? 'Today' : h.date ? h.label.replace(/^Six months$/, '6 months').replace(/^One year$/, '1 year').replace(/^Two years$/, '2 years') : 'The vision')}</b><small>${escapeHTML(h.date ? niceDate(h.date.slice(0, 7)) : 'Masterplan')}</small></button>`).join('');
  $('.time-stops').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) setState({ t: Number(button.dataset.time) });
  });
  const available = new Set(data.scenarios.modes);
  $('.mode-switch').innerHTML = Object.entries(MODE_LABELS).filter(([key]) => available.has(key))
    .map(([key, m]) => `<button data-mode="${key}" aria-pressed="false" title="${escapeHTML(m.note)}">${escapeHTML(m.label)}</button>`).join('');
  $('.mode-switch').addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (button) setState({ mode: button.dataset.mode });
  });
}

export function syncTimeline() {
  const index = state.t;
  const horizon = horizons[index];
  $$('.time-stops button').forEach((b) => { const on = Number(b.dataset.time) === index; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
  $$('.mode-switch button').forEach((b) => { const on = b.dataset.mode === state.mode; b.classList.toggle('selected', on); b.setAttribute('aria-pressed', String(on)); });
  $('#selected-date').textContent = index === 0 ? niceDate(asOf) : horizon.date ? niceDate(horizon.date) : 'Long-term vision';
  const due = targetsDue(index);
  const modeLabel = MODE_LABELS[state.mode].label.toUpperCase();
  $('#scene-mode').textContent = index === 0 ? `TODAY · ${upperDate(asOf)} · EVIDENCE` : `${(horizon.date ? horizon.label : 'MASTERPLAN').toUpperCase()} · ${modeLabel}`;
  $('#scene-disclaimer').textContent = index === 0 ? 'Mapped planning geometry. Illustrative building models.'
    : state.mode === 'conservative' ? 'No future change is shown without published evidence.'
      : state.mode === 'announced_targets' ? (due.length ? `${due.length} announced ${due.length === 1 ? 'target falls' : 'targets fall'} due by this date. Not confirmed delivery.` : 'No announced calendar target falls due by this date.')
        : 'Speculative massing. No completion or occupancy prediction.';
  $('#horizon-rule').textContent = index === 0 ? 'Today shows dated evidence only.' : horizon.rule || '';
  const dueList = $('#due-list');
  dueList.innerHTML = index && state.mode === 'announced_targets' && due.length
    ? due.map((p) => `<button data-project="${escapeHTML(p.id)}">${escapeHTML(p.name)} <span>${escapeHTML(niceDate(p.announced_target.date))}</span></button>`).join('') : '';
  dueList.hidden = !dueList.innerHTML;
}

export function compareLabel() {
  const horizon = horizons[state.t];
  return `${horizon.date ? niceDate(horizon.date) : 'The vision'} · ${MODE_LABELS[state.mode].label}`;
}
