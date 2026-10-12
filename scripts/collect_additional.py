"""Retry small public road layers and acquire OSM building geometry for a bounded area."""
import concurrent.futures as futures
import datetime as dt
import hashlib
import json
from pathlib import Path
import urllib.parse
import urllib.request
import sys

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT/'data'/'raw'/dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
OUT.mkdir(parents=True,exist_ok=True)
BASE='https://gis.apcrda.org/server/rest/services/APCRDASmartCity/SmartCityInfra/MapServer'
def fetch(name,url,post=None):
    record={'file':name,'url':url,'retrieved_at':dt.datetime.now(dt.timezone.utc).isoformat()}
    try:
        req=urllib.request.Request(url,data=post,headers={'User-Agent':'AmaravatiObservatoryResearch/0.1'})
        with urllib.request.urlopen(req,timeout=30) as response:
            body=response.read()
        doc=json.loads(body)
        (OUT/name).write_bytes(body)
        record.update(bytes=len(body),sha256=hashlib.sha256(body).hexdigest())
        if 'error' in doc or doc.get('exceededTransferLimit') or 'remark' in doc:
            raise RuntimeError(str(doc.get('error') or doc.get('remark') or 'Truncated results'))
        record.update(state='downloaded',features=len(doc.get('features',[])))
    except Exception as e:
        record.update(state='failed',error=str(e))
    return record

records=[]
q=urllib.parse.urlencode({'where':'1=1','outFields':'*','returnGeometry':'true',
    'returnZ':'false','returnM':'false','outSR':'4326','f':'geojson'})
existing=set()
for p in (ROOT/'data'/'raw').glob('*/manifest.json'):
    for item in json.loads(p.read_text(encoding='utf-8')):
        if item.get('state')=='downloaded' and item.get('file','').endswith('.geojson') and BASE in item.get('url',''):
            existing.add(int(item['file'].split('-')[1].split('.')[0]))
with futures.ThreadPoolExecutor(max_workers=4) as pool:
    tasks=[] if '--osm-only' in sys.argv else [pool.submit(fetch,f'layer-{i}.geojson',f'{BASE}/{i}/query?{q}') for i in range(10,45) if i not in existing]
    for task in futures.as_completed(tasks):
        records.append(task.result())
query='[out:json][timeout:10][maxsize:8388608];way[building](16.48,80.48,16.55,80.55);out tags geom 300;'
record=fetch('osm-buildings.json','https://overpass-api.de/api/interpreter',urllib.parse.urlencode({'data':query}).encode())
record.update(query=query,license='ODbL 1.0; attribution OpenStreetMap contributors',coverage='Core bounding box; maximum 300 building ways, not complete city coverage')
records.append(record)
(OUT/'manifest.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
print(json.dumps({'snapshot':str(OUT),'success':sum(r['state']=='downloaded' for r in records),
 'failures':[r for r in records if r['state']=='failed']},indent=2))
