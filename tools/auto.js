// 自动通关测试（在页面里执行；页面要带 ?mute=1）
// __auto({ route: 'bocchi', from: 'ch3_night', vars: {...} }) —— 每个选项默认选第一个；最后的分歧按路线挑
window.__auto = async function (opt = {}) {
  const sel = s => document.querySelector(s), W = ms => new Promise(r => setTimeout(r, ms));
  const log = []; window.__autoLog = log; const t0 = Date.now();
  window.__autoErr = []; window.__autoDone = null;
  addEventListener('error', e => window.__autoErr.push(String(e.message)));
  const origErr = console.error; console.error = (...a) => { window.__autoErr.push(a.map(String).join(' ')); origErr(...a); };
  __VN.cfg.skipUnread = true; __VN.cfg.textSpeed = 100;
  const KEY = { bocchi: '后藤', nijika: 'STARRY 的楼梯', ryo: '凉', kita: '喜多', normal: '谁也不找' };
  if (opt.from) __VN.jumpTo(opt.from, opt.vars || {});
  const missing = new Set();
  for (let step = 0; step < 200000; step++) {
    await W(20);
    if (sel('#title-screen.on')) { log.push('TITLE after ' + ((Date.now() - t0) / 1000 | 0) + 's'); break; }
    // 缺图检查
    document.querySelectorAll('.sprite img').forEach(i => { if (i.complete && !i.naturalWidth) missing.add(i.src); });
    const ch = sel('#choices.on');
    if (ch) {
      const btns = [...ch.querySelectorAll('button')].filter(b => !b.disabled); if (!btns.length) continue; await W(120);
      let pick = 0;
      // 共通线：优先选含有指定关键词的选项（模拟偏向某位女主的玩家）
      if (opt.prefer) { const i = btns.findIndex(b => opt.prefer.some(k => b.textContent.includes(k))); if (i >= 0) pick = i; }
      const key = KEY[opt.route];
      if (key) { const i = btns.findIndex(b => b.textContent.includes(key)); if (i >= 0 && btns.length >= 2 && /谁也不找/.test(btns.map(b => b.textContent).join())) pick = i; }
      if (opt.pickLast && !/谁也不找/.test(btns.map(b => b.textContent).join())) pick = btns.length - 1;
      log.push('[' + __VN.S().chapter + '] ' + btns.map(b => b.textContent.slice(0, 14)).join(' / ') + ' => ' + pick);
      btns[Math.min(pick, btns.length - 1)].click(); await W(120); continue;
    }
    if (sel('#chapter-card.on.ending')) { log.push('ENDING ' + sel('.cc-title').textContent + ' vars=' + JSON.stringify(__VN.S().vars)); await W(2600); document.getElementById('stage').click(); await W(1200); continue; }
    if (sel('#credits.on')) { await W(3300); document.getElementById('stage').click(); await W(400); continue; }
    if (sel('#center-text.on')) { document.getElementById('stage').click(); await W(40); continue; }
    const sk = sel('#quickmenu [data-act=skip]');
    if (sk && !sk.classList.contains('on')) sk.click();
  }
  log.push('missing images: ' + [...missing].join(', '));
  console.error = origErr;
  window.__autoDone = opt.route || 'common';
};
