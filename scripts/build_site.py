"""Copy curated data into site/data, regenerate stats.json and validate everything the site reads.

  python scripts/build_site.py          # build + validate
  python scripts/build_site.py --check  # validate only; fails if site/data is out of date (CI)

Curated, human-reviewed files live in data/: projects.json, sources.json, scenarios.json,
history.json, funding.json. Geometry in site/data/ comes from fetch_apcrda.py and fetch_osm.py.
"""
import json
import re
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA, SITE = ROOT / 'data', ROOT / 'site' / 'data'
CURATED = ['projects', 'sources', 'scenarios', 'history', 'funding']
GEO = {  # dataset -> allowed property keys
    'boundary': set(), 'zones': {'name'}, 'bunds': {'name'}, 'startup': {'name'}, 'roads': {'road'},
    'roadsurfaces': {'width_m', 'road'}, 'water': {'name', 'zoning'}, 'government': {'name', 'layer'},
    'parcels': {'Attribute', 'Category'}, 'allotments': {'name', 'category', 'acres', 'zoning'},
    'allotments2019': {'name', 'category', 'acres', 'order'}, 'landprogrammes': {'use', 'zoning', 'acres', 'programme'},
    'river': {'kind', 'name'}, 'landuse': {'kind', 'name'}, 'osmroads': {'kind', 'name'},
}
STATUSES = {'construction_reported', 'procurement_evidence', 'handover_reported', 'partial_opening_reported', 'tendering_reported',
            'dpr_consultancy_listing', 'construction_evidence', 'mou_announced', 'program_and_planning_evidence', 'rfp_listed',
            'consultancy_listing', 'plot_procurement_listed', 'official_inspection_reported', 'land_pooling_reported'}
CONFIDENCE = {'high', 'medium', 'low'}
DATE = re.compile(r'^\d{4}(-\d{2}(-\d{2})?)?$')
BLOCKED = re.compile(r'aadhar|farmer|owner|mobile|phone|rs_no|survey|applicat|reg_doc', re.I)
BOUNDS = (80.2, 80.9, 16.2, 16.8)
errors = []


def fail(message):
    errors.append(message)


def load(path):
    return json.loads(path.read_text(encoding='utf-8'))


def walk(coords):
    if coords and isinstance(coords[0], (int, float)):
        yield coords
    else:
        for c in coords:
            yield from walk(c)


def check_date(value, where, allow_text=False):
    if value is None:
        return
    if not DATE.match(str(value)) and not allow_text:
        fail(f'{where}: bad date {value!r}')


def validate_curated(c, geo):
    source_ids = [s['id'] for s in c['sources']]
    if len(source_ids) != len(set(source_ids)):
        fail('sources: duplicate ids')
    for s in c['sources']:
        if not str(s.get('url', '')).startswith(('https://', 'http://')):
            fail(f'source {s["id"]}: url missing')
        check_date(s.get('published_on'), f'source {s["id"]}')
    known = set(source_ids)
    ref = lambda sid, where: sid in known or fail(f'{where}: unknown source {sid}')
    ids = [p['id'] for p in c['projects']['projects']]
    if len(ids) != len(set(ids)):
        fail('projects: duplicate ids')
    for p in c['projects']['projects']:
        w = f'project {p["id"]}'
        for key in ('name', 'category', 'status', 'summary', 'sources', 'remaining_verification', 'checked_on'):
            if not p.get(key):
                fail(f'{w}: missing {key}')
        if p.get('status') not in STATUSES:
            fail(f'{w}: unknown status {p.get("status")}')
        check_date(p.get('evidence_date'), w)
        check_date(p.get('checked_on'), w)
        for sid in p.get('sources', []):
            ref(sid, w)
        for key in ('contractor', 'value'):
            if p.get(key):
                ref(p[key]['source_id'], f'{w} {key}')
        for item in p.get('value_alternates', []):
            ref(item['source_id'], f'{w} value_alternates')
        for item in p.get('target_history', []) + p.get('milestones', []):
            ref(item['source_id'], f'{w} history')
            if item.get('confidence') not in CONFIDENCE:
                fail(f'{w}: confidence {item.get("confidence")}')
            check_date(item.get('date') or item.get('announced_on'), w)
        target = p.get('announced_target')
        if target:
            ref(target['source'], f'{w} announced_target')
            check_date(target.get('date'), f'{w} target', allow_text=True)
        spec = p.get('map')
        if spec:
            if spec['dataset'] not in geo:
                fail(f'{w}: map dataset {spec["dataset"]} missing')
            elif not matches(spec, geo):
                fail(f'{w}: map spec matches no features')
    for e in c['history']['events']:
        ref(e['source_id'], 'history')
        check_date(e['date'], 'history')
    for line in c['funding']['lines']:
        ref(line['source_id'], 'funding')
    for h in c['scenarios']['horizons']:
        check_date(h.get('date'), 'scenarios')


