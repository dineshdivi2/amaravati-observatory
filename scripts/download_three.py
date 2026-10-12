"""Vendor the pinned Three.js browser runtime without a package manager."""
import io
from pathlib import Path
import tarfile
import urllib.request
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'site'/'vendor'
OUT.mkdir(parents=True,exist_ok=True)
url='https://registry.npmjs.org/three/-/three-0.184.0.tgz'
with urllib.request.urlopen(url,timeout=40) as response:
    body=response.read()
files={'package/build/three.module.js':'three.module.js',
       'package/build/three.core.js':'three.core.js',
       'package/examples/jsm/controls/OrbitControls.js':'OrbitControls.js',
       'package/LICENSE':'THREE-LICENSE.txt'}
with tarfile.open(fileobj=io.BytesIO(body),mode='r:gz') as archive:
    for member,name in files.items():
        stream=archive.extractfile(member)
        if stream is None:
            raise RuntimeError(member)
        (OUT/name).write_bytes(stream.read())
print('Vendored Three.js 0.184.0 and OrbitControls (MIT).')
