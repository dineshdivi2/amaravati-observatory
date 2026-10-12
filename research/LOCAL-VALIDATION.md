# Local site verification — 12 October 2026 (0.2)

Local URL: http://127.0.0.1:4267/ (`npm start`).

## Automated checks

- `python scripts/build_site.py --check` passes. It covers:
  - curated registry references (every source, target, milestone, funding and history entry resolves to a source)
  - date formats and confidence values
  - every project `map` spec matching at least one feature
  - property allowlists and the blocked personal-field pattern on all published geometry
  - coordinate bounds
  - the binary building file's structure
  - `stats.json` being in sync
- `node scripts/check-js.mjs` passes for all 15 site modules: syntax, plus every relative import resolving.
- The local UTM 44N → WGS84 reprojection matches server-side reprojection to within 0.1 mm (APCRDA layer 10, all vertices).
- All 35 APCRDA road-centreline layers and 35 road-polygon layers download. Every layer's received feature count equals the server's own count.

## Browser checks (desktop preview and headless Chrome)

- No console errors on load.
- The scene renders the APCRDA road grid and blue network, the OSM river, land use and roads, and the landmarks.
- Explore mode shows labels, the evidence legend and the controls.
- The deep link `#project=highcourt` opens the evidence panel with contract value, confidence badges, target history and a stale-evidence note, and flies the camera to the parcel.
- Timeline at 1 year in *Announced targets* mode marks two projects due: Officer housing (Dec 2026) and Quantum Valley (3 Feb 2027). The URL updates to `#t=2&explore=1`.
- The Land allotments toggle shows the layer and its legend.
- The ledger renders 18 rows with target chips and stale-evidence flags. The land, money and history sections render from data.

Problems found and fixed during this pass:
- **Render loop.** It was paused by `document.hidden` and by an IntersectionObserver that doesn't fire in background tabs. It now uses a cheap position check instead.
- **Faint planned-tier outlines.** Strengthened.
- **Overlapping Secretariat and Assembly labels.** Separated.

## Not measured

- No cross-device frame-rate benchmark. Adaptive quality downgrades automatically when the average frame time exceeds 32 ms.
- Building volumes and heights are illustrative where OSM has no tags.
- Future views are scenarios, not forecasts.
