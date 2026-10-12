import { $, escapeHTML, niceDate, CATEGORIES, TIERS, tierOf, crore, targetState, evidenceAge, STALE_DAYS } from './format.js';
import { stageHTML } from './ledger.js';

const panel = $('#project-panel');
const content = $('#panel-content');
let previousFocus = null;
let data;

const confidence = (item) => (item?.confidence ? `<span class="confidence c-${escapeHTML(item.confidence)}">${escapeHTML(item.confidence)} confidence</span>` : '');

function sourceLink(id, cite = false) {
  const s = data.sourceIndex.get(id);
  if (!s) return '';
  if (cite) return `<a class="cite" href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(s.title)}">source ↗</a>`;
  return `<a class="source-link" href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer">${escapeHTML(s.title)} ↗<span>${escapeHTML(s.kind.replaceAll('_', ' '))}${s.published_on ? ` · ${escapeHTML(niceDate(s.published_on))}` : ''}</span></a>`;
}

function factsHTML(p) {
  const rows = [];
  if (p.contractor) rows.push(`<div><dt>Contractor / agency</dt><dd>${escapeHTML(p.contractor.value)} ${confidence(p.contractor)} ${sourceLink(p.contractor.source_id, true)}</dd></div>`);
  if (p.value) rows.push(`<div><dt>Value</dt><dd><b>${crore(p.value.inr_crore)}</b> <small>${escapeHTML(p.value.measures)}</small> ${confidence(p.value)} ${sourceLink(p.value.source_id, true)}${p.value.note ? `<small class="fact-note">${escapeHTML(p.value.note)}</small>` : ''}</dd></div>`);
  for (const alt of p.value_alternates || []) rows.push(`<div class="alt"><dt>Other reported figure</dt><dd>${crore(alt.inr_crore)} <small>${escapeHTML(alt.measures)}</small> ${confidence(alt)} ${sourceLink(alt.source_id, true)}</dd></div>`);
  return rows.length ? `<span class="detail-label">CONTRACTS AND MONEY</span><dl class="facts">${rows.join('')}</dl>` : '';
}

function targetsHTML(p) {
  const history = [...(p.target_history || [])].sort((a, b) => String(a.announced_on).localeCompare(String(b.announced_on)));
  if (!history.length && !p.announced_target) return '';
  const state = targetState(p, data.projects.as_of);
  const verdict = { met: 'Delivery reported on or before this target.', passed: 'This target date has passed without reported delivery.', due: 'Reported target. Delivery has not been confirmed.', text: 'Stated as a duration, not a calendar date.' }[state] || '';
  const moved = history.length > 1 ? `<p class="panel-context">This target has been announced ${history.length} times.</p>` : '';
  return `<span class="detail-label">ANNOUNCED TARGETS</span>${p.announced_target ? `<div class="target-date">${escapeHTML(niceDate(p.announced_target.date))}</div><p class="panel-context">${verdict}</p>` : ''}${moved}
    ${history.length ? `<ol class="target-history">${history.map((t) => `<li><span>${escapeHTML(niceDate(t.announced_on))}</span><b>→ ${escapeHTML(niceDate(t.target))}</b>${t.note ? `<small>${escapeHTML(t.note)}</small>` : ''} ${confidence(t)} ${sourceLink(t.source_id, true)}</li>`).join('')}</ol>` : ''}`;
}

function milestonesHTML(p) {
  const items = [...(p.milestones || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));
  if (!items.length) return '';
  return `<span class="detail-label">DATED MILESTONES</span><ol class="milestones">${items.map((m) => `<li><span>${escapeHTML(niceDate(m.date))}</span><p>${escapeHTML(m.event)} ${confidence(m)} ${sourceLink(m.source_id, true)}</p></li>`).join('')}</ol>`;
}

export function openPanel(project, { mapped, focus, onLocate }) {
  previousFocus = document.activeElement;
  const tier = tierOf(project);
  const age = evidenceAge(project, data.projects.as_of);
  const map = project.map;
  content.innerHTML = `<div class="eyebrow">${escapeHTML(CATEGORIES[project.category] || project.category)} / EVIDENCE FILE</div>
    <h2 id="panel-title">${escapeHTML(project.name)}</h2>
    <div class="panel-stage">${stageHTML(project)}<span class="project-date">${escapeHTML(niceDate(project.evidence_date))}</span></div>
    ${age !== null && age > STALE_DAYS ? `<p class="stale-note">Latest evidence is ${age} days older than this edition. Status may have moved on.</p>` : ''}
    <p>${escapeHTML(project.summary)}</p>
    <span class="detail-label">IN THE 3D STUDY</span>
    <div class="detail-measurements"><div><b>${TIERS[tier].short}</b><small>${TIERS[tier].note}</small></div><div><b>Not measured</b><small>Physical completion</small></div></div>
    ${factsHTML(project)}${targetsHTML(project)}${milestonesHTML(project)}
    <span class="detail-label">STILL TO VERIFY</span><p>${escapeHTML(project.remaining_verification)}</p>
    <span class="detail-label">FOLLOW THE SOURCES</span>${project.sources.map((id) => sourceLink(id)).join('')}
    <p class="panel-context">Evidence checked ${escapeHTML(niceDate(project.checked_on))}. This panel keeps its factual status when you change the future scenario.</p>
    ${mapped ? `<p class="panel-context">${escapeHTML(map.basis || 'Located on an APCRDA planning parcel.')} Planning geometry, not an as-built survey.</p><button class="panel-map-button" id="focus-project">Locate in the 3D study ↗</button>`
      : '<p class="panel-context">No verified site geometry is attached to this project group. It is listed without a fabricated map pin.</p>'}`;
  panel.hidden = false;
  panel.scrollTop = 0;
  $('#focus-project')?.addEventListener('click', onLocate);
  if (focus) $('#close-panel').focus({ preventScroll: true });
}

export function closePanel({ restoreFocus = true } = {}) {
  if (panel.hidden) return;
  panel.hidden = true;
  if (restoreFocus) previousFocus?.focus?.({ preventScroll: true });
}

export const panelOpen = () => !panel.hidden;

export function initPanel(appData, { onClose }) {
  data = appData;
  $('#close-panel').addEventListener('click', onClose);
  document.addEventListener('keydown', (event) => {
    if (!panelOpen()) return;
    if (event.key === 'Escape') onClose();
    if (event.key === 'Tab') {
      const elements = [...panel.querySelectorAll('button,a[href]')].filter((e) => !e.hidden);
      const first = elements[0], last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  });
}
