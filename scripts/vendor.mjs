// Copy the pinned Three.js build and add-ons from node_modules into site/vendor.
// Bare 'three' imports are rewritten to a relative path so the page needs no inline import map.
import { cpSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
const pkg = path.resolve('node_modules/three');
const out = path.resolve('site/vendor');
mkdirSync(out, { recursive: true });
for (const file of ['three.module.min.js', 'three.core.min.js']) cpSync(path.join(pkg, 'build', file), path.join(out, file));
cpSync(path.join(pkg, 'LICENSE'), path.join(out, 'THREE-LICENSE.txt'));
const addons = ['controls/OrbitControls.js', 'objects/Sky.js', 'utils/BufferGeometryUtils.js'];
for (const addon of addons) {
  const source = readFileSync(path.join(pkg, 'examples/jsm', addon), 'utf8').replaceAll(/from '(three)'/g, "from './three.module.min.js'");
  writeFileSync(path.join(out, path.basename(addon)), source);
}
console.log(`Vendored three@${JSON.parse(readFileSync(path.join(pkg, 'package.json'), 'utf8')).version}: ${addons.length} add-ons`);