def matches(spec, geo):
    def ok(f):
        return all((f['properties'].get(k) in v) if isinstance(v, list) else f['properties'].get(k) == v for k, v in spec.get('where', {}).items())
    found = [f for f in geo[spec['dataset']]['features'] if ok(f)]
    if not found and spec.get('fallback'):
        return matches(spec['fallback'], geo)
    return found


def validate_geo(geo):
    for name, allowed in GEO.items():
        doc = geo.get(name)
        if doc is None:
            fail(f'site/data/{name}.json missing')
            continue
        before = len(errors)
        for i, f in enumerate(doc['features']):
            keys = set(f['properties'])
            if keys - allowed:
                fail(f'{name}[{i}]: properties not allowlisted: {sorted(keys - allowed)}')
            if any(BLOCKED.search(k) for k in keys):
                fail(f'{name}[{i}]: blocked personal field')
            for lon, lat in walk(f['geometry']['coordinates']):
                if not (BOUNDS[0] <= lon <= BOUNDS[1] and BOUNDS[2] <= lat <= BOUNDS[3]):
                    fail(f'{name}[{i}]: coordinate out of range {lon},{lat}')
                    break
        if len(errors) - before > 3:  # keep the first three examples per dataset
            extra = len(errors) - before - 3
            del errors[before + 3:]
            fail(f'{name}: {extra} more similar problems')


def buildings_info():
    path = SITE / 'buildings.bin'
    if not path.exists():
        fail('site/data/buildings.bin missing')
        return None
    raw = path.read_bytes()
    if raw[:4] != b'AOB1':
        fail('buildings.bin: bad magic')
        return None
    count = struct.unpack_from('<I', raw, 4)[0]
    offset, levels, heights = 8, 0, 0
    for _ in range(count):
        n, lv, dm = struct.unpack_from('<BBH', raw, offset)
        levels += lv > 0
        heights += dm > 0
        offset += 4 + n * 4
    if offset != len(raw):
        fail(f'buildings.bin: length mismatch ({offset} != {len(raw)})')
    return {'in_capital_boundary': count, 'with_levels_tag': levels, 'with_height_tag': heights, 'bytes': len(raw)}


def stats(c, geo, buildings):
    layer_manifest = load(DATA / 'layer-manifest.json') if (DATA / 'layer-manifest.json').exists() else {'layers': {}}
    osm = load(DATA / 'osm-manifest.json') if (DATA / 'osm-manifest.json').exists() else {}
    layers = {name: {'features': len(doc['features'])} for name, doc in geo.items()}
    for name, entry in layer_manifest.get('layers', {}).items():
        if name in layers:
            layers[name]['layers'] = len(entry['sources'])
            layers[name]['retrieved_at'] = entry['retrieved_at']
    if buildings and osm.get('buildings', {}).get('partial'):
        buildings['partial'] = True  # some OSM tiles were not downloaded yet
    target = c['projects'].get('capital_target') or {}
    retrieved = [e['retrieved_at'] for e in layer_manifest.get('layers', {}).values()]
    stamp = max(retrieved) if retrieved else None
    return {
        'edition': c['projects']['as_of'], 'projects': len(c['projects']['projects']), 'sources': len(c['sources']),
        'mapped_projects': sum(1 for p in c['projects']['projects'] if p.get('map')),
        'capital_target_year': int(str(target['date'])[:4]) if target.get('date') else None,
        'gis_retrieved': f'{stamp[:4]}-{stamp[4:6]}-{stamp[6:8]}' if stamp else None,
        'osm_base': osm.get('osm_base'), 'osm_retrieved': osm.get('retrieved_at'),
        'buildings': buildings, 'layers': layers,
    }


def main():
    check = '--check' in sys.argv
    curated = {name: load(DATA / f'{name}.json') for name in CURATED}
    geo = {name: load(SITE / f'{name}.json') for name in GEO if (SITE / f'{name}.json').exists()}
    validate_geo(geo)
    validate_curated(curated, geo)
    buildings = buildings_info()
    built = stats(curated, geo, buildings)
    outputs = {f'{name}.json': curated[name] for name in CURATED}
    outputs['stats.json'] = built
    for file, value in outputs.items():
        text = json.dumps(value, separators=(',', ':'), ensure_ascii=False)
        target = SITE / file
        if check:
            if not target.exists() or json.loads(target.read_text(encoding='utf-8')) != value:
                fail(f'site/data/{file} is out of date; run python scripts/build_site.py')
        elif not errors:
            target.write_text(text, encoding='utf-8')
    if errors:
        print('\n'.join(f'ERROR {e}' for e in errors))
        sys.exit(1)
    print(json.dumps({k: built[k] for k in ('edition', 'projects', 'sources', 'mapped_projects', 'buildings')}, indent=1))
    print('OK' + (' (check only)' if check else ''))


if __name__ == '__main__':
    main()
