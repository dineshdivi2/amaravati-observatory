# Amaravati: data and evidence brief

> **Update, 12 October 2026 (0.2):** The coverage counts below are from the first snapshot and have been superseded.
> - All 35 road layers now download. The earlier failures were server-side reprojection errors, fixed by reprojecting locally.
> - The 300-building sample has been replaced by full OSM coverage inside the capital boundary.
> - Added land allotments, land programmes, road polygons, bunds, the Krishna river, land use, roads and rail.
>
> Current counts are in `data/layer-manifest.json`, `data/osm-manifest.json` and `site/data/stats.json`.

Checked 12 October 2026. This pack establishes the starting geography and a major-project watchlist for a cinematic city explorer. It separates published claims from observed physical progress and leaves missing measurements null.

Validation result: 27 official GIS GeoJSON files, 516 planning features, 18 major project groups and 26 source references. A separate OSM sample contains 300 closed building polygons. This sample has **zero height tags and zero floor-count tags**. All downloaded polygon coordinates were checked for longitude/latitude range; this is structural validation, not a positional-accuracy survey.

Road coverage is partial: 19 of 35 attempted centreline sublayers returned usable data. The other 16 returned errors or timed out. The first wide OSM request timed out and its partial payload was retained as failed evidence; only the successful capped core sample is converted for use.

## What we have acquired

Local APCRDA snapshots include government-complex and seed-capital boundaries, government land-use polygons, housing/building planning parcels and the February 2025 allotment layer. The housing layer contains labels including Assembly, SEC-HOD, Judicial Complex, MLA/MLC housing and GO/NGO housing. **These are development parcels, not established individual-building footprints.** Its `Level` values such as `FAR 03` are zoning attributes. Metadata advertises Z and M coordinates; the downloaded 2D export strips these because their meaning and validity are unverified.

The public SmartCityInfra service exposes a capital boundary, separate E/N road-centreline layers and a blue-network layer. Downloaded geometry is WGS84 longitude/latitude; the original service uses UTM Zone 44N (EPSG:32644). Refer to `data/gis-inventory.json` for actual successful downloads and bounds. Selected layer failures and recovery attempts are retained. Some infrastructure catalog access returns **499 Token Required**; authenticated areas were not accessed.

