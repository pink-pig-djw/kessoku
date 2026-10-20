// 根据透明通道估算每个立绘头部位置 -> [cx, cy]
const decode = require('./pnginfo.js');
const out = {};
for (const f of process.argv.slice(2)) {
  const d = decode(f), W = d.w, H = d.h, A = (x, y) => d.px[(y * W + x) * 4 + 3];
  let y0 = 0;
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x += 2) if (A(x, y) > 128) c++; if (c > 15) { y0 = y; break; } }
  // 头部区域：顶部往下 60~260 行的不透明像素中心
  let sx = 0, n = 0;
  for (let y = y0 + 60; y < y0 + 260; y++) for (let x = 0; x < W; x += 2) if (A(x, y) > 128) { sx += x; n++; }
  out[f.split(/[\/]/).pop().replace('.png', '')] = [Math.round(sx / n), y0 + 200];
}
console.log(JSON.stringify(out));
