// "The land and the money": allotments, land programmes, funding lines and capital history.
import { $, escapeHTML, niceDate, plural } from './format.js';
import { ALLOTMENT_GROUPS, PROGRAMME_COLOURS, allotmentGroup } from './scene/overlays.js';

const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
const acres = (n) => `${Math.round(n).toLocaleString('en-IN')} ac`;

function barList(rows, { unit = acres, swatches = {} } = {}) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return `<ol class="bar-list">${rows.map((r) => `<li tabindex="0" title="${escapeHTML(`${r.label}: ${unit(r.value)}${r.detail ? ` · ${r.detail}` : ''}`)}">
    <span class="bar-label">${swatches[r.label] ? `<i class="swatch" style="--swatch:${swatches[r.label]}"></i>` : ''}${escapeHTML(r.label)}</span>
    <span class="bar-track"><span class="bar" style="--w:${((r.value / max) * 100).toFixed(1)}%"></span></span>
    <span class="bar-value">${escapeHTML(unit(r.value))}</span></li>`).join('')}</ol>`;
}

function sumBy(features, keyOf) {
  const totals = new Map();
  for (const f of features) { const key = keyOf(f); totals.set(key, (totals.get(key) || 0) + (Number(f.properties.acres) || 0)); }
  return [...totals].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

export function renderInsights({ allotments, allotments2019, landprogrammes, funding, history, sourceIndex, onShowLayer }) {
  const cite = (id) => { const s = sourceIndex.get(id); return s ? `<a class="cite" href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(s.title)}">source ↗</a>` : ''; };
  const features = allotments.features;
  const total = features.reduce((s, f) => s + (Number(f.properties.acres) || 0), 0);
  const before = allotments2019.features.reduce((s, f) => s + (Number(f.properties.acres) || 0), 0);
  const swatches = Object.fromEntries(ALLOTMENT_GROUPS.map(([name, , c]) => [name, hex(c)]));
  const byGroup = sumBy(features, (f) => allotmentGroup(f.properties.category)[0]);
  const top = [...features].filter((f) => !String(f.properties.name).startsWith('Individual')).sort((a, b) => (b.properties.acres || 0) - (a.properties.acres || 0)).slice(0, 8);
  const programmes = sumBy(landprogrammes.features, (f) => f.properties.programme);
  const progSwatches = Object.fromEntries(Object.entries(PROGRAMME_COLOURS).map(([k, c]) => [k, hex(c)]));

  $('#land-insights').innerHTML = `
    <article class="insight">
      <div class="insight-head"><span class="eyebrow">LAND ALLOTMENTS · APCRDA, FEB 2025</span><b class="hero-number">${acres(total)}</b><p>${plural(features.length, 'allotment')} to institutions, companies and agencies. The pre-2019 layer lists ${plural(allotments2019.features.length, 'allotment')} covering ${acres(before)}.</p></div>
      <h3>Allotted area by allottee group</h3>${barList(byGroup, { swatches })}
      <h3>Largest named allotments</h3>
      <table class="mini-table"><thead><tr><th scope="col">Allottee</th><th scope="col">Group</th><th scope="col" class="num">Area</th></tr></thead><tbody>
      ${top.map((f) => `<tr><td>${escapeHTML(f.properties.name)}</td><td>${escapeHTML(f.properties.category)}</td><td class="num">${acres(f.properties.acres)}</td></tr>`).join('')}</tbody></table>
      <button class="text-button" data-layer-show="allotments">Show allotments on the map <span>↗</span></button>
      <p class="fine">Allotment is a land decision, not construction. Two individual residential allotments are counted but their names are withheld.</p>
    </article>
    <article class="insight">
      <div class="insight-head"><span class="eyebrow">LAND PROGRAMMES · APCRDA GIS</span><b class="hero-number">${acres(programmes.reduce((s, r) => s + r.value, 0))}</b><p>Land the authority has mapped for monetisation, as loan security, for R5-zone housing and for industry.</p></div>
      <h3>Mapped area by programme</h3>${barList(programmes, { swatches: progSwatches })}
      <button class="text-button" data-layer-show="programmes">Show land programmes on the map <span>↗</span></button>
      <p class="fine">Areas are the authority's recorded acreage per parcel. Programmes can overlap.</p>
    </article>
    <article class="insight">
      <div class="insight-head"><span class="eyebrow">FUNDING LINES · AS REPORTED</span><b class="hero-number">${funding.lines.length}</b><p>Major financing lines, each with its status and date. Approval is not disbursement.</p></div>
      <ul class="funding">${funding.lines.map((l) => `<li><b>${escapeHTML(l.lender)}</b><span>${escapeHTML(l.currency === 'INR' ? `₹${Number(l.amount).toLocaleString('en-IN')} ${l.unit}` : `${l.currency} ${Number(l.amount).toLocaleString('en-IN')} ${l.unit}`)}</span><small>${escapeHTML(l.status)} · ${escapeHTML(niceDate(l.as_of, 'undated'))} · ${escapeHTML(l.confidence)} confidence ${cite(l.source_id)}</small></li>`).join('')}</ul>
    </article>`;
  $('#land-insights').addEventListener('click', (event) => {
    const button = event.target.closest('[data-layer-show]');
    if (button) onShowLayer(button.dataset.layerShow);
  });

  const events = [...history.events].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  $('#history-list').innerHTML = events.map((e) => `<li><time>${escapeHTML(niceDate(e.date))}</time><p>${escapeHTML(e.event)} ${cite(e.source_id)}</p></li>`).join('');
}
