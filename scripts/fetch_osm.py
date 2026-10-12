"""Fetch OpenStreetMap context for the capital: river, buildings, land use, roads and rail.

Writes compact site datasets plus data/osm-manifest.json. Buildings are packed into a small
binary file (see BUILDING FORMAT below) because the capital region has tens of thousands.
OSM data is (c) OpenStreetMap contributors, ODbL 1.0. Usage: python scripts/fetch_osm.py
"""
import datetime as dt
import json
import math
import struct
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import geo  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site' / 'data'
ENDPOINTS = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass-api.de/api/interpreter',
             'https://overpass.private.coffee/api/interpreter', 'https://overpass.kumi.systems/api/interpreter']
UA = {'User-Agent': 'AmaravatiObservatoryResearch/0.2 (civic research; contact via GitHub)'}
# Scene origin and local metric frame; must match site/js/scene/geo.js.
LON0, LAT0, MX, MZ = 80.49, 16.53, 106740.0, 111320.0
WIDE = (16.36, 80.34, 16.66, 80.70)  # south, west, north, east: river and landscape backdrop
LANDUSE = ('farmland|residential|construction|industrial|commercial|retail|forest|orchard|meadow|grass|'
           'plantation|village_green|cemetery|brownfield|greenfield|quarry|institutional|education|religious')
NATURAL = 'wood|scrub|grassland|wetland|sand|heath'
ROAD_CLASSES = ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'unclassified', 'residential',
                'motorway_link', 'trunk_link', 'primary_link', 'secondary_link', 'tertiary_link')
stats = {}
MINOR = {'residential', 'unclassified'}
FROM_CACHE = '--from-cache' in sys.argv  # build buildings.bin from cached tiles only


def overpass(query, timeout=180, attempts=8):
    body = urllib.parse.urlencode({'data': f'[out:json][timeout:{timeout}];{query}'}).encode()
    last = None
    for attempt in range(attempts):
        endpoint = ENDPOINTS[attempt % len(ENDPOINTS)]
        try:
            req = urllib.request.Request(endpoint, data=body, headers=UA)
            with urllib.request.urlopen(req, timeout=timeout + 30) as res:
                doc = json.loads(res.read())
            if doc.get('remark') and 'error' in doc['remark'].lower():
                raise RuntimeError(doc['remark'])
            stats['osm_base'] = doc.get('osm3s', {}).get('timestamp_osm_base')
            return doc['elements']
        except Exception as e:  # busy servers answer with HTML or remarks; rotate and back off
            last = e
            print(f'    retry {attempt + 1} after {endpoint.split("/")[2]}: {str(e)[:80]}', flush=True)
            time.sleep(5 + 5 * attempt)
    raise RuntimeError(f'Overpass failed: {last}')


def local(lon, lat):
    return (lon - LON0) * MX, (lat - LAT0) * MZ


def lonlat(x, z):
    return x / MX + LON0, z / MZ + LAT0


