const fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/src="(script\/[^"]+)"/g)].map(m => m[1]);
for (const f of files) {
  const lines = fs.readFileSync(path.join(root, f), 'utf8').split(/\r?\n/);
  let sprites = new Set(), cg = false, label = '', bg = '', run = null;
  const out = [];
  const flush = () => { if (run && run.n >= 3) out.push(`  L${run.start} [${run.label}] bg=${run.bg} x${run.n}: ${run.first}`); run = null; };
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('//') || l.startsWith('>') || l.startsWith('SCRIPTS') || l.startsWith('`')) return;
    if (l.startsWith('*')) { label = l.slice(1); return; }
    if (l.startsWith('@')) {
      const [c, ...a] = l.slice(1).split(/\s+/);
      if (c === 'bg') { if (!a.includes('keep')) sprites = new Set(); bg = a[0]; flush(); }
      if (c === 'show') { sprites.add(a[0]); flush(); }
      if (c === 'hide') { if (!a[0] || a[0] === 'all') sprites = new Set(); else sprites.delete(a[0]); }
      if (c === 'cg') { cg = a[0] !== 'off'; if (cg) flush(); }
      if (c === 'chapter') { sprites = new Set(); cg = false; flush(); }
      if (c === 'center') { flush(); }
      return;
    }
    if (sprites.size || cg) { flush(); return; }
    if (!run) run = { start: i + 1, label, bg, n: 0, first: l.slice(0, 30) };
    run.n++;
  });
  flush();
  console.log(f + '\n' + out.join('\n'));
}
