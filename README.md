# Amaravati Observatory

Research checkpoint: **12 October 2026**, India time. User-selected direction: **cinematic, realistic 3D city with a timeline**.

The **working local website** is in `site/`. It includes the Three.js city study, five time horizons, comparison, scene layers, an 18-group project ledger, filters, search and evidence panels. Coverage is a starter inventory of major projects, not every capital-region development. It has not been publicly deployed.

## Run the local site

Open **http://127.0.0.1:4267/** while the local server is running. The served app bundles its scripts and Three.js locally and needs no API key or CDN. Source links open external pages when selected.

To restart from PowerShell:

```powershell
node server.mjs
```

Or run `start-local.ps1` (Node first, Python fallback). Keep the terminal open and use Ctrl+C to stop. `stop-local.ps1` safely stops the recorded background server after checking its command line. If port 4267 is already serving this site, use the existing instance rather than starting another. Pass another port as a positional argument to `server.mjs` when needed.

The city is a **planning and architectural massing study**. The mapped geography is real source data; building shapes, heights, landscaping and future urban masses are illustrative. Project evidence does not change when the timeline changes.

Validated acquisition: **27 APCRDA GeoJSON files containing 516 planning features**, plus **300 OSM building footprints** in a capped core-area sample. The OSM sample has no height or floor-count tags. Of 35 road-centreline sublayers attempted, 19 returned usable geometry; 16 remain unavailable after bounded retries. These counts are data features, not construction projects or completed buildings.

## Start here

- [Research and data findings](research/DATA-BRIEF.md)
- [Visual and interaction direction](research/DESIGN-BRIEF.md)
- [Project registry](data/projects.json): 18 major project groups, evidence dates, sources, status and unresolved checks.
- [Sources](data/sources.json): 26 references, distinguishing official evidence, partner evidence, news and discovery leads.
- [Future-view rules](data/scenarios.json): six months, one year, two years and long-term planning.
- [Downloaded geometry inventory](data/gis-inventory.json): file paths, hashes, bounds, feature counts and attribute fields.
- [OSM footprint sample](data/osm-buildings-sample.geojson) and [sample metadata](data/osm-sample-metadata.json).
- `data/raw/`: local-only dated public-page and GIS snapshots; excluded from Git because unfiltered parcel attributes can contain personal information. The working site includes sanitized geometry in `site/data/`.

## Refresh and validate

From this folder, using Python 3:

```powershell
python scripts/collect.py
python scripts/collect.py --smart
python scripts/collect.py --roads
python scripts/collect_additional.py
python scripts/build_pack.py
```

Collectors require network access. They create dated directories. The last script rebuilds the manually researched registry and checks GeoJSON coordinate ranges. **It does not research new project claims automatically.** Update the curated records after source review. `collect_additional.py` retries missing road layers and requests up to 300 OSM building ways in a fixed core bounding box; it is not a full-city cadastral survey.

The collector queries object IDs and checks feature counts for ordinary layers. Direct-query retry files reject explicit transfer-limit flags, but still need count reconciliation before asserting complete layer coverage. Prior failures remain in the original manifest; recovered data gets a separate record.

Project-local development skills (`ui-ux-pro-max`, `threejs-scenes`, and `threejs-loaders`) are excluded from Git. The design brief records how their guidance was applied. They are not required to run the site.

## Current boundaries

APCRDA planning geometry is not proof of physical construction. FAR is not a floor count. No licensed detailed building GLB/IFC model has been acquired. Public access to CRDA layers does not establish redistribution permission. Preserve source attribution and resolve asset permissions before a public release.

There is no recurring automation yet. The scripts provide reproducible manual snapshots, not a live continuously updated service. The local site's research baseline remains 12 October 2026.
