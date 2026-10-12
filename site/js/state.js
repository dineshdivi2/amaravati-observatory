// Application state mirrored into the URL hash, so any view can be shared or reloaded.
// Example: #project=quantum&t=2&mode=announced_targets&compare=1&filter=government&q=tower
const DEFAULTS = { project: null, t: 0, mode: 'announced_targets', compare: false, filter: 'all', sort: 'ledger', q: '', explore: false };
const listeners = new Set();
export const state = { ...DEFAULTS };

function parse(hash) {
  const text = hash.replace(/^#/, '');
  if (!text.includes('=')) return null; // plain section anchors such as #progress
  const params = new URLSearchParams(text);
  return {
    project: params.get('project') || null,
    t: Math.max(0, Number.parseInt(params.get('t') ?? '0', 10) || 0),
    mode: params.get('mode') || DEFAULTS.mode,
    compare: params.get('compare') === '1',
    filter: params.get('filter') || DEFAULTS.filter,
    sort: params.get('sort') || DEFAULTS.sort,
    q: params.get('q') || '',
    explore: params.get('explore') === '1' || params.has('project'),
  };
}

function serialise() {
  const params = new URLSearchParams();
  if (state.project) params.set('project', state.project);
  if (state.t) params.set('t', String(state.t));
  if (state.mode !== DEFAULTS.mode) params.set('mode', state.mode);
  if (state.compare) params.set('compare', '1');
  if (state.filter !== 'all') params.set('filter', state.filter);
  if (state.sort !== 'ledger') params.set('sort', state.sort);
  if (state.q) params.set('q', state.q);
  if (state.explore && !state.project) params.set('explore', '1');
  const text = params.toString();
  return text ? `#${text}` : location.pathname + location.search;
}

export function setState(patch, { push = false } = {}) {
  const changed = Object.keys(patch).filter((key) => state[key] !== patch[key]);
  if (!changed.length) return;
  Object.assign(state, patch);
  history[push ? 'pushState' : 'replaceState'](null, '', serialise());
  listeners.forEach((fn) => fn(changed));
}

export const onState = (fn) => listeners.add(fn);

export function initState({ horizons, modes }) {
  const clamp = (s) => ({ ...s, t: Math.min(s.t, horizons - 1), mode: modes.includes(s.mode) ? s.mode : DEFAULTS.mode });
  const initial = parse(location.hash);
  if (initial) Object.assign(state, clamp(initial));
  addEventListener('popstate', () => {
    const next = parse(location.hash);
    const patch = clamp(next || DEFAULTS);
    const changed = Object.keys(patch).filter((key) => state[key] !== patch[key]);
    Object.assign(state, patch);
    if (changed.length) listeners.forEach((fn) => fn(changed));
  });
}
