"""Build a traceable starter project registry and validate collected GIS files."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
DATE = '2026-10-12'
sources = [
 ('apcrda', 'APCRDA', 'https://crda.ap.gov.in/Apcrdav2/Views/Home.aspx', 'official', None),
 ('agicl', 'AGICL tender listings', 'https://www.agicl.org/', 'official', None),
 ('tenders', 'APCRDA tender notices', 'https://crda.ap.gov.in/APCRDAV2/Views/NotificationsView.aspx', 'official', None),
 ('lps', 'APCRDA LPS GIS', 'https://gis.apcrda.org/server/rest/services/LPS_Portal/MapServer', 'official_spatial', None),
 ('smartgis', 'APCRDA SmartCityInfra GIS', 'https://gis.apcrda.org/server/rest/services/APCRDASmartCity/SmartCityInfra/MapServer', 'official_spatial', None),
 ('bbas', 'BIM approval portal', 'https://uat.bbas.ap.gov.in/', 'official_system_description', None),
 ('smartprojects', 'ASSCCL project descriptions', 'https://assccl.ap.gov.in/ASSCCL/Projects', 'official', None),
 ('review', 'Capital works review reporting', 'https://www.deccanchronicle.com/southern-states/andhra-pradesh/cm-pushes-for-speedy-amaravati-capital-works-1987300', 'news', '2026-09-13'),
 ('latest', 'Latest minister review reporting', 'https://timesofindia.indiatimes.com/city/vijayawada/polls-to-be-deferred-in-amaravati-villages-under-land-pooling-narayana/amp_articleshow/134857896.cms', 'news', '2026-10-10'),
 ('seed', 'Access road opening and housing handover reporting', 'https://www.deccanchronicle.com/southern-states/andhra-pradesh/naidu-inaugurates-seed-access-road-bridge-connecting-amaravati-1978818', 'news', '2026-08-13'),
 ('ibm', 'IBM Quantum Valley construction update', 'https://www.ibm.com/quantum/blog/quantum-education-india', 'project_partner', '2026-02-07'),
 ('quantumtarget', 'Quantum operations target reporting', 'https://www.theweek.in/news/biz-tech/2026/10/04/andhra-pradesh-quantum-computing-launch.html', 'news', '2026-10-04'),
 ('nielit', 'Quantum and AI university MoU', 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2231125&lang=1&reg=1', 'official', '2026-02-20'),
 ('rail', 'Rail line approval', 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=2067967&lang=2&reg=48', 'official', '2024-10-24'),
 ('railupdate', 'Rail package 4 tender reporting', 'https://telugu.oneindia.com/news/andhra-pradesh/amaravati-railway-development-tenders-for-package-4-of-errupalem-namburu-railway-line-at-rs-599-cro-509181.html', 'news', '2026-10-04'),
 ('orrlead', 'ORR tender register discovery lead', 'https://www.pedaparimi.com/infrastructure/outer-ring-road-tenders', 'commercial_secondary_lead', '2026-10-02'),
 ('orrnews', 'ORR tender reporting', 'https://www.andhrajyothy.com/2026/andhra-pradesh/nhai-invites-tenders-for-amaravati-outer-ring-road-1563703.html', 'news', '2026-10-03'),
 ('wb', 'World Bank financing approval', 'https://www.worldbank.org/en/news/press-release/2024/12/20/world-bank-supports-inclusive-and-sustainable-development-of-amaravati-city', 'official', '2024-12-20'),
 ('wbplan', 'World Bank city planning factsheet', 'https://www.worldbank.org/en/brief/2024/12/20/world-bank-support-for-amaravati-as-a-growth-hub-in-andhra-pradesh', 'official', '2024-12-20'),
 ('flood', 'Flood infrastructure program document', 'https://documents1.worldbank.org/curated/en/099010925161598187/pdf/P507508-34c45692-031e-4b34-a52c-db2db81ff1ac.pdf', 'official_document_search_excerpt', None),
 ('ttd', 'TTD Venkatapalem construction inspection', 'https://news.tirumala.org/ttd-jeo-reviews-construction-works-at-venkatpalem-srivari-temple-_-%E0%B0%B5%E0%B1%87%E0%B0%97%E0%B0%82%E0%B0%97%E0%B0%BE-%E0%B0%B8%E0%B0%BE%E0%B0%97%E0%B1%81%E0%B0%A4%E0%B1%81%E0%B0%A8%E0%B1%8D/', 'official', '2026-08-31'),
 ('architect', 'Foster and Partners masterplan reference', 'https://www.fosterandpartners.com/projects/amaravati-masterplan', 'architect_reference_page', None),
 ('overture', 'Building schema', 'https://docs.overturemaps.org/schema/reference/buildings/building/', 'technical_primary', None),
 ('osm', 'OSM attribution and licence', 'https://www.openstreetmap.org/copyright/en?locale=en-GB', 'technical_primary', None),
 ('sentinel', 'Sentinel-2 data specification', 'https://dataspace.copernicus.eu/data-collections/copernicus-sentinel-missions/sentinel-2', 'technical_primary', None),
 ('dem', 'DEM current access requirements', 'https://documentation.dataspace.copernicus.eu/APIs/SentinelHub/Data/DEM.html', 'technical_primary', None),
]
source_records = [dict(id=i, title=t, url=u, kind=k, published_on=d, checked_on=DATE,
    access='page_or_search_excerpt_reviewed', raw_snapshot='See data/raw manifests where downloaded') for i,t,u,k,d in sources]

def project(i, name, category, status, evidence_date, summary, refs, gap, target=None, spatial=None):
    return dict(id=i, name=name, category=category, status=status, evidence_date=evidence_date,
        checked_on=DATE, summary=summary, sources=refs, announced_target=target,
        physical_progress_pct=None, observed_height_m=None, model_file=None,
        spatial_match=spatial, remaining_verification=gap)

projects = [
 project('secretariat','Secretariat and HoD towers','government','construction_reported','2026-09-13',
  'Tower structural work is reported; official listings separately describe MEP and facade procurement.',
  ['review','agicl'], 'Latest dated site images, per-tower stages, drawings, heights and completion schedule.',
  spatial={'service':'LPS_Portal','layer':7,'attribute':'SEC-HOD','kind':'planning_parcel'}),
 project('assembly','Permanent Legislative Assembly','government','construction_reported','2026-09-13',
  'Assembly works are reported in progress; official listings include building services procurement.',
  ['review','agicl'], 'Current spire/design approval, measured progress, precise building footprint and licensed model.',
  spatial={'service':'LPS_Portal','layer':7,'attribute':'Assembly','kind':'planning_parcel'}),
 project('highcourt','Permanent High Court complex','government','procurement_evidence','2026-05-08',
  'Official listing includes MEP procurement for the permanent High Court.',
  ['agicl'], 'Current physical progress, design dimensions and revised handover date; distinguish the existing court.',
  spatial={'service':'LPS_Portal','layer':7,'attribute':'Judicial Complex','kind':'planning_parcel'}),
 project('mlahousing','MLA and MLC housing','housing','handover_reported','2026-08-13',
  'The residential complex was reported handed over to GAD.', ['seed'],
  'Primary handover document, occupancy and per-tower footprint verification.',
  spatial={'service':'LPS_Portal','layer':7,'attribute':'MLA / MLC Housing','kind':'planning_parcel'}),
 project('officerhousing','Officer and employee housing','housing','procurement_evidence','2026-06-06',
  'Amenities and services procurement appears for GO, NGO and Group D housing.', ['agicl'],
  'Track each housing package independently; one completed complex does not establish all housing completion.'),
 project('seedroad','E3 Seed Access Road','transport','partial_opening_reported','2026-08-13',
  'Road and steel bridges inaugurated; a further highway extension was described separately.', ['seed'],
  'Exact opened section, operational lanes and subsequent phase verification.',
  spatial={'service':'SmartCityInfra','layer':19,'kind':'planned_centreline'}),
 project('trunkroads','Capital road grid and utility corridors','transport','construction_reported','2026-10-10',
  'Review reporting calls for faster road and plot infrastructure work.', ['latest','smartgis'],
  'Package-level physical progress, as-built alignment and commissioning; road-map geometry is planning evidence.'),
 project('orr','Outer Ring Road','regional_transport','tendering_reported','2026-10-02',
  'Four procurement packages reported; government search indexed package 2, but the detail link expired on opening.',
  ['orrlead','orrnews'], 'Retrieve live tender documents and corrigenda using IDs; do not show an operating road.',
  spatial=None),
 project('irr','Inner Ring Road','regional_transport','dpr_consultancy_listing','2026-09-15',
  'Official listing requests revalidation and updating of the 2019 DPR.', ['agicl'],
  'Final approved alignment, awards and appointed dates; do not infer a settled route.'),
 project('railway','Errupalem-Amaravati-Namburu railway','regional_transport','tendering_reported','2026-10-04',
  'Official project approval is available; more recent package 4 tender activity is reported.', ['rail','railupdate'],
  'Primary package 4 tender, alignment and station geometry; source lengths differ and should retain their scope.'),
 project('quantum','Quantum Valley and twin office towers','technology','construction_evidence','2026-10-04',
  'IBM confirms construction began; the official corporation lists twin tower procurement. Operations date is a reported target.',
  ['ibm','agicl','quantumtarget'], 'Primary commissioning schedule, current photographs and approved building geometry.',
  target={'date':'2027-02-03','type':'reported_government_target','source':'quantumtarget'}),
 project('nielitcampus','NIELIT Quantum and AI university campus','education','mou_announced','2026-02-20',
  'PIB reports an MoU for a dedicated university campus.', ['nielit'],
  'Land handover, construction award, location and opening schedule; an MoU is not construction completion.'),
 project('floodnetwork','Flood mitigation and blue network','resilience','program_and_planning_evidence',None,
  'Program documents cover flood infrastructure; official GIS has a blue-network layer.', ['flood','smartgis'],
  'Reservoir/canal/pump package progress and commissioning; no engineering flood-safety claim from a visual.',
  spatial={'service':'SmartCityInfra','layer':81,'kind':'planning_geometry'}),
 project('districtcooling','Government complex district cooling','utilities','rfp_listed','2026-08-28',
  'APCRDA lists a PPP district-cooling RFP.', ['tenders'],
  'Current corrigenda, award and construction; published tender schedules may have changed.'),
 project('riverfront','Krishna riverfront development','public_realm','consultancy_listing','2026-04-04',
  'Official listing requests masterplan design and management consultancy.', ['agicl'],
  'Approved design, boundaries, tender award and delivery date; artistic waterfront is a scenario.'),
 project('hotels','Hotel development plots','commercial','plot_procurement_listed','2026-07-15',
  'APCRDA lists conditional plot allotments for hotel development.', ['tenders'],
  'Operator-specific land, approvals, foundation work and opening dates before showing named finished hotels.'),
 project('ttdtemple','Venkatapalem Srivari temple expansion','culture','official_inspection_reported','2026-08-31',
  'TTD published a construction inspection update.', ['ttd'],
  'Dated photos and precise expansion footprint; keep existing temple and new works separate.'),
 project('sportscity','International Sports City','sports','land_pooling_reported','2026-10-10',
  'Latest review reporting describes ongoing land pooling.', ['latest'],
  'Final boundaries, venue designs, contracts and construction; no fabricated completed stadium.'),
]
DATA.mkdir(exist_ok=True)
(DATA/'sources.json').write_text(json.dumps(source_records,indent=2),encoding='utf-8')
(DATA/'projects.json').write_text(json.dumps({'as_of':DATE,'coverage':'Starter major-project registry; not exhaustive',
    'projects':projects},indent=2),encoding='utf-8')
(DATA/'scenarios.json').write_text(json.dumps({'baseline':'2026-10-12','horizons':[
 {'date':'2027-04-12','label':'Six months','kind':'illustrative_scenario','rule':'Only evidence-linked project progression; no assigned percent complete.'},
 {'date':'2027-10-12','label':'One year','kind':'illustrative_scenario','rule':'Published milestones may be shown as targets; future operational status requires confirmation.'},
 {'date':'2028-10-12','label':'Two years','kind':'target_aligned_illustration','rule':'Broader government October 2028 target reported in latest review; not a guaranteed complete city.'},
 {'date':None,'label':'Long-term masterplan','kind':'planning_vision','rule':'Separate planned urban form from funded projects and delivery dates.'}
 ],'modes':['conservative','announced_targets','accelerated_illustration'],
 'prediction_model':None,'actual_completion_schedule':None},indent=2),encoding='utf-8')

inventory=[]
excluded=[]
for path in sorted((DATA/'raw').glob('*/*.geojson')):
    doc=json.loads(path.read_text(encoding='utf-8-sig'))
    if doc.get('type')!='FeatureCollection':
        manifest_path=path.parent/'manifest.json'
        recorded=json.loads(manifest_path.read_text()) if manifest_path.exists() else []
        failure=next((r for r in recorded if r.get('file')==path.name and r.get('state')!='downloaded'),None)
        if failure:
            excluded.append({'file':str(path.relative_to(ROOT)),'reason':failure.get('error')})
            continue
        raise ValueError(f'Invalid GeoJSON {path}')
    def positions(item):
        if item and isinstance(item[0],(int,float)):
            yield item
        else:
            for value in item:
                yield from positions(value)
    pts=[]
    for feature in doc['features']:
        geometry=feature.get('geometry')
        if geometry:
            pts.extend(positions(geometry['coordinates']))
    for p in pts:
        if not (-180<=p[0]<=180 and -90<=p[1]<=90):
            raise ValueError(f'Coordinates not longitude/latitude: {path}')
    inventory.append({'file':str(path.relative_to(ROOT)).replace('\\','/'),
        'features':len(doc['features']), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
        'bbox': [min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)] if pts else None,
        'geometry_types': sorted({f['geometry']['type'] for f in doc['features'] if f.get('geometry')}),
        'fields':sorted({k for f in doc['features'] for k in f.get('properties',{})}),
        'redistribution':'Permission not established; research snapshot only'})
(DATA/'gis-inventory.json').write_text(json.dumps(inventory,indent=2),encoding='utf-8')
(DATA/'excluded-downloads.json').write_text(json.dumps(excluded,indent=2),encoding='utf-8')
osm_summary=None
for manifest_path in sorted((DATA/'raw').glob('*/manifest.json'),reverse=True):
    records=json.loads(manifest_path.read_text(encoding='utf-8'))
    item=next((r for r in records if r.get('file')=='osm-buildings.json' and r.get('state')=='downloaded'),None)
    if not item:
        continue
    raw_path=manifest_path.parent/item['file']
    osm=json.loads(raw_path.read_text(encoding='utf-8'))
    features=[]
    skipped=[]
    for element in osm.get('elements',[]):
        coords=[[p['lon'],p['lat']] for p in element.get('geometry',[])]
        if len(coords)<4 or coords[0]!=coords[-1]:
            skipped.append(element['id'])
            continue
        if any(not(-180<=p[0]<=180 and -90<=p[1]<=90) for p in coords):
            raise ValueError('Invalid OSM coordinate')
        features.append({'type':'Feature','id':f"osm-way-{element['id']}",
            'geometry':{'type':'Polygon','coordinates':[coords]},
            'properties':{'osm_id':element['id'],'tags':element.get('tags',{}),
            'height_status':'unverified','source':'OpenStreetMap contributors'}})
    (DATA/'osm-buildings-sample.geojson').write_text(json.dumps({'type':'FeatureCollection',
        'features':features},indent=2),encoding='utf-8')
    osm_summary={'raw_file':str(raw_path.relative_to(ROOT)),'features':len(features),
        'skipped_nonclosed_ways':skipped,'coverage':item['coverage'],'query':item['query'],
        'retrieved_at':item['retrieved_at'],'osm_timestamp':osm.get('osm3s',{}).get('timestamp_osm_base'),
        'license':item['license'],'height_tags':sum('height' in f['properties']['tags'] for f in features),
        'floor_tags':sum('building:levels' in f['properties']['tags'] for f in features)}
    (DATA/'osm-sample-metadata.json').write_text(json.dumps(osm_summary,indent=2),encoding='utf-8')
    break
assert len({p['id'] for p in projects})==len(projects)
assert all(set(p['sources'])<=set(s[0] for s in sources) for p in projects)
print(json.dumps({'projects':len(projects),'sources':len(sources),'geojson_files':len(inventory),
    'features':sum(i['features'] for i in inventory),'osm_sample':osm_summary},indent=2))
