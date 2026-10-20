// 模拟画面状态，统计立绘覆盖率
const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/src="(script\/[^"]+)"/g)].map(m => m[1]);
const SPK = { '汐音': 'shion', '夏帆': 'kaho', '凛': 'rin', '宫下老师': 'touko', '透子': 'touko', '外公': 'genzou' };
let total = 0, withVis = 0, dlg = 0, dlgOk = 0;
const missing = [];
const perFile = {};
for (const f of files) {
  const lines = fs.readFileSync(path.join(root, f), 'utf8').split(/\r?\n/);
  let sprites = new Set(), cg = false, mode = 'normal', label = '';
  const pf = perFile[f] = { total: 0, vis: 0, dlg: 0, ok: 0 };
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('//') || l.startsWith('>') || l.startsWith('SCRIPTS') || l.startsWith('`')) return;
    if (l.startsWith('*')) { label = l.slice(1); return; }
    if (l.startsWith('@')) {
      const [c, ...a] = l.slice(1).split(/\s+/);
      if (c === 'bg' && !a.includes('keep')) sprites = new Set();
      if (c === 'show') sprites.add(a[0]);
      if (c === 'hide') { if (!a[0] || a[0] === 'all') sprites = new Set(); else sprites.delete(a[0]); }
      if (c === 'cg') cg = a[0] !== 'off';
      if (c === 'chapter') { sprites = new Set(); cg = false; }
      if (c === 'mode') mode = a[0];
      return;
    }
    const m = l.match(/^([^\s：「]{1,10})：(.+)$/);
    total++; pf.total++;
    const vis = sprites.size > 0 || cg;
    if (vis) { withVis++; pf.vis++; }
    if (m && SPK[m[1]] && mode === 'normal') {
      dlg++; pf.dlg++;
      if (sprites.has(SPK[m[1]]) || cg) { dlgOk++; pf.ok++; }
      else missing.push(`${f}:${i + 1} [${label}] ${m[1]}：${m[2].slice(0, 24)}`);
    }
  });
}
const pct = (a, b) => (100 * a / b).toFixed(0) + '%';
console.log(`all lines with a character/CG on screen: ${pct(withVis, total)} (${withVis}/${total})`);
console.log(`character dialogue with that character visible: ${pct(dlgOk, dlg)} (${dlgOk}/${dlg})`);
for (const [f, p] of Object.entries(perFile)) console.log(`  ${f}: screen ${pct(p.vis, p.total)}, dialogue ${pct(p.ok, p.dlg)}`);
if (process.argv[2] === '-v') console.log(missing.join('\n'));
else console.log('missing dialogue lines:', missing.length);
