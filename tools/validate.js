// 剧本静态检查：node tools/validate.js [-v] [文件名过滤]
// 检查命令、素材 ID、标签跳转、节点、雨雪是否在室内、场景内换装、说话时立绘是否在场、台词长度
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.join(__dirname, '..');
const verbose = process.argv.includes('-v');
const only = process.argv.slice(2).filter(a => !a.startsWith('-'))[0];
const ctx = { window: {} }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(root, 'js/assets.js'), 'utf8'), ctx);
const A = ctx.window.ASSETS;
const audioSrc = fs.readFileSync(path.join(root, 'js/audio.js'), 'utf8');
const BGM = [...audioSrc.match(/const TITLES = \{([\s\S]*?)\};/)[1].matchAll(/(\w+):/g)].map(m => m[1]);
const AMB = [...audioSrc.match(/const target = \{([^}]*)\}/)[1].matchAll(/(\w+):/g)].map(m => m[1]);
const SE = [...audioSrc.matchAll(/case '(\w+)':/g)].map(m => m[1]);
const FX = ['rain', 'heavyrain', 'snow', 'sparkle', 'lights', 'dust', 'confetti', 'petals', 'none'];
const TINT = ['fantasy', 'despair', 'memory', 'sepia', 'dark', 'none'];
const CMDS = 'node route face bg cg show hide bgm amb se wait shake flash black white reveal fx tint mode line muffle textbox chapter date center set if jump ending credits totitle autosave'.split(' ');
const ANIMS = ['hop', 'shake', 'tremble', 'melt', 'pop'];
const POS = ['l', 'cl', 'c', 'cr', 'r', 'll', 'rr', 'p1', 'p2', 'p3', 'p4'];
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const files = [...html.matchAll(/src="(script\/[^"?]+)/g)].map(m => m[1]).filter(f => fs.existsSync(path.join(root, f)));
const errs = [], warns = [], miss = [];
const labels = new Map(), jumps = [], nodes = new Map();
const stats = {};
const outfit = e => (e.match(/^(coat|winter)_/) || [])[1] || 'base';
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const lines = src.split(/\r?\n/);
  const st = stats[f] = { chars: 0, lines: 0, dlg: 0, dlgOk: 0 };
  let sprites = new Map(), cg = false, mode = 'normal', line = false, bg = null, label = '';
  const at = i => `${f}:${i + 1}`;
  lines.forEach((raw, i) => {
    const l = raw.trim();
    if (!l || l.startsWith('//') || l.startsWith('SCRIPTS.push') || l.startsWith('`')) return;
    if (l.startsWith('*')) { label = l.slice(1).trim(); if (labels.has(label)) errs.push(`${at(i)} duplicate label ${label}`); labels.set(label, at(i)); return; }
    if (l.startsWith('>')) {
      const parts = l.slice(1).split('|').map(s => s.trim());
      const t = (parts[0].split('=>')[1] || '').trim(); if (t) jumps.push([t, at(i)]);
      parts.slice(1).forEach(p => { if (!p.startsWith('?') && !/^(\w+(\+|-|=)\d+[\s,]*)+$/.test(p.replace(/\s/g, ''))) errs.push(`${at(i)} bad choice effect "${p}"`); });
      return;
    }
    if (l.startsWith('@')) {
      const sp = l.indexOf(' '); const cmd = sp < 0 ? l.slice(1) : l.slice(1, sp); const rest = sp < 0 ? '' : l.slice(sp + 1).trim(); const a = rest ? rest.split(/\s+/) : [];
      if (cmd === 'choice') return;
      if (!CMDS.includes(cmd)) errs.push(`${at(i)} unknown cmd @${cmd}`);
      switch (cmd) {
        case 'node': { const [id] = rest.split('|'); if (nodes.has(id)) errs.push(`${at(i)} duplicate node ${id}`); nodes.set(id, { at: at(i), label }); if (!rest.includes('|')) errs.push(`${at(i)} node needs id|标题`); break; }
        case 'bg': {
          const name = a[0]; if (!(name in A.bg)) errs.push(`${at(i)} bad bg ${name}`);
          else if (A.bg[name] && !fs.existsSync(path.join(root, A.bg[name].src))) miss.push(`bg ${name}`);
          bg = name; line = false;
          if (!a.includes('keep')) { sprites = new Map(); }
          break; }
        case 'cg': if (a[0] !== 'off') { if (!A.cg.find(c => c.id === a[0])) errs.push(`${at(i)} cg not in list ${a[0]}`); else if (!fs.existsSync(path.join(root, 'assets/cg', a[0] + '.png'))) miss.push(`cg ${a[0]}`); } cg = a[0] !== 'off'; break;
        case 'show': {
          const [id, ex = 'normal', ...r] = a; const c = A.ch[id];
          if (!c) { errs.push(`${at(i)} bad char ${id}`); break; }
          if (!c.exprs.includes(ex)) errs.push(`${at(i)} ${id} has no expr "${ex}"`);
          else if (!fs.existsSync(path.join(root, 'assets/ch', `${id}_${ex}.png`))) miss.push(`ch ${id}_${ex}`);
          r.forEach(t => { if (!POS.includes(t) && !ANIMS.includes(t) && t !== 'close' && t !== 'far') errs.push(`${at(i)} bad show arg ${t}`); });
          const prev = sprites.get(id);
          if (prev && outfit(prev) !== outfit(ex)) warns.push(`${at(i)} [${label}] ${id} changes outfit ${prev} -> ${ex} mid-scene`);
          sprites.set(id, ex);
          if (sprites.size > 4) warns.push(`${at(i)} more than 4 sprites on screen`);
          break; }
        case 'hide': if (!a[0] || a[0] === 'all') sprites = new Map(); else { if (!A.ch[a[0]]) errs.push(`${at(i)} bad hide ${a[0]}`); sprites.delete(a[0]); } break;
        case 'face': if (!A.ch[a[0]] || !A.ch[a[0]].exprs.includes(a[1] || 'normal')) errs.push(`${at(i)} bad face ${a.join(' ')}`); break;
        case 'bgm': if (a[0] !== 'stop' && !BGM.includes(a[0])) errs.push(`${at(i)} bad bgm ${a[0]}`); break;
        case 'amb': if (a[0] !== 'stop' && !AMB.includes(a[0])) errs.push(`${at(i)} bad amb ${a[0]}`); if (a[0] === 'stop' && a[1] && !AMB.includes(a[1])) errs.push(`${at(i)} bad amb stop ${a[1]}`); break;
        case 'se': if (!SE.includes(a[0])) errs.push(`${at(i)} bad se ${a[0]}`); break;
        case 'fx': if (!FX.includes(a[0] || 'none')) errs.push(`${at(i)} bad fx ${a[0]}`);
          if (['rain', 'heavyrain', 'snow'].includes(a[0]) && !(A.bg[bg] && A.bg[bg].out)) errs.push(`${at(i)} weather fx ${a[0]} on indoor bg ${bg}`); break;
        case 'tint': if (!TINT.includes(a[0] || 'none')) errs.push(`${at(i)} bad tint ${a[0]}`); break;
        case 'mode': if (!['normal', 'phone', 'tape'].includes(a[0])) errs.push(`${at(i)} bad mode ${a[0]}`); mode = a[0]; break;
        case 'line': line = !(a[0] === 'off' || !a[0]); break;
        case 'chapter': sprites = new Map(); cg = false; line = false; break;
        case 'jump': jumps.push([a[0], at(i)]); break;
        case 'if': { const t = (rest.split('=>')[1] || '').trim(); if (!t) errs.push(`${at(i)} bad if`); else jumps.push([t, at(i)]); break; }
        case 'ending': if (!A.endings.find(e => e.id === a[0])) errs.push(`${at(i)} bad ending ${a[0]}`); break;
        case 'route': if (!(a[0] in A.titles)) errs.push(`${at(i)} bad route ${a[0]}`); break;
        case 'credits': if (a[0] && !A.cg.find(c => c.id === a[0])) errs.push(`${at(i)} credits cg not in list ${a[0]}`); break;
        case 'center': st.chars += rest.length; break;
        case 'set': a.forEach(x => { if (!/^\w+(\+|-|=)\d+$/.test(x)) errs.push(`${at(i)} bad set ${x}`); }); break;
      }
      return;
    }
    const m = l.match(/^([^\s：「（]{1,12})：(.+)$/);
    const txt = m ? m[2] : l;
    // 旁白里带「：」的句子会被引擎当成「名字：台词」，名字栏里出现一整句话
    if (m && !A.speakers[m[1]] && m[1] !== A.protagonist && (m[1].length > 5 || /[，。、的是]/.test(m[1]))) warns.push(`${at(i)} narration parsed as speaker name "${m[1]}" (use —— or 。 instead of ：)`);
    if (txt.length > 110) errs.push(`${at(i)} line too long (${txt.length})`);
    st.chars += txt.replace(/[｛｝]/g, '').length; st.lines++;
    if (m && A.speakers[m[1]] && !line && mode === 'normal') {
      st.dlg++;
      if (sprites.has(A.speakers[m[1]]) || cg) st.dlgOk++;
      else warns.push(`${at(i)} [${label}] ${m[1]} speaks without sprite: ${m[2].slice(0, 20)}`);
    }
  });
}
jumps.forEach(([t, w]) => { if (!labels.has(t)) errs.push(`${w} missing label ${t}`); });
const show = arr => arr.filter(x => !only || x.includes(only));
console.log(errs.length ? 'ERRORS:\n' + show(errs).join('\n') : 'NO ERRORS');
const w = show(warns);
console.log(`WARNINGS: ${w.length}` + (verbose ? '\n' + w.join('\n') : (w.length ? '\n' + w.slice(0, 25).join('\n') + (w.length > 25 ? '\n…（-v 查看全部）' : '') : '')));
const um = [...new Set(miss)];
console.log(`missing image files: ${um.length}` + (verbose && um.length ? '\n  ' + um.join('\n  ') : ''));
let tot = 0;
for (const [f, s] of Object.entries(stats)) { tot += s.chars; console.log(`  ${f}: ${s.chars} 字, 台词立绘在场 ${s.dlg ? Math.round(100 * s.dlgOk / s.dlg) : 100}% (${s.dlgOk}/${s.dlg})`); }
console.log(`total ${tot} 字, labels ${labels.size}, nodes ${nodes.size}`);
