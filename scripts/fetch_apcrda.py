"""Fetch APCRDA planning layers, reproject locally and write allowlisted site datasets.

Requests native coordinates (EPSG:32644) because many layers fail server-side reprojection,
pages through object IDs, checks every layer against the server's own feature count, and keeps
only allowlisted attributes. Unfiltered responses go to data/raw/<stamp>/ (git-ignored: some
layers carry personal fields). Usage: python scripts/fetch_apcrda.py [--only key,key]
"""
import datetime as dt
import hashlib
import json
import re
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geo  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site' / 'data'
STAMP = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
RAW = ROOT / 'data' / 'raw' / STAMP
HOST = 'https://gis.apcrda.org/server/rest/services'
SMART = 'APCRDASmartCity/SmartCityInfra/MapServer'
LPS = 'LPS_Portal/MapServer'
UA = {'User-Agent': 'AmaravatiObservatoryResearch/0.2 (civic research; contact via GitHub)'}

# key -> (service, layer ids, {output field: source field}, simplify tolerance in metres)
LAYERS = {
    'boundary': (SMART, [0], {}, 4.0),
    'zones': (SMART, [2], {'name': 'zonalname'}, 4.0),
    'bunds': (SMART, [6], {'name': 'bundnames'}, 2.0),
    'startup': (SMART, [8], {'name': 'utilitynames'}, 2.0),
    'roads': (SMART, list(range(10, 45)), {}, 1.0),
    'roadsurfaces': (SMART, list(range(46, 81)), {'width_m': 'rd_width_m', 'road': 'rd_categ_c'}, 0.8),
    'water': (SMART, [81], {'name': 'lottery', 'zoning': 'zoning'}, 1.5),
    'government': (LPS, [4], {'name': 'Name', 'layer': 'Layer'}, 0.5),
    'parcels': (LPS, [7], {'Attribute': 'Attribute', 'Category': 'Category'}, 0.3),
    'allotments': (LPS, [13], {'name': 'Name', 'category': 'Category', 'acres': 'Area_Ac', 'zoning': 'Zoning'}, 0.5),
    'allotments2019': (LPS, [8], {'name': 'Name', 'category': 'Category', 'acres': 'Area', 'order': 'G_O_No'}, 0.5),
    'landprogrammes': (LPS, [9, 10, 11, 12], {'use': 'lu_desc', 'zoning': 'zoning', 'acres': 'Area_Acres'}, 0.8),
}
PROGRAMME = {9: 'Land for monetisation', 10: 'Industrial area', 11: 'R5 zone housing', 12: 'Mortgaged to HUDCO'}
# Fields that must never reach the published site, whatever the allowlist says.
BLOCKED = re.compile(r'aadhar|farmer|owner|mobile|phone|rs_no|survey|applicat|reg_doc', re.I)
ORGANISATION = re.compile(r'societ|institut|limited|ltd|foundation|association|corporat|trust|centre|center|'
                          r'fund|academy|bank|universit|school|college|council|federation|club|hospital|'
                          r'department|authority|board|ministry|office|area|hub|park|memorial|bhavan|'
                          r'temple|church|mosque|devasthanam|mission|organi|agency|company|india|govern|'
                          r'commission|court|police|army|navy|force|station|habitat|tower|complex', re.I)


ACRONYM = re.compile(r'^[A-Z&]{3,}$')
KNOWN = {'happy nest'}  # APCRDA's own housing project


def get(url, data=None, attempts=4):
    for attempt in range(attempts):
        try:
            req = urllib.request.Request(url, data=data, headers=UA)
            with urllib.request.urlopen(req, timeout=90) as res:
                return res.read()
        except Exception:
            if attempt == attempts - 1:
                raise
            time.sleep(3 * (attempt + 1))


def query(service, layer, params):
    body = urllib.parse.urlencode({**params, 'f': 'json'}).encode()
    doc = json.loads(get(f'{HOST}/{service}/{layer}/query', body))
    if 'error' in doc:
        raise RuntimeError(f'{service}/{layer}: {doc["error"]}')
    return doc


def public_name(name, category):
    """Institution names are public record; withhold names that look like private individuals."""
    name = (name or '').strip()
    category = re.sub(r'\s+', ' ', (category or '')).strip()
    if not name:
        return None, category
    if category.lower() == 'others' and not (ORGANISATION.search(name) or ACRONYM.match(name) or name.lower() in KNOWN):
        return 'Individual allotment (name withheld)', category
    if re.search(r'residential plot for|\bplayer\b|\(\d+ ?sq ?y', name, re.I):
        return 'Individual allotment (name withheld)', category
    return name, category


