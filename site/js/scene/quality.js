// Adaptive rendering quality. Starts from a device heuristic (or ?quality= / saved choice),
// samples frame times after warm-up and steps down once if the scene runs slowly.
const TIERS = {
  high: { name: 'high', pixelRatio: 1.75, shadows: 2048, trees: 9000, buildingShadows: true, antialias: true },
  medium: { name: 'medium', pixelRatio: 1.25, shadows: 1024, trees: 3500, buildingShadows: false, antialias: true },
  low: { name: 'low', pixelRatio: 1, shadows: 0, trees: 0, buildingShadows: false, antialias: false },
};
const ORDER = ['high', 'medium', 'low'];
const KEY = 'amaravati-quality';

export function initialQuality() {
  const requested = new URLSearchParams(location.search).get('quality');
  if (TIERS[requested]) return TIERS[requested];
  try { const saved = localStorage.getItem(KEY); if (TIERS[saved]) return TIERS[saved]; } catch { /* storage unavailable */ }
  const coarse = matchMedia('(pointer: coarse)').matches;
  const weak = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4;
  return TIERS[coarse || weak ? 'medium' : 'high'];
}

export const qualityTiers = () => ORDER.map((k) => TIERS[k]);
export function saveQuality(name) { try { localStorage.setItem(KEY, name); } catch { /* ignore */ } }

/** Returns a tick(deltaMs) function; calls onDowngrade(nextTier) at most twice per visit. */
export function frameMonitor(current, onDowngrade) {
  let frames = 0, total = 0, tier = current.name, warm = 90;
  return (delta) => {
    if (warm > 0) { warm--; return; }
    frames++; total += Math.min(delta, 200);
    if (frames < 120) return;
    const average = total / frames;
    frames = 0; total = 0;
    const index = ORDER.indexOf(tier);
    if (average > 32 && index < ORDER.length - 1) {
      tier = ORDER[index + 1];
      warm = 90;
      saveQuality(tier);
      onDowngrade(TIERS[tier], average);
    }
  };
}