def clip(ring, box):
    """Sutherland-Hodgman clip of a closed ring against a (minx, minz, maxx, maxz) rectangle."""
    minx, minz, maxx, maxz = box
    pts = ring[:-1]
    for inside, cut in (
        (lambda p: p[0] >= minx, lambda a, b: (minx, a[1] + (b[1] - a[1]) * (minx - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= maxx, lambda a, b: (maxx, a[1] + (b[1] - a[1]) * (maxx - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= minz, lambda a, b: (a[0] + (b[0] - a[0]) * (minz - a[1]) / (b[1] - a[1]), minz)),
        (lambda p: p[1] <= maxz, lambda a, b: (a[0] + (b[0] - a[0]) * (maxz - a[1]) / (b[1] - a[1]), maxz)),
    ):
        out = []
        for i, cur in enumerate(pts):
            prev = pts[i - 1]
            if inside(cur):
                if not inside(prev):
                    out.append(cut(prev, cur))
                out.append(cur)
            elif inside(prev):
                out.append(cut(prev, cur))
        pts = out
        if not pts:
            return None
    return pts + [pts[0]] if len(pts) >= 3 else None


def polygons_from(element):
    """OSM way or multipolygon relation -> list of polygons (rings in local metres)."""
    if element['type'] == 'way':
        ring = [local(p['lon'], p['lat']) for p in element.get('geometry', [])]
        return [[ring]] if len(ring) >= 4 and ring[0] == ring[-1] else []
    outer = [[local(p['lon'], p['lat']) for p in m.get('geometry', [])] for m in element.get('members', []) if m['type'] == 'way' and m.get('role') != 'inner']
    inner = [[local(p['lon'], p['lat']) for p in m.get('geometry', [])] for m in element.get('members', []) if m['type'] == 'way' and m.get('role') == 'inner']
    polys = [[r] for r in geo.stitch(outer)]
    for hole in geo.stitch(inner):
        owner = next((p for p in polys if geo.point_in_ring(hole[0], p[0])), None)
        if owner:
            owner.append(hole)
    return polys


def to_feature(polys, props, box, tolerance):
    out = []
    for poly in polys:
        rings = []
        for i, ring in enumerate(poly):
            ring = clip(ring, box) if box else ring
            ring = geo.simplify_ring(ring, tolerance) if ring else None
            if ring:
                rings.append([list(lonlat(x, z)) for x, z in ring])
            elif i == 0:
                break
        if rings:
            out.append(rings)
    if not out:
        return None
    geometry = {'type': 'Polygon', 'coordinates': out[0]} if len(out) == 1 else {'type': 'MultiPolygon', 'coordinates': out}
    geometry['coordinates'] = geo.round_coords(geometry['coordinates'])
    return {'type': 'Feature', 'geometry': geometry, 'properties': props}


def bbox_str(b):
    return ','.join(map(str, b))


def write(name, features):
    (SITE / name).write_text(json.dumps({'type': 'FeatureCollection', 'features': features}, separators=(',', ':'), ensure_ascii=False), encoding='utf-8')


def box_local(b):
    (x0, z0), (x1, z1) = local(b[1], b[0]), local(b[3], b[2])
    return (x0, z0, x1, z1)


def river():
    elements = overpass(f'(relation[natural=water][water~"river|canal|lake|reservoir|pond"]({bbox_str(WIDE)});'
                        f'way[natural=water]({bbox_str(WIDE)});way[waterway=riverbank]({bbox_str(WIDE)}););out tags bb;')
    keep = [e for e in elements if e['type'] == 'way' or (e['bounds']['maxlon'] - e['bounds']['minlon'] < 1.5)]
    ids = {'relation': [e['id'] for e in keep if e['type'] == 'relation'], 'way': [e['id'] for e in keep if e['type'] == 'way']}
    parts = []
    if ids['relation']:
        parts.append(f'relation(id:{",".join(map(str, ids["relation"]))});')
    if ids['way']:
        parts.append(f'way(id:{",".join(map(str, ids["way"]))});')
    full = overpass(f'({"".join(parts)});out tags geom;')
    features = []
    for e in full:
        kind = e['tags'].get('water') or ('river' if e['tags'].get('waterway') == 'riverbank' else 'pond')
        f = to_feature(polygons_from(e), {'kind': kind, 'name': e['tags'].get('name')}, box_local(WIDE), 2.0 if kind == 'river' else 1.0)
        if f:
            features.append(f)
    write('river.json', features)
    stats['river'] = {'features': len(features), 'river_polygons': sum(f['properties']['kind'] == 'river' for f in features)}


def capital_ring():
    boundary = json.loads((SITE / 'boundary.json').read_text(encoding='utf-8'))
    geometry = boundary['features'][0]['geometry']
    ring = geometry['coordinates'][0] if geometry['type'] == 'Polygon' else geometry['coordinates'][0][0]
    return [local(lon, lat) for lon, lat in ring]


# BUILDING FORMAT (little-endian): b'AOB1', uint32 count, then per building:
#   uint8 vertex count n (ring without the closing vertex), uint8 levels (0 = untagged),
#   uint16 height in decimetres (0 = untagged), n x (int16 east, int16 north) in 0.5 m units from the origin.
def buildings():
    ring = capital_ring()
    south, west, north, east = 16.40, 80.40, 16.60, 80.62
    tiles, step = [], 0.05
    lat = south
    while lat < north:
        lon = west
        while lon < east:
            tiles.append((round(lat, 3), round(lon, 3), round(min(lat + step, north), 3), round(min(lon + step, east), 3)))
            lon += step
        lat += step
    seen, records = set(), []
    tagged_levels = tagged_height = 0
    missing = []
    cache = ROOT / 'data' / 'raw' / 'osm-building-tiles'  # git-ignored; makes interrupted runs resumable
    cache.mkdir(parents=True, exist_ok=True)

    def fetch_tile(tile, depth=0):
        path = cache / f'{bbox_str(tile)}.json'
        if path.exists():
            return json.loads(path.read_text(encoding='utf-8'))
        if FROM_CACHE:  # pack what is cached, looking into split sub-tiles; never hit the network
            if depth >= 3:
                missing.append(bbox_str(tile))
                return []
            s, w, n, e = tile
            ms, mw = round((s + n) / 2, 4), round((w + e) / 2, 4)
            return [x for sub in ((s, w, ms, mw), (s, mw, ms, e), (ms, w, n, mw), (ms, mw, n, e)) for x in fetch_tile(sub, depth + 1)]
        try:
            elements = overpass(f'way[building]({bbox_str(tile)});out tags geom;', timeout=120, attempts=4)
        except RuntimeError:
            if depth >= 3:
                raise
            s, w, n, e = tile  # dense or busy: split into quarters and retry each
            ms, mw = round((s + n) / 2, 4), round((w + e) / 2, 4)
            print(f'    splitting tile {bbox_str(tile)}', flush=True)
            elements = []
            for sub in ((s, w, ms, mw), (s, mw, ms, e), (ms, w, n, mw), (ms, mw, n, e)):
                elements += fetch_tile(sub, depth + 1)
        path.write_text(json.dumps(elements), encoding='utf-8')
        return elements

    if '--reverse' in sys.argv:  # a second worker can fill the shared tile cache from the other end
        tiles.reverse()
    for i, tile in enumerate(tiles):
        elements = fetch_tile(tile)
        for e in elements:
            if e['id'] in seen or len(e.get('geometry', [])) < 4:
                continue
            seen.add(e['id'])
            pts = [local(p['lon'], p['lat']) for p in e['geometry']]
            cx = sum(p[0] for p in pts[:-1]) / (len(pts) - 1)
            cz = sum(p[1] for p in pts[:-1]) / (len(pts) - 1)
            if not geo.point_in_ring((cx, cz), ring):
                continue
            pts = geo.simplify(pts, 0.35)
            if pts[0] == pts[-1]:
                pts = pts[:-1]
            if len(pts) < 3:
                continue
            if len(pts) > 255:
                pts = pts[:255]
            tags = e.get('tags', {})
            levels = parse_number(tags.get('building:levels'))
            height = parse_number(tags.get('height'))
            tagged_levels += bool(levels)
            tagged_height += bool(height)
            records.append((pts, min(int(levels or 0), 255), min(int((height or 0) * 10), 65535)))
        print(f'  buildings tile {i + 1}/{len(tiles)}: {len(records)} kept', flush=True)
        time.sleep(1)
    with open(SITE / 'buildings.bin', 'wb') as out:
        out.write(b'AOB1' + struct.pack('<I', len(records)))
        for pts, levels, height in records:
            out.write(struct.pack('<BBH', len(pts), levels, height))
            out.write(struct.pack(f'<{len(pts) * 2}h', *[max(-32768, min(32767, round(v * 2))) for p in pts for v in p]))
    stats['buildings'] = {'partial': bool(missing), 'missing_tiles': len(missing), 'in_capital_boundary': len(records), 'with_levels_tag': tagged_levels, 'with_height_tag': tagged_height,
                          'format': 'AOB1 binary; see scripts/fetch_osm.py'}


def parse_number(value):
    try:
        return float(str(value).split(';')[0].replace('m', '').strip()) if value else None
    except ValueError:
        return None


def inside_runs(pts, box):
    minx, minz, maxx, maxz = box
    runs, run = [], []
    for x, z in pts:
        if minx <= x <= maxx and minz <= z <= maxz:
            run.append((x, z))
        else:
            if len(run) >= 2:
                runs.append(run)
            run = []
    if len(run) >= 2:
        runs.append(run)
    return runs


def landuse():
    b = (16.40, 80.38, 16.61, 80.63)
    elements = overpass(f'(way[landuse~"^({LANDUSE})$"]({bbox_str(b)});relation[landuse~"^({LANDUSE})$"]({bbox_str(b)});'
                        f'way[natural~"^({NATURAL})$"]({bbox_str(b)});relation[natural~"^({NATURAL})$"]({bbox_str(b)}););out tags geom;')
    features = []
    for e in elements:
        tags = e.get('tags', {})
        props = {'kind': tags.get('landuse') or tags.get('natural'), 'name': tags.get('name')}
        f = to_feature(polygons_from(e), props, box_local(b), 1.5)
        if f:
            features.append(f)
    write('landuse.json', features)
    kinds = {}
    for f in features:
        kinds[f['properties']['kind']] = kinds.get(f['properties']['kind'], 0) + 1
    stats['landuse'] = {'features': len(features), 'by_kind': kinds}


def lines():
    b = (16.38, 80.36, 16.63, 80.66)
    elements = overpass(f'(way[highway~"^({"|".join(ROAD_CLASSES)})$"]({bbox_str(b)});way[railway=rail]({bbox_str(b)}););out tags geom;')
    features = []
    ring = capital_ring()
    box = box_local(b)
    for e in elements:
        tags = e.get('tags', {})
        pts = geo.simplify([local(p['lon'], p['lat']) for p in e.get('geometry', [])], 2.0)
        if len(pts) < 2:
            continue
        kind = 'rail' if tags.get('railway') == 'rail' else tags['highway'].replace('_link', '')
        # Minor streets only inside the capital; major roads and rail across the wider backdrop.
        if kind in MINOR and not geo.point_in_ring(pts[len(pts) // 2], ring):
            continue
        props = {'kind': kind}
        if kind not in MINOR and (tags.get('name') or tags.get('ref')):
            props['name'] = tags.get('name') or tags.get('ref')
        for run in inside_runs(pts, box):  # Overpass returns whole ways; keep only the parts in the box
            features.append({'type': 'Feature', 'geometry': {'type': 'LineString', 'coordinates': geo.round_coords([list(lonlat(x, z)) for x, z in run], 5)}, 'properties': props})
    write('osmroads.json', features)
    kinds = {}
    for f in features:
        kinds[f['properties']['kind']] = kinds.get(f['properties']['kind'], 0) + 1
    stats['osmroads'] = {'features': len(features), 'by_kind': kinds}


def main():
    SITE.mkdir(parents=True, exist_ok=True)
    steps = {'river': river, 'landuse': landuse, 'lines': lines, 'buildings': buildings}
    only = next((a.split('=', 1)[1].split(',') for a in sys.argv if a.startswith('--only=')), list(steps))
    path = ROOT / 'data' / 'osm-manifest.json'
    for name in only:
        print(f'{name}...', flush=True)
        steps[name]()
    manifest = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}  # re-read: steps may run separately
    manifest.update(stats)
    manifest.update({'retrieved_at': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'),
                     'licence': 'ODbL 1.0; (c) OpenStreetMap contributors', 'origin': [LON0, LAT0]})
    path.write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding='utf-8')
    print(json.dumps(stats, indent=1))


if __name__ == '__main__':
    main()
