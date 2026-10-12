// Syntax-check every site module and confirm each relative import resolves to a file.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
const files = [];
const walk = (dir) => readdirSync(dir).forEach((f) => { const p = path.join(dir, f); statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') && files.push(p); });
walk('site/js');
let failed = 0;
for (const file of files) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); } catch (e) { failed++; console.error(`${file}: ${e.stderr}`); }
  for (const [, spec] of readFileSync(file, 'utf8').matchAll(/(?:from|import\()\s*'(\.[^']+)'/g)) {
    if (!existsSync(path.resolve(path.dirname(file), spec))) { failed++; console.error(`${file}: missing import ${spec}`); }
  }
}
console.log(`${files.length} modules checked, ${failed} problems`);
process.exit(failed ? 1 : 0);
