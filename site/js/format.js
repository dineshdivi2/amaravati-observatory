// Labels, dates and evidence rules shared by the ledger, panel, timeline and scene.
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
export const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

export const STATUSES = {
  construction_reported: 'Construction reported', procurement_evidence: 'Procurement evidence',
  handover_reported: 'Handover reported', partial_opening_reported: 'Partial opening reported',
  tendering_reported: 'Tendering reported', dpr_consultancy_listing: 'DPR consultancy listed',
  construction_evidence: 'Construction evidence', mou_announced: 'MoU announced',
  program_and_planning_evidence: 'Programme / planning evidence', rfp_listed: 'RFP listed',
  consultancy_listing: 'Consultancy listed', plot_procurement_listed: 'Plot procurement listed',
  official_inspection_reported: 'Official inspection', land_pooling_reported: 'Land pooling reported',
};
export const CATEGORIES = {
  government: 'Government', housing: 'Housing', transport: 'Mobility', regional_transport: 'Regional mobility',
  technology: 'Technology', education: 'Education', resilience: 'Water & resilience', utilities: 'Utilities',
  public_realm: 'Public realm', commercial: 'Commerce', culture: 'Culture', sports: 'Sports',
};
export const FILTERS = {
  government: (p) => p.category === 'government',
  transport: (p) => ['transport', 'regional_transport'].includes(p.category),
  housing: (p) => p.category === 'housing',
  other: (p) => !['government', 'housing', 'transport', 'regional_transport'].includes(p.category),
};

// The three visual classes from the design brief. Each status maps to exactly one.
export const TIERS = {
  site: { label: 'Work reported on site', short: 'On site', note: 'Solid geometry' },
  planned: { label: 'Procured or planned', short: 'Planned', note: 'Outlined geometry' },
  illustrative: { label: 'Illustrative scenario', short: 'Illustrative', note: 'Translucent geometry' },
};
const SITE_STATUSES = new Set(['construction_reported', 'construction_evidence', 'handover_reported', 'partial_opening_reported', 'official_inspection_reported']);
export const tierOf = (project) => (SITE_STATUSES.has(project.status) ? 'site' : 'planned');
export const isDelivered = (project) => ['handover_reported', 'partial_opening_reported'].includes(project.status);

export const STALE_DAYS = 120;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Parse YYYY, YYYY-MM or YYYY-MM-DD. Returns {date, precision} or null for free text. */
export function parseDate(value) {
  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(String(value ?? '').trim());
  if (!match) return null;
  const [, y, m, d] = match;
  // Compare a partial date at the end of its period: "2027-12" is due by 31 Dec 2027.
  const date = d ? new Date(Date.UTC(+y, +m - 1, +d)) : m ? new Date(Date.UTC(+y, +m, 0)) : new Date(Date.UTC(+y, 11, 31));
  return { date, precision: d ? 'day' : m ? 'month' : 'year', y: +y, m: m ? +m : null, d: d ? +d : null };
}

export function niceDate(value, empty = 'Date not established') {
  if (!value) return empty;
  const parsed = parseDate(value);
  if (!parsed) return String(value);
  if (parsed.precision === 'year') return String(parsed.y);
  if (parsed.precision === 'month') return `${MONTHS[parsed.m - 1]} ${parsed.y}`;
  return `${parsed.d} ${MONTHS[parsed.m - 1]} ${parsed.y}`;
}

export const daysBetween = (a, b) => Math.round((b - a) / 86400000);

export function evidenceAge(project, asOf) {
  const parsed = parseDate(project.evidence_date);
  if (!parsed) return null;
  return daysBetween(parsed.date, parseDate(asOf).date);
}

/** Target state relative to the edition date: 'met', 'passed', 'due' or 'text' (not a calendar date). */
export function targetState(project, asOf) {
  const target = project.announced_target;
  if (!target?.date) return null;
  const parsed = parseDate(target.date);
  if (!parsed) return 'text';
  if (isDelivered(project)) return 'met';
  return parsed.date < parseDate(asOf).date ? 'passed' : 'due';
}

export const crore = (value) => `₹${Number(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })} cr`;
export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
export const upperDate = (value) => niceDate(value).toUpperCase();
