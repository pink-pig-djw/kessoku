// copies generated images for a batch into assets/<folder>/<id>.png
// primary: JSON map in tools/out/<batch>.json ; fallback: images in the codex session folder, in creation order
const fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..');
const b = process.argv[2];
const folder = { bg: 'bg', ch: 'ch', cg: 'cg', ui: 'ui' };
function dest(id) {
  const prefix = id.split('_')[0];
  return path.join(root, 'assets', folder[prefix] || 'misc', id.slice(prefix.length + 1) + '.png');
}
function validPng(f) {
  try { const buf = fs.readFileSync(f); return buf.length > 1000 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47; } catch (e) { return false; }
}
const bodyFile = path.join(__dirname, 'prompts', b + '.body.txt');
const promptFile = fs.existsSync(bodyFile) ? bodyFile : path.join(__dirname, 'prompts', b + '.txt');
const ids = [...fs.readFileSync(promptFile, 'utf8').matchAll(/id "([^"]+)"/g)].map(x => x[1]);
let map = null;
try {
  const txt = fs.readFileSync(path.join(__dirname, 'out', b + '.json'), 'utf8');
  const m = txt.match(/\{[\s\S]*\}/);
  if (m) map = JSON.parse(m[0]);
  if (map && map.error) { console.log(`[${b}] codex reported: ${map.error}`); map = null; }
} catch (e) { }
if (!map || !Object.keys(map).length) {
  const log = fs.readFileSync(path.join(__dirname, 'out', b + '.log'), 'utf8');
  const sid = (log.match(/session id: ([0-9a-f-]+)/) || [])[1];
  const dir = path.join(os.homedir(), '.codex', 'generated_images', sid || 'none');
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => path.join(dir, f)).sort((x, y) => fs.statSync(x).mtimeMs - fs.statSync(y).mtimeMs) : [];
  console.log(`[${b}] no JSON map; fallback session ${sid} with ${files.length} images for ${ids.length} ids`);
  map = {}; ids.forEach((id, i) => { if (files[i]) map[id] = files[i]; });
}
let ok = 0;
for (const [id, src] of Object.entries(map)) {
  const d = dest(id);
  fs.mkdirSync(path.dirname(d), { recursive: true });
  if (!validPng(src)) { console.log('  BAD  ' + id + ' (invalid png: ' + src + ')'); continue; }
  fs.copyFileSync(src, d); ok++; console.log('  ok  ' + id + ' -> ' + path.relative(root, d));
}
const missing = ids.filter(id => !map[id]);
if (missing.length) console.log('  MISSING: ' + missing.join(', '));
console.log(`[${b}] ${ok}/${ids.length} collected`);
