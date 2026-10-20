// 计算每个角色 normal 立绘的头部位置，写回 js/assets.js 的 face 字段
const fs = require('fs'), path = require('path');
const decode = require('./pnginfo.js');
const root = path.join(__dirname, '..');
const file = path.join(root, 'js/assets.js');
let s = fs.readFileSync(file, 'utf8');
const ids = [...s.matchAll(/^\s{4}(\w+): \{ name:/gm)].map(m => m[1]);
for (const id of ids) {
  const p = path.join(root, 'assets/ch', id + '_normal.png');
  if (!fs.existsSync(p)) continue;
  const d = decode(p), W = d.w, H = d.h, A = (x, y) => d.px[(y * W + x) * 4 + 3];
  let y0 = 0;
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x += 2) if (A(x, y) > 128) c++; if (c > 12) { y0 = y; break; } }
  let sx = 0, n = 0;
  for (let y = y0 + 80; y < y0 + 300; y++) for (let x = 0; x < W; x += 2) if (A(x, y) > 128) { sx += x; n++; }
  const child = id === 'futari';
  const face = [Math.round(sx / n), y0 + (child ? 150 : 215), child ? 300 : 360];
  s = s.replace(new RegExp(`(\\n\\s{4}${id}: \\{[^\\n]*?face: )\\[[^\\]]*\\]`), `$1[${face.join(', ')}]`);
  console.log(id, face.join(','));
}
fs.writeFileSync(file, s);
