// minimal PNG decoder: prints size, color type and alpha stats of corners/edges
const fs = require('fs'), zlib = require('zlib');
function decode(file) {
  const b = fs.readFileSync(file);
  let p = 8, w, h, ct, bd, idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p), type = b.toString('ascii', p + 4, p + 8), data = b.slice(p + 8, p + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); bd = data[8]; ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    p += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = { 2: 3, 6: 4, 0: 1, 4: 2 }[ct];
  const stride = w * bpp, out = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.slice(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? out[y * stride + x - bpp] : 0, up = y ? out[(y - 1) * stride + x] : 0, c = (x >= bpp && y) ? out[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += up; else if (f === 3) v += (a + up) >> 1;
      else if (f === 4) { const pp = a + up - c, pa = Math.abs(pp - a), pb = Math.abs(pp - up), pc = Math.abs(pp - c); v += (pa <= pb && pa <= pc) ? a : pb <= pc ? up : c; }
      out[y * stride + x] = v & 255;
    }
  }
  return { w, h, ct, bpp, px: out };
}
module.exports = decode;
if (require.main === module) {
  for (const f of process.argv.slice(2)) {
    const d = decode(f);
    let s = `${f.split('/').pop()}: ${d.w}x${d.h} ct=${d.ct}`;
    if (d.bpp === 4) {
      let transparent = 0, total = d.w * d.h;
      for (let i = 3; i < d.px.length; i += 4) if (d.px[i] < 10) transparent++;
      const at = (x, y) => d.px[(y * d.w + x) * 4 + 3];
      s += ` corners alpha=${at(0,0)},${at(d.w-1,0)},${at(0,d.h-1)},${at(d.w-1,d.h-1)} transparent=${(transparent/total*100).toFixed(1)}%`;
    }
    console.log(s);
  }
}