def fetch_layer(service, layer):
    meta = json.loads(get(f'{HOST}/{service}/{layer}?f=json'))
    ids = sorted(query(service, layer, {'where': '1=1', 'returnIdsOnly': 'true'}).get('objectIds') or [])
    count = query(service, layer, {'where': '1=1', 'returnCountOnly': 'true'})['count']
    features, wkid = [], None
    for start in range(0, len(ids), 150):
        doc = query(service, layer, {'objectIds': ','.join(map(str, ids[start:start + 150])),
                                     'outFields': '*', 'returnGeometry': 'true'})
        if doc.get('exceededTransferLimit'):
            raise RuntimeError(f'{service}/{layer}: transfer limit exceeded')
        wkid = (doc.get('spatialReference') or {}).get('latestWkid') or (doc.get('spatialReference') or {}).get('wkid')
        features.extend(doc.get('features', []))
    if len(features) != count:
        raise RuntimeError(f'{service}/{layer}: expected {count} features, received {len(features)}')
    return meta, features, wkid, count


def to_geojson(feature, wkid, tolerance):
    project = geo.projector(wkid)
    g = feature.get('geometry') or {}
    if 'rings' in g:
        polys = []
        for poly in geo.rings_to_polygons([[tuple(p[:2]) for p in r] for r in g['rings']]):
            rings = [geo.simplify_ring(r, tolerance) for r in poly]
            if rings[0] is None:
                continue
            polys.append([[list(project(x, y)) for x, y in r] for r in rings if r])
        if not polys:
            return None
        return {'type': 'Polygon', 'coordinates': polys[0]} if len(polys) == 1 else {'type': 'MultiPolygon', 'coordinates': polys}
    if 'paths' in g:
        lines = [[list(project(x, y)) for x, y in geo.simplify([tuple(p[:2]) for p in path], tolerance)] for path in g['paths'] if len(path) > 1]
        if not lines:
            return None
        return {'type': 'LineString', 'coordinates': lines[0]} if len(lines) == 1 else {'type': 'MultiLineString', 'coordinates': lines}
    if 'x' in g:
        return {'type': 'Point', 'coordinates': list(project(g['x'], g['y']))}
    return None


def build(key):
    service, layer_ids, fields, tolerance = LAYERS[key]
    for source in fields.values():
        if BLOCKED.search(source):
            raise RuntimeError(f'{key}: blocked field {source} in allowlist')
    out, records = [], []
    for layer in layer_ids:
        meta, features, wkid, count = fetch_layer(service, layer)
        raw = json.dumps({'layer': meta, 'features': features}, ensure_ascii=False).encode('utf-8')
        (RAW / f'{key}-{layer}.json').write_bytes(raw)
        kept = 0
        for f in features:
            geometry = to_geojson(f, wkid, tolerance)
            if not geometry:
                continue
            attrs = f.get('attributes') or {}
            props = {k: (attrs.get(src).strip() if isinstance(attrs.get(src), str) else attrs.get(src)) for k, src in fields.items()}
            if key == 'roads':
                props['road'] = re.sub(r'RoadCenLine$', '', meta.get('name', ''))
            if key == 'landprogrammes':
                props['programme'] = PROGRAMME[layer]
            if 'name' in props and 'category' in props:
                props['name'], props['category'] = public_name(props['name'], props['category'])
            out.append({'type': 'Feature', 'geometry': {'type': geometry['type'], 'coordinates': geo.round_coords(geometry['coordinates'])}, 'properties': props})
            kept += 1
        records.append({'layer': layer, 'name': meta.get('name'), 'url': f'{HOST}/{service}/{layer}', 'server_count': count,
                        'received': len(features), 'published': kept, 'native_wkid': wkid,
                        'sha256_raw': hashlib.sha256(raw).hexdigest()})
        print(f'  {key}: layer {layer} {meta.get("name")} -> {kept}/{count}', flush=True)
    doc = {'type': 'FeatureCollection', 'features': out}
    (SITE / f'{key}.json').write_text(json.dumps(doc, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')
    return records


def main():
    only = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--only=')), None)
    keys = only.split(',') if only else list(LAYERS)
    RAW.mkdir(parents=True, exist_ok=True)
    SITE.mkdir(parents=True, exist_ok=True)
    manifest_path = ROOT / 'data' / 'layer-manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8')) if manifest_path.exists() else {'layers': {}}
    failures = []
    for key in keys:
        try:
            manifest['layers'][key] = {'retrieved_at': STAMP, 'licence': 'APCRDA; redistribution permission not established',
                                       'interpretation': 'Planning geometry, not as-built evidence', 'sources': build(key)}
        except Exception as e:  # keep the previous published file and manifest entry
            failures.append(f'{key}: {e}')
            print(f'  FAILED {key}: {e}', flush=True)
    manifest['updated_at'] = STAMP
    manifest_path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding='utf-8')
    if failures:
        print('Failures:\n' + '\n'.join(failures))
        sys.exit(1)


if __name__ == '__main__':
    main()