Sources: [LPS GIS](https://gis.apcrda.org/server/rest/services/LPS_Portal/MapServer), [SmartCityInfra](https://gis.apcrda.org/server/rest/services/APCRDASmartCity/SmartCityInfra/MapServer).

## Latest evidence worth showing

| Project | Supported statement | Evidence date | Limitation |
|---|---|---|---|
| Secretariat / Assembly | Structural work reported in progress | 13 Sep 2026 | No measured completion percentage |
| Seed Access Road | Road and bridge inauguration reported | 13 Aug 2026 | Opening relates to a phase; extension separate |
| MLA / MLC housing | Complex handover reported | 13 Aug 2026 | Handover is separate from confirmed occupancy |
| ORR | Four tender packages reported | 2–3 Oct 2026 | Procurement is separate from works or opening |
| Railway | Package 4 tender reported | 4 Oct 2026 | Primary tender still needed |
| Quantum Valley | Construction supported by IBM; operation target reported | 7 Feb / 4 Oct 2026 | Target is 3 Feb 2027, not verified future delivery |
| Capital program | Broader completion target reported as Oct 2028 | 10 Oct 2026 | No guarantee the full city is finished then |

[Capital works report](https://www.deccanchronicle.com/southern-states/andhra-pradesh/cm-pushes-for-speedy-amaravati-capital-works-1987300) describes 119 major projects, 113 approved and 97 started, including four completed. Treat these as the reported review totals, not our independently audited project inventory. [Road/housing report](https://www.deccanchronicle.com/southern-states/andhra-pradesh/naidu-inaugurates-seed-access-road-bridge-connecting-amaravati-1978818) distinguishes the opening from a later extension.

[Rail package reporting](https://telugu.oneindia.com/news/andhra-pradesh/amaravati-railway-development-tenders-for-package-4-of-errupalem-namburu-railway-line-at-rs-599-cro-509181.html) needs comparison with the [official original approval](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2067967&lang=2&reg=48); reported project lengths differ by document and scope. Do not silently merge them. ORR tender IDs to retrieve: `2026_NHAI_293148_1`, `293150_1`, `293151_1`, `293153_1`. The government search index exposed package 2, but its session link expired when opened. [Discovery register](https://www.pedaparimi.com/infrastructure/outer-ring-road-tenders), [news corroboration](https://www.andhrajyothy.com/2026/andhra-pradesh/nhai-invites-tenders-for-amaravati-outer-ring-road-1563703.html).

[IBM](https://www.ibm.com/quantum/blog/quantum-education-india) confirms the Quantum Valley construction initiative. [October operations reporting](https://www.theweek.in/news/biz-tech/2026/10/04/andhra-pradesh-quantum-computing-launch.html) supplies the announced launch target. [Latest review](https://timesofindia.indiatimes.com/city/vijayawada/polls-to-be-deferred-in-amaravati-villages-under-land-pooling-narayana/amp_articleshow/134857896.cms) supplies the broader October 2028 target.

Official [AGICL listings](https://www.agicl.org/) provide additional watchlist evidence for High Court and tower services, housing amenities, Quantum twin towers, IRR DPR updating and riverfront consultancy. [APCRDA tenders](https://crda.ap.gov.in/APCRDAV2/Views/NotificationsView.aspx) include cooling and hotel-plot procurement. These entries support procurement status only.

## Can we obtain real 3D buildings?

| Dataset | Role | Acquisition / readiness |
|---|---|---|
| APCRDA planning parcels | Landmark placement, land use and camera framing | Downloaded; individual-building geometry and heights unverified |
| OSM building ways | Existing building footprints | 300-way core sample downloaded; no height/floor tags; not exhaustive |
| Overture buildings / parts | Additional footprints, optional height/floor data | Schema reviewed; local coverage and payload not acquired |
| APCRDA BIM system | Potential route to official architectural models | System description found; public IFC/GLB download not found |
| Architect / authority drawings | Landmark shape references | References identified; drawings, version and reuse rights unresolved |
| Copernicus DEM | Regional terrain context | Not acquired; 30m access requires checking current registration rights |
| Sentinel-2 | Dated area-scale construction context | Not acquired; 10m bands cannot resolve facade details |
| Licensed drone imagery / survey | Detailed geometry and textures | Would need an authorized capture or licensed supplier |

[Overture schema](https://docs.overturemaps.org/schema/reference/buildings/building/) represents footprints with optional height/floor/part fields; missing heights must stay missing. [BIM portal](https://uat.bbas.ap.gov.in/) describes GIS-based model approval, which does not imply that applicants' models are open. [OSM licence](https://www.openstreetmap.org/copyright/en?locale=en-GB), [Sentinel-2 specification](https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2), [current DEM access](https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM.html).

We can reconstruct recognisable simplified landmarks using verified references and label them as reconstructions. Photorealistic appearance alone cannot establish architectural or temporal accuracy. No detailed GLB, IFC, LiDAR or photogrammetric city mesh has been acquired in this phase.

## Future-view policy

- **Today — 12 Oct 2026:** show dated evidence; old photographs retain capture dates and unknowns remain visible.
- **Six months — 12 Apr 2027:** an illustrative progression scenario, tied to named targets where available.
- **One year — 12 Oct 2027:** the same rule; no blanket completion or occupancy assumption.
- **Two years — 12 Oct 2028:** show the reported capital-program target as a target, not a delivered skyline.
- **Long-term masterplan:** separate planning vision from near-term construction and funded projects.

Use discrete construction stages only where evidence supports them. Unknown progress stays unknown. A scenario can vary timing assumptions, but is not a calibrated prediction or an engineering simulation.

## Remaining collection work

1. Retrieve and review current contract packages, drawings, revised schedules and corrigenda.
2. Build a dated-photo register with capture date, exact project, location and media permission.
3. Obtain verified landmark dimensions, floors and footprints; do not extrude whole parcels as buildings.
4. Inspect OSM/Overture coverage and check open geometry against parcel outlines.
5. Resolve mapping and imagery redistribution before public hosting.
6. Extend the watchlist to individual education, healthcare, private-development and regional airport projects using primary operator evidence. Keep the capital city and surrounding region distinct.

## Tracking workflow

Collectors save dated raw snapshots and SHA-256 hashes. Compare successive snapshots, review changed tender entries and documents, then append sourced milestones. The project registry has separate `evidence_date`, `checked_on`, `announced_target`, `physical_progress_pct`, `observed_height_m` and `model_file` fields. A page retrieval date never becomes a construction event date. Recurring scheduling and automated extraction are not implemented yet.
