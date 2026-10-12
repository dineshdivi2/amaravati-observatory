"""Prepare minimal, allowlisted browser datasets from the research snapshots."""
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'site'/'data'
OUT.mkdir(parents=True,exist_ok=True)
def read(name):
    return json.loads((ROOT/name).read_text(encoding='utf-8-sig'))
def clean_geo(name,keys):
    data=read(name)
    def coords(value):
        if value and isinstance(value[0],(int,float)):
            return value[:2]
        return [coords(v) for v in value]
    return {'type':'FeatureCollection','features':[{'type':'Feature','geometry':
        {'type':f['geometry']['type'],'coordinates':coords(f['geometry']['coordinates'])},
        'properties':{k:f['properties'].get(k) for k in keys}} for f in data['features'] if f.get('geometry')]}
def write(name,value):
    (OUT/name).write_text(json.dumps(value,separators=(',',':'),ensure_ascii=False),encoding='utf-8')
write('projects.json',read('data/projects.json'))
write('sources.json',read('data/sources.json'))
write('scenarios.json',read('data/scenarios.json'))
write('parcels.json',clean_geo('data/raw/20261012T093801Z/layer-7-retry.geojson',['Attribute','Category']))
write('government.json',clean_geo('data/raw/20261012T093801Z/layer-4.geojson',['Layer','Name']))
write('boundary.json',clean_geo('data/raw/20261012T094053Z/layer-0.geojson',[]))
write('water.json',clean_geo('data/raw/20261012T094053Z/layer-81.geojson',['lottery']))
write('footprints.json',clean_geo('data/osm-buildings-sample.geojson',['osm_id','height_status']))
roads=[]
for item in read('data/gis-inventory.json'):
    if 'LineString' in ','.join(item['geometry_types']):
        roads.extend(clean_geo(item['file'],[])['features'])
write('roads.json',{'type':'FeatureCollection','features':roads})
print(f'Prepared {len(roads)} road features; no ownership or personal parcel fields included.')
