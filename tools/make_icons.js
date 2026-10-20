// 生成安卓 app 的图标（一里的脸）和启动画面（标题图）
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const sharp = require(path.join(root, 'app', 'node_modules', 'sharp'));
const res = path.join(root, 'app', 'android', 'app', 'src', 'main', 'res');
const BG = '#1d2033';

(async () => {
  // 一里 smile 立绘的脸（face = [中心 x, 中心 y, 裁切边长]，见 assets.js）
  const [cx, cy, size] = [592, 240, 380];
  const face = await sharp(path.join(root, 'assets/ch/bocchi_smile.png'))
    .extract({ left: cx - size / 2, top: cy - size / 2 + 10, width: size, height: size }).png().toBuffer();
  const circle = s => Buffer.from(`<svg width="${s}" height="${s}"><circle cx="${s / 2}" cy="${s / 2}" r="${s / 2}" fill="#fff"/></svg>`);
  const rounded = s => Buffer.from(`<svg width="${s}" height="${s}"><rect width="${s}" height="${s}" rx="${s * 0.22}" fill="#fff"/></svg>`);
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(res, 'mipmap-' + d);
    // 自适应图标的前景：108dp 画布，脸放在中间约 70% 的范围里（系统会裁成圆形或圆角方形）
    const fg = Math.round(108 * k), fs_ = Math.round(fg * 0.7);
    const faceFg = await sharp(face).resize(fs_, fs_).toBuffer();
    await sharp({ create: { width: fg, height: fg, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: faceFg, left: Math.round((fg - fs_) / 2), top: Math.round((fg - fs_) / 2) }]).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
    // 旧版图标：深蓝底 + 脸
    const s = Math.round(48 * k), fz = Math.round(s * 0.92);
    const faceS = await sharp(face).resize(fz, fz).toBuffer();
    const base = () => sharp({ create: { width: s, height: s, channels: 4, background: BG } })
      .composite([{ input: faceS, left: Math.round((s - fz) / 2), top: Math.round((s - fz) / 2) + Math.round(s * 0.04) }]);
    const sq = await base().png().toBuffer();
    await sharp(sq).composite([{ input: rounded(s), blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(sq).composite([{ input: circle(s), blend: 'dest-in' }]).png().toFile(path.join(dir, 'ic_launcher_round.png'));
  }
  fs.writeFileSync(path.join(res, 'values', 'ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">${BG}</color>\n</resources>\n`);
  // 启动画面：标题图，压暗一点
  const dirs = fs.readdirSync(res).filter(d => d.startsWith('drawable'));
  for (const d of dirs) {
    const f = path.join(res, d, 'splash.png'); if (!fs.existsSync(f)) continue;
    const m = await sharp(f).metadata();
    const buf = await sharp(path.join(root, 'assets/cg/title.png')).resize(m.width, m.height, { fit: 'cover' }).modulate({ brightness: 0.75 }).png().toBuffer();
    fs.writeFileSync(f, buf);
  }
  console.log('icons + splash done');
})();
