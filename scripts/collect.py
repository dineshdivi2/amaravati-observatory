"""Download bounded public evidence snapshots; never overwrites earlier runs."""
import concurrent.futures as futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request
import sys

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://gis.apcrda.org/server/rest/services/LPS_Portal/MapServer'
SMART = '--smart' in sys.argv or '--roads' in sys.argv
if SMART:
    BASE = 'https://gis.apcrda.org/server/rest/services/APCRDASmartCity/SmartCityInfra/MapServer'
STAMP = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
OUT = ROOT / 'data' / 'raw' / STAMP
OUT.mkdir(parents=True, exist_ok=True)

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'AmaravatiObservatoryResearch/0.1'})
    with urllib.request.urlopen(req, timeout=50) as response:
        return response.read()

def save(name, url):
    try:
        body = get(url)
        (OUT / name).write_bytes(body)
        record = {'file': name, 'url': url, 'retrieved_at': STAMP,
                'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body), 'state': 'downloaded'}
        if name.endswith('.json'):
            parsed = json.loads(body)
            if isinstance(parsed, dict) and 'error' in parsed:
                record.update(state='api_error', error=parsed['error'])
        return record
    except Exception as e:
        return {'file': name, 'url': url, 'retrieved_at': STAMP, 'state': 'failed', 'error': str(e)}

def layer(layer_id):
    url = f'{BASE}/{layer_id}'
    meta = save(f'layer-{layer_id}.json', url + '?f=pjson')
    result = [meta]
    try:
        ids_url = url + '/query?' + urllib.parse.urlencode({'where': '1=1', 'returnIdsOnly': 'true', 'f': 'json'})
        id_body = get(ids_url)
        ids_response = json.loads(id_body)
        (OUT / f'layer-{layer_id}-ids.json').write_bytes(id_body)
        if 'error' in ids_response:
            raise RuntimeError(str(ids_response['error']))
        ids = ids_response.get('objectIds', [])
        features = []
        for start in range(0, len(ids), 300):
            q = urllib.parse.urlencode({'objectIds': ','.join(map(str, ids[start:start+300])),
                'outFields': '*', 'returnGeometry': 'true', 'returnZ': 'false',
                'returnM': 'false', 'outSR': '4326', 'f': 'geojson'})
            data = json.loads(get(url + '/query?' + q))
            if 'error' in data or data.get('exceededTransferLimit'):
                raise RuntimeError('Query failed or truncated: ' + str(data.get('error')))
            features.extend(data.get('features', []))
        if len(features) != len(ids):
            raise RuntimeError(f'Expected {len(ids)} features, received {len(features)}')
        body = json.dumps({'type': 'FeatureCollection', 'features': features}, ensure_ascii=False).encode('utf-8')
        name = f'layer-{layer_id}.geojson'
        (OUT / name).write_bytes(body)
        result.append({'file': name, 'url': url + '/query', 'retrieved_at': STAMP,
            'sha256': hashlib.sha256(body).hexdigest(), 'bytes': len(body),
            'features': len(features), 'state': 'downloaded', 'crs': 'EPSG:4326',
            'license': 'CRDA copyright; redistribution permission not established',
            'interpretation': 'Planning geometry; not asserted to be as-built features or current construction'})
    except Exception as e:
        result.append({'file': f'layer-{layer_id}.geojson', 'url': url, 'state': 'failed', 'error': str(e)})
    return result

sources = {
    'apcrda-home.html': 'https://crda.ap.gov.in/Apcrdav2/Views/Home.aspx',
    'agicl-home.html': 'https://www.agicl.org/',
    'assccl-projects.html': 'https://assccl.ap.gov.in/ASSCCL/Projects',
    'bbas.html': 'https://uat.bbas.ap.gov.in/',
    'arcgis-catalog.json': 'https://gis.apcrda.org/server/rest/services?f=pjson',
    'lps-service.json': BASE + '?f=pjson',
}
if SMART:
    sources = {'smartcity-service.json': BASE + '?f=pjson'}
manifest = []
with futures.ThreadPoolExecutor(max_workers=4) as pool:
    tasks = [pool.submit(save, name, url) for name, url in sources.items()]
    layer_ids = list(range(10, 45)) if '--roads' in sys.argv else ([0, 81] if SMART else [3, 4, 5, 6, 7, 13])
    tasks += [pool.submit(layer, i) for i in layer_ids]
    for task in futures.as_completed(tasks):
        result = task.result()
        manifest.extend(result if isinstance(result, list) else [result])
(OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2), encoding='utf-8')
print(json.dumps({'snapshot': str(OUT), 'results': manifest}, indent=2))
