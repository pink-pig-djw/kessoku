// 把游戏打包进 app/www（给 Capacitor 安卓 app 用）
// - 图片 PNG → WebP（体积大约缩到 1/6），剧本和引擎里的 .png 引用一起改成 .webp
// - 去掉在线字体（app 要能离线运行；国内也连不上 Google Fonts）
// 用法：cd app && npm run build   （或 node tools/build_app.js）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const www = path.join(root, 'app', 'www');
const sharp = require(path.join(root, 'app', 'node_modules', 'sharp'));

const rm = p => fs.rmSync(p, { recursive: true, force: true });
const mk = p => fs.mkdirSync(p, { recursive: true });
function copyDir(src, dst, filter = () => true) {
  mk(dst);
  for (const f of fs.readdirSync(src)) {
    const s = path.join(src, f), d = path.join(dst, f);
    if (fs.statSync(s).isDirectory()) copyDir(s, d, filter); else if (filter(f)) fs.copyFileSync(s, d);
  }
}

(async () => {
  rm(www); mk(www);
  // 页面：去掉在线字体
  let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  html = html.replace(/<link rel="preconnect"[^>]*>\s*/g, '').replace(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis[^>]*>\s*/g, '');
  fs.writeFileSync(path.join(www, 'index.html'), html);
  // 代码和剧本：.png → .webp
  for (const dir of ['css', 'js', 'script']) {
    mk(path.join(www, dir));
    for (const f of fs.readdirSync(path.join(root, dir))) {
      let s = fs.readFileSync(path.join(root, dir, f), 'utf8');
      if (dir !== 'script') s = s.replace(/\.png\b/g, '.webp');
      fs.writeFileSync(path.join(www, dir, f), s);
    }
  }
  // 音乐原样复制
  copyDir(path.join(root, 'assets', 'bgm'), path.join(www, 'assets', 'bgm'), f => f.endsWith('.mp3'));
  // 图片转 WebP
  let before = 0, after = 0, n = 0;
  for (const [dir, opt] of [['bg', { quality: 82 }], ['cg', { quality: 84 }], ['ch', { quality: 88, alphaQuality: 92 }]]) {
    const src = path.join(root, 'assets', dir), dst = path.join(www, 'assets', dir); mk(dst);
    const files = fs.readdirSync(src).filter(f => f.endsWith('.png'));
    await Promise.all(files.map(async f => {
      const out = path.join(dst, f.replace(/\.png$/, '.webp'));
      await sharp(path.join(src, f)).webp({ ...opt, effort: 5 }).toFile(out);
      before += fs.statSync(path.join(src, f)).size; after += fs.statSync(out).size; n++;
    }));
  }
  const mb = b => (b / 1048576).toFixed(1) + 'MB';
  let bgm = 0; fs.readdirSync(path.join(www, 'assets', 'bgm')).forEach(f => bgm += fs.statSync(path.join(www, 'assets', 'bgm', f)).size);
  console.log(`images: ${n} files ${mb(before)} -> ${mb(after)}; bgm ${mb(bgm)}; www total ≈ ${mb(after + bgm)}`);
})();
