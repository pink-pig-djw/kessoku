// 孤独摇滚！ 同人视觉小说 —— 引擎
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const stage = $('#stage');
  const A = window.ASSETS;
  const PROTAG = A.protagonist;
  const QS = new URLSearchParams(location.search);
  // ================= 手机 =================
  // NATIVE：安卓 app（Capacitor）；MOBILE：手机（触屏小屏幕），界面放大、手势操作、不整包预读图片。?mobile=1 可在电脑上模拟
  const CAP = window.Capacitor;
  const NATIVE = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());
  const MOBILE = NATIVE || QS.get('mobile') === '1' || (matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900);
  if (MOBILE) document.body.classList.add('mobile');
  if (NATIVE) document.body.classList.add('native');

  // ================= 缩放 =================
  // 舞台跟着窗口 / 屏幕的比例变：比 16:9 宽就加宽（最宽 2560），比 16:9 高就加高（最高 1440），画面铺满不留黑边。
  // 人物、界面都以中间的 1920×1080 为准；CG 完整显示，空出来的地方用模糊的同一张图补满（#stage.fill）
  let stageW = 1920, stageH = 1080;
  function fit() {
    const ar = innerWidth / innerHeight;
    const SW = Math.round(Math.min(2560, Math.max(1920, 1080 * ar)));
    const SH = Math.round(Math.min(1440, Math.max(1080, 1920 / ar)));
    if (SW !== stageW || SH !== stageH) {
      stageW = SW; stageH = SH;
      stage.style.width = SW + 'px'; stage.style.height = SH + 'px';
      stage.style.setProperty('--sw', SW + 'px'); stage.style.setProperty('--sh', SH + 'px');
      stage.classList.toggle('fill', SW !== 1920 || SH !== 1080);
      const fc = document.getElementById('layer-fx'); if (fc) { fc.width = SW; fc.height = SH; try { if (fxType !== 'none') setFx(fxType); } catch (e) { /* 启动时特效还没初始化 */ } }
    }
    const s = Math.min(innerWidth / stageW, innerHeight / stageH);
    stage.style.transform = `scale(${s})`;
    stage.style.setProperty('--scale', `scale(${s})`);
  }
  addEventListener('resize', fit); fit();
  try { new ResizeObserver(fit).observe(document.getElementById('viewport')); } catch (e) { }

  // ================= 持久化 =================
  const PREFIX = 'kessoku_';
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(PREFIX + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(PREFIX + k, JSON.stringify(v)); } catch (e) { } }
  };
  const cfg = Object.assign({ textSpeed: 60, autoSpeed: 50, boxOpacity: 82, bgmVol: 60, ambVol: 55, seVol: 70, skipUnread: false, fullscreen: false }, LS.get('cfg', {}));
  const glob = Object.assign({ read: [], cg: [], endings: [], cleared: false, aff: {} }, LS.get('global', {}));
  const readSet = new Set(glob.read);
  let globDirty = false;
  function saveGlobal() { glob.read = Array.from(readSet); LS.set('global', glob); globDirty = false; }
  setInterval(() => { if (globDirty) saveGlobal(); }, 3000);
  addEventListener('beforeunload', saveGlobal);
  function applyCfg() {
    stage.style.setProperty('--box-opacity', cfg.boxOpacity / 100);
    try { AudioSys.setVolume('bgm', cfg.bgmVol / 100); AudioSys.setVolume('amb', cfg.ambVol / 100); AudioSys.setVolume('se', cfg.seVol / 100); } catch (e) { }
  }

  // ================= 脚本解析 =================
  const ops = [], labels = {}, keyIndex = {};
  (function parse() {
    let lastLabel = '_start', off = 0;
    const lines = window.SCRIPTS.join('\n').split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      let raw = lines[i].trim();
      if (!raw || raw.startsWith('//')) continue;
      let op;
      if (raw.startsWith('*')) { lastLabel = raw.slice(1).trim(); off = 0; labels[lastLabel] = ops.length; continue; }
      if (raw.startsWith('@choice')) {
        const opts = [];
        while (i + 1 < lines.length && lines[i + 1].trim().startsWith('>')) {
          i++;
          const parts = lines[i].trim().slice(1).split('|').map(s => s.trim());
          let [txt, target] = parts[0].split('=>').map(s => s.trim());
          const o = { text: txt, target: target || null, fx: [], cond: null };
          parts.slice(1).forEach(p => { if (p.startsWith('?!')) o.lock = p.slice(2).trim(); else if (p.startsWith('?')) o.cond = p.slice(1).trim(); else o.fx.push(...p.split(/[\s,]+/).filter(Boolean)); });
          opts.push(o);
        }
        op = { t: 'choice', opts };
      } else if (raw.startsWith('@')) {
        const sp = raw.indexOf(' ');
        const cmd = sp < 0 ? raw.slice(1) : raw.slice(1, sp);
        const rest = sp < 0 ? '' : raw.slice(sp + 1).trim();
        op = { t: 'cmd', cmd, rest, args: rest ? rest.split(/\s+/) : [] };
      } else {
        const m = raw.match(/^([^\s：「（]{1,12})：(.+)$/);
        if (m) op = { t: 'say', name: m[1], text: m[2] };
        else op = { t: 'say', name: '', text: raw };
      }
      op.key = lastLabel + ':' + (off++);
      op.line = i + 1;
      keyIndex[op.key] = ops.length;
      ops.push(op);
    }
  })();

  // ================= 状态 =================
  let S = freshState();
  function freshState() { return { lastExpr: {}, bg: null, cg: null, sprites: {}, bgm: null, amb: [], fx: 'none', tint: 'none', mode: 'normal', vars: {}, chapter: '', lastText: '', lastName: '', muffle: false, line: null }; }
  let pc = 0, runId = 0;
  let backlog = [];
  let autoMode = false, skipMode = false, ctrlHeld = false, uiHidden = false;
  let pendingReveal = false;
  let inGame = false;

  let clickResolver = null;
  function waitClick() { return new Promise(r => { clickResolver = r; }); }
  function fireClick(v = 'click') { if (clickResolver) { const r = clickResolver; clickResolver = null; r(v); } }
  function abortWaits() { fireClick('abort'); if (timedResolver) { const r = timedResolver; timedResolver = null; r('abort'); } }
  let timedResolver = null;
  function wait(ms, clickable = true) {
    return new Promise(r => {
      let done = false;
      const fin = v => { if (done) return; done = true; timedResolver = null; if (clickable && clickResolver === fin2) clickResolver = null; r(v); };
      const fin2 = v => fin(v);
      timedResolver = fin;
      if (clickable) clickResolver = fin2;
      setTimeout(() => fin('time'), isSkipping() ? Math.min(ms, 60) : ms);
    });
  }
  const isSkipping = () => (skipMode || ctrlHeld) && inGame;

  // ================= 背景 / CG =================
  let bgFront = 'a', cgFront = 'a';
  const bgSrc = name => { const b = A.bg[name]; return b ? (typeof b === 'string' ? b : b.src) : null; };
  const isOutdoor = name => { const b = A.bg[name]; return !!(b && typeof b === 'object' && b.out); };
  function imgUrl(kind, name) {
    if (kind === 'bg') { const s = bgSrc(name); return s ? `url("${s}")` : 'none'; }
    return `url("assets/cg/${name}.png")`;
  }
  function bgColor(name) { return name === 'white' ? '#fff' : '#000'; }
  async function setBg(name, trans = 'dissolve', ms = 900) {
    if (isSkipping()) ms = Math.min(ms, 120);
    const front = $('#bg-' + bgFront), back = $('#bg-' + (bgFront === 'a' ? 'b' : 'a'));
    const apply = el => { el.style.backgroundImage = imgUrl('bg', name); el.style.backgroundColor = bgColor(name); };
    S.bg = name;
    updateSpriteTint();
    if (trans === 'cut' || ms <= 0) {
      apply(front); front.style.transition = 'none'; front.style.opacity = 1; back.style.opacity = 0; return;
    }
    if (trans === 'black' || trans === 'white') {
      await curtain(true, ms / 2, trans === 'white' ? '#fff' : '#000');
      apply(front); front.style.transition = 'none'; front.style.opacity = 1; back.style.opacity = 0;
      await sleep(isSkipping() ? 0 : 200);
      await curtain(false, ms / 2);
      return;
    }
    apply(back); back.style.transition = 'none'; back.style.opacity = 0; back.style.zIndex = 2; front.style.zIndex = 1;
    void back.offsetWidth;
    back.style.transition = `opacity ${ms}ms ease`; back.style.opacity = 1;
    bgFront = bgFront === 'a' ? 'b' : 'a';
    await sleep(ms);
    front.style.transition = 'none'; front.style.opacity = 0;
  }
  async function setCg(name, ms = 1000) {
    if (isSkipping()) ms = Math.min(ms, 120);
    const front = $('#cg-' + cgFront), back = $('#cg-' + (cgFront === 'a' ? 'b' : 'a'));
    if (!name || name === 'off') {
      S.cg = null; front.style.transition = `opacity ${ms}ms ease`; front.style.opacity = 0; back.style.opacity = 0; await sleep(ms); return;
    }
    S.cg = name;
    if (!glob.cg.includes(name)) { glob.cg.push(name); globDirty = true; }
    back.style.backgroundImage = imgUrl('cg', name); back.style.transition = 'none'; back.style.opacity = 0; back.style.zIndex = 2; front.style.zIndex = 1;
    void back.offsetWidth;
    back.style.transition = `opacity ${ms}ms ease`; back.style.opacity = 1;
    cgFront = cgFront === 'a' ? 'b' : 'a';
    await sleep(ms);
    front.style.transition = 'none'; front.style.opacity = 0;
  }
  async function curtain(on, ms = 600, color = '#000') {
    const c = $('#layer-curtain');
    if (isSkipping()) ms = Math.min(ms, 80);
    c.style.background = color;
    c.style.transition = `opacity ${ms}ms ease`;
    c.style.opacity = on ? 1 : 0;
    await sleep(ms);
  }

  // ================= 立绘 =================
  // 四人同框用 p1~p4，三人用 l c r
  const posLeft = p => `calc(50% + ${((POS[p] - 50) * 19.2).toFixed(1)}px)`;
  const POS = { l: 27, cl: 38, c: 50, cr: 62, r: 73, ll: 17, rr: 83, p1: 19, p2: 39.5, p3: 60.5, p4: 81 };
  function spritePath(id, expr) { return `assets/ch/${id}_${expr}.png`; }
  function updateSpriteTint() {
    const b = A.bg[S.bg], tint = b && typeof b === 'object' ? b.tint : '';
    $$('.sprite').forEach(el => { el.classList.remove('tint-night', 'tint-evening', 'tint-dim', 'tint-stage'); if (tint) el.classList.add('tint-' + tint); });
  }
  function applySpriteSize(el, id, size) {
    const sc = (A.ch[id] && A.ch[id].scale) || 1;
    const close = size === 'close';
    el.style.height = (close ? 1720 : 1110) * sc + 'px';
    el.style.bottom = (close ? -620 : -90) * sc + 'px';
    el.classList.toggle('close', close);
  }
  function showSprite(id, expr = 'normal', pos, anim, size) {
    let el = document.getElementById('sp-' + id);
    const prev = S.sprites[id];
    pos = pos || (prev && prev.pos) || 'c';
    size = size || (prev && prev.size) || 'normal';
    S.sprites[id] = { expr, pos, size };
    (S.lastExpr = S.lastExpr || {})[id] = expr;
    if (!el) {
      el = document.createElement('div'); el.className = 'sprite'; el.id = 'sp-' + id;
      const img = document.createElement('img'); img.draggable = false;
      img.onerror = () => { if (!img.src.endsWith('_normal.png')) img.src = spritePath(id, 'normal'); };
      img.src = spritePath(id, expr); el.appendChild(img);
      el.style.left = posLeft(pos);
      applySpriteSize(el, id, size);
      if (!isSkipping()) el.classList.add('enter');
      $('#layer-ch').appendChild(el);
      updateSpriteTint();
      void el.offsetWidth; el.style.opacity = 1;
    } else {
      el.style.opacity = 1;
      el.style.left = posLeft(pos);
      el.classList.remove('enter');
      applySpriteSize(el, id, size);
      const imgs = el.querySelectorAll('img'), cur = imgs[imgs.length - 1];
      const want = spritePath(id, expr);
      if (!cur || !cur.src.endsWith(want)) {
        const img = document.createElement('img'); img.draggable = false; img.style.opacity = 0;
        img.onerror = () => { if (!img.src.endsWith('_normal.png')) img.src = spritePath(id, 'normal'); };
        // 新表情淡入后，只删掉它下面更旧的图层（快进时连续换表情也不会把图层删光）
        img.onload = () => {
          if (!img.isConnected) return;
          img.style.opacity = 1;
          setTimeout(() => { let p = img.previousElementSibling; while (p) { const q = p.previousElementSibling; if (p.tagName === 'IMG') p.remove(); p = q; } }, isSkipping() ? 0 : 260);
        };
        img.src = want; el.appendChild(img);
      }
    }
    if (anim && !isSkipping()) { el.classList.remove(anim); void el.offsetWidth; el.classList.add(anim); setTimeout(() => el.classList.remove(anim), 1600); }
  }
  function hideSprite(id) {
    const ids = id === 'all' || !id ? Object.keys(S.sprites) : [id];
    ids.forEach(i => {
      delete S.sprites[i];
      const el = document.getElementById('sp-' + i);
      if (el) { el.style.opacity = 0; setTimeout(() => { if (!S.sprites[i]) el.remove(); }, 500); }
    });
  }
  function clearSpritesNow() { S.sprites = {}; $('#layer-ch').innerHTML = ''; }
  function speakerId(name) { return A.speakers[name]; }
  function focusSpeaker(name) {
    const id = speakerId(name);
    $$('.sprite').forEach(el => {
      const sid = el.id.slice(3);
      if (id && S.sprites[id] && sid !== id) el.classList.add('dim'); else el.classList.remove('dim');
    });
  }

  // ================= 粒子特效 =================
  const fxCanvas = $('#layer-fx'), fxCtx = fxCanvas.getContext('2d');
  let fxParts = [], fxType = 'none';
  const WEATHER = ['rain', 'heavyrain', 'snow'];
  function setFx(type) {
    if (WEATHER.includes(type) && !isOutdoor(S.bg)) { console.warn('室内场景不显示天气粒子：', S.bg, type); type = 'none'; }
    S.fx = type; fxType = type; fxParts = [];
    const n = { rain: 260, heavyrain: 520, snow: 150, sparkle: 46, lights: 7, dust: 60, confetti: 140, petals: 70 }[type] || 0;
    for (let i = 0; i < n; i++) fxParts.push(newPart(true, i));
  }
  function newPart(init, i) {
    const W = stageW, H = stageH, r = Math.random, X0 = (stageW - 1920) / 2;
    switch (fxType) {
      case 'rain': case 'heavyrain': return { x: r() * W * 1.2, y: init ? r() * H : -40, v: 28 + r() * 18, l: 30 + r() * 40, a: 0.15 + r() * 0.3 };
      case 'snow': return { x: r() * W, y: init ? r() * H : -10, v: 0.6 + r() * 1.4, s: 2 + r() * 5, ph: r() * 6.28, a: 0.5 + r() * 0.5 };
      case 'petals': return { x: r() * W * 1.3, y: init ? r() * H : -20, v: 1 + r() * 1.6, s: 6 + r() * 7, ph: r() * 6.28, rot: r() * 6.28 };
      case 'sparkle': return { x: r() * W, y: r() * H * 0.85, s: 6 + r() * 16, ph: r() * 6.28, sp: 0.03 + r() * 0.05, hue: r() < 0.5 ? 48 : 330 };
      case 'lights': return { x: X0 + 120 + (i || 0) * 270 * stageW / 1920, ang: -0.6 + r() * 1.2, sp: 0.004 + r() * 0.006, ph: r() * 6.28, hue: [330, 50, 210, 0, 280, 190, 40][(i || 0) % 7] };
      case 'dust': return { x: r() * W, y: r() * H, v: 0.15 + r() * 0.3, s: 1 + r() * 2.5, ph: r() * 6.28, a: r() };
      case 'confetti': return { x: r() * W, y: init ? -r() * H : -20, v: 2 + r() * 3, s: 8 + r() * 8, ph: r() * 6.28, rot: r() * 6.28, hue: [330, 50, 210, 0][Math.floor(r() * 4)] };
    }
    return {};
  }
  function fxLoop() {
    requestAnimationFrame(fxLoop);
    fxCtx.clearRect(0, 0, stageW, stageH);
    if (fxType === 'none' || !fxParts.length) return;
    const c = fxCtx;
    fxParts.forEach((p, i) => {
      switch (fxType) {
        case 'rain': case 'heavyrain':
          c.strokeStyle = `rgba(200,215,235,${p.a})`; c.lineWidth = fxType === 'heavyrain' ? 1.6 : 1.1;
          c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.l * 0.18, p.y + p.l); c.stroke();
          p.y += p.v; p.x -= p.v * 0.18; if (p.y > stageH + 20) fxParts[i] = newPart(); break;
        case 'snow':
          p.ph += 0.01; p.y += p.v; p.x += Math.sin(p.ph) * 0.6;
          c.fillStyle = `rgba(255,255,255,${p.a})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.28); c.fill();
          if (p.y > stageH + 10) fxParts[i] = newPart(); break;
        case 'petals':
          p.ph += 0.02; p.rot += 0.03; p.y += p.v; p.x += Math.sin(p.ph) * 1.2 - 0.8;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = 'rgba(255,200,215,.85)';
          c.beginPath(); c.ellipse(0, 0, p.s, p.s * 0.55 * Math.abs(Math.cos(p.ph)), 0, 0, 6.28); c.fill(); c.restore();
          if (p.y > 1100 || p.x < -30) fxParts[i] = newPart(); break;
        case 'sparkle': {
          // 喜多的「光环」
          p.ph += p.sp; const k = Math.max(0, Math.sin(p.ph)), s = p.s * k;
          if (s > 0.5) {
            c.save(); c.translate(p.x, p.y); c.globalAlpha = k * 0.9;
            c.fillStyle = `hsl(${p.hue},100%,88%)`; c.shadowColor = `hsl(${p.hue},100%,70%)`; c.shadowBlur = 14;
            c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(0, 0, s, 0); c.quadraticCurveTo(0, 0, 0, s); c.quadraticCurveTo(0, 0, -s, 0); c.quadraticCurveTo(0, 0, 0, -s); c.fill(); c.restore();
          }
          if (p.ph > 6.28 * 2) fxParts[i] = newPart(); break;
        }
        case 'lights': {
          // 舞台灯光
          p.ph += p.sp; const ang = p.ang + Math.sin(p.ph) * 0.35;
          c.save(); c.translate(p.x, -40); c.rotate(ang); c.globalCompositeOperation = 'screen';
          const g = c.createLinearGradient(0, 0, 0, 1250);
          g.addColorStop(0, `hsla(${p.hue},100%,75%,.42)`); g.addColorStop(1, `hsla(${p.hue},100%,60%,0)`);
          c.fillStyle = g; c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.lineTo(190, 1250); c.lineTo(-190, 1250); c.fill(); c.restore();
          break;
        }
        case 'confetti':
          p.ph += 0.05; p.rot += 0.08; p.y += p.v; p.x += Math.sin(p.ph) * 1.6;
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = `hsl(${p.hue},85%,65%)`;
          c.fillRect(-p.s / 2, -p.s / 4 * Math.abs(Math.cos(p.ph)), p.s, p.s / 2 * Math.abs(Math.cos(p.ph)) + 1); c.restore();
          if (p.y > stageH + 20) fxParts[i] = newPart(); break;
        case 'dust':
          p.ph += 0.01; p.y -= p.v * 0.3; p.x += Math.sin(p.ph) * 0.3;
          c.fillStyle = `rgba(255,240,210,${0.25 + Math.sin(p.ph * 2) * 0.2})`; c.beginPath(); c.arc(p.x, p.y, p.s, 0, 6.28); c.fill();
          if (p.y < -10) { p.y = 1090; } break;
      }
    });
  }
  fxLoop();

  function setTint(t) {
    S.tint = t;
    stage.classList.remove('tint-sepia', 'tint-memory', 'tint-dark', 'tint-fantasy', 'tint-despair');
    if (t && t !== 'none') stage.classList.add('tint-' + t);
  }

  // ================= LINE 聊天 =================
  const phone = $('#phone'), phoneBody = $('#phone .ph-body'), phoneTitle = $('#phone .ph-title');
  function faceStyle(id, px) {
    const c = A.ch[id]; if (!c || !c.face) return '';
    const expr = 'normal', [cx, cy, size] = c.face, k = px / (size || 400);
    return `background-image:url("${spritePath(id, expr)}");background-size:${1024 * k}px ${1536 * k}px;background-position:${-(cx * k - px / 2)}px ${-(cy * k - px / 2)}px`;
  }
  function lineOpen(title) {
    S.line = { title, msgs: [] };
    phoneTitle.textContent = title; phoneBody.innerHTML = '';
    phone.classList.add('on');
  }
  function lineClose() { S.line = null; phone.classList.remove('on'); }
  function lineAdd(name, text, animate = true) {
    const me = name === PROTAG;
    const id = speakerId(name);
    const d = document.createElement('div'); d.className = 'ph-msg' + (me ? ' me' : '') + (animate ? ' pop' : '');
    const sticker = text.match(/^\[贴图[:：](.+)\]$/);
    const prevMsg = S.line.msgs[S.line.msgs.length - 1];
    const cont = prevMsg && prevMsg.name === name;
    d.innerHTML = (me ? '' : `<div class="ph-icon" style='${cont ? '' : faceStyle(id, 64)}'></div>`) +
      `<div class="ph-col">${(!me && !cont) ? '<div class="ph-name"></div>' : ''}<div class="${sticker ? 'ph-sticker' : 'ph-bubble'}"></div></div>`;
    if (cont && !me) d.querySelector('.ph-icon').classList.add('blank');
    const nm = d.querySelector('.ph-name'); if (nm) nm.textContent = (A.ch[id] && A.ch[id].lineName) || name;
    d.querySelector(sticker ? '.ph-sticker' : '.ph-bubble').textContent = sticker ? sticker[1] : text;
    phoneBody.appendChild(d);
    S.line.msgs.push({ name, text }); if (S.line.msgs.length > 40) S.line.msgs.shift();
    phoneBody.scrollTop = phoneBody.scrollHeight;
  }
  function lineRestore() {
    if (!S.line) { phone.classList.remove('on'); return; }
    const msgs = S.line.msgs; S.line.msgs = [];
    phoneTitle.textContent = S.line.title; phoneBody.innerHTML = ''; phone.classList.add('on');
    msgs.forEach(m => lineAdd(m.name, m.text, false));
  }

  // ================= 文本 =================
  const tb = $('#textbox'), textEl = $('#text'), nameEl = $('#name'), waitMark = $('#wait-mark');
  let typing = false, typeSkip = false;
  function charDelay() { return Math.max(0, 80 - cfg.textSpeed * 0.8); }
  function renderText(str) {
    // ｛…｝= 小声嘀咕
    textEl.innerHTML = '';
    const spans = [];
    let small = false;
    for (const ch of str) {
      if (ch === '｛') { small = true; continue; }
      if (ch === '｝') { small = false; continue; }
      const s = document.createElement('span'); s.className = 'ch' + (small ? ' small' : ''); s.textContent = ch;
      textEl.appendChild(s); spans.push(s);
    }
    return spans;
  }
  const faceBox = $('#facebox'), faceImg = $('#facebox .face-img');
  function updateFace(name) {
    const id = speakerId(name), c = id && A.ch[id];
    if (!c || !c.face || S.sprites[id] || S.cg) { faceBox.classList.remove('on'); return; }
    const expr = (S.lastExpr && S.lastExpr[id]) || 'normal';
    const [cx, cy, size] = c.face, k = 172 / (size || 400);
    faceImg.style.backgroundImage = `url("${spritePath(id, expr)}"), url("${spritePath(id, 'normal')}")`;
    faceImg.style.backgroundSize = `${1024 * k}px ${1536 * k}px`;
    faceImg.style.backgroundPosition = `${-(cx * k - 86)}px ${-(cy * k - 86)}px`;
    faceBox.style.setProperty('--accent', c.color || '#f29bb8');
    faceBox.classList.add('on');
  }
  function nameColor(name) {
    const id = speakerId(name); const c = id && A.ch[id];
    return c && c.color ? c.color : (name === PROTAG ? '#cfe3ff' : '#ffe3c2');
  }
  async function showText(name, text) {
    if (pendingReveal) { pendingReveal = false; await revealFromCard(); }
    tb.classList.remove('hidden');
    nameEl.textContent = name;
    tb.style.setProperty('--name-color', nameColor(name));
    textEl.classList.toggle('thought', !name && /^（.*）$/.test(text));
    focusSpeaker(name);
    updateFace(name);
    S.lastText = text; S.lastName = name;
    backlog.push({ name, text: text.replace(/[｛｝]/g, '') }); if (backlog.length > 400) backlog.shift();
    const spans = renderText(text);
    waitMark.classList.remove('on');
    const d = charDelay();
    if (isSkipping() || d === 0) { spans.forEach(s => s.classList.add('on')); }
    else {
      typing = true; typeSkip = false;
      for (let i = 0; i < spans.length; i++) {
        if (typeSkip || isSkipping()) { spans.slice(i).forEach(s => s.classList.add('on')); break; }
        spans[i].classList.add('on');
        const ch = spans[i].textContent;
        await sleep(/[。！？…—]/.test(ch) ? d * 3 : /[，、；：]/.test(ch) ? d * 2 : d);
      }
      typing = false;
    }
    waitMark.classList.add('on');
  }

  // ================= 运行 =================
  async function run(id) {
    while (id === runId) {
      const op = ops[pc];
      if (!op) { await toTitle(); return; }
      pc++;
      try { await exec(op, id); } catch (e) { console.error('脚本错误 @', op.line, op, e); }
    }
  }
  function jump(label) {
    if (!(label in labels)) { console.error('未找到标签', label); return; }
    pc = labels[label];
  }
  // grant：这条效果来自哪个选项（选项的 key）。好感度按「选过的选项」永久累计，见下面的 affTotal
  function applyFx(list, grant) {
    list.forEach((f, i) => {
      const m = f.match(/^(\w+)(\+=|-=|\+|-|=)(-?\d+)$/);
      if (!m) return;
      const [, k, o, v] = m, n = +v, cur = S.vars[k] || 0;
      if (isAff(k) && o[0] === '+' && grant) {
        const g = grant + '#' + i;
        if (!glob.aff[g]) { glob.aff[g] = { [k]: n }; saveGlobal(); }
        syncAff();
        if ((S.vars[k] || 0) > cur) affinityPop(k, S.vars[k] - cur);
        return;
      }
      S.vars[k] = o === '=' ? n : (o[0] === '+' ? cur + n : cur - n);
      if (S.vars[k] > cur && isAff(k)) affinityPop(k, S.vars[k] - cur);
    });
  }
  // ================= 好感度：永久累计 =================
  // 每个加好感的选项，只要选过一次就永久记下（glob.aff，跨存档、跨回溯）。
  // 用分支图回到以前的节点改选别的选项，原来选过的好感度不会消失，新选项的好感度会叠加上去；
  // 同一个选项重复选，不会重复加。每位女主最多 affinity.max 点。
  const isAff = k => A.affinity.list.some(x => x.v === k);
  function affTotal(k) {
    let n = 0; Object.values(glob.aff).forEach(g => { n += g[k] || 0; });
    return Math.min(n, A.affinity.max);
  }
  function syncAff() { A.affinity.list.forEach(x => { S.vars[x.v] = Math.max(S.vars[x.v] || 0, affTotal(x.v)); }); }
  // ================= 好感度 =================
  function affinityPop(k, d) {
    const info = A.affinity.list.find(x => x.v === k), c = A.ch[info.ch];
    const box = $('#aff-pop'), el = document.createElement('div');
    el.className = 'aff-pop-item'; el.style.setProperty('--lc', c.color);
    const v = S.vars[k] || 0, reached = v >= A.affinity.need && v - d < A.affinity.need;
    el.innerHTML = `<span class="aff-pop-face" style='${faceStyle(info.ch, 64)}'></span><span class="aff-pop-name"></span><span class="aff-pop-heart">♥ +${d}</span>` + (reached ? '<span class="aff-pop-note">个人线条件达成</span>' : '');
    el.querySelector('.aff-pop-name').textContent = c.name;
    box.appendChild(el);
    if (!isSkipping()) AudioSys.se('kira');
    setTimeout(() => el.classList.add('out'), reached ? 3200 : 2000);
    setTimeout(() => el.remove(), reached ? 3800 : 2600);
  }
  function openAffinity() {
    const af = A.affinity, list = $('#aff-screen .aff-list');
    list.innerHTML = '';
    af.list.forEach(info => {
      const c = A.ch[info.ch], v = Math.min(S.vars[info.v] || 0, af.max), ok = v >= af.need;
      const row = document.createElement('div'); row.className = 'aff-row' + (ok ? ' ok' : ''); row.style.setProperty('--lc', c.color);
      let hearts = '';
      for (let i = 1; i <= af.max; i++) {
        hearts += `<span class="aff-heart${i <= v ? ' on' : ''}">${i <= v ? '♥' : '♡'}</span>`;
        if (i === af.need - 1) hearts += '<span class="aff-mark"><b>个人线</b></span>';
      }
      row.innerHTML = `<div class="aff-face" style='${faceStyle(info.ch, 120)}'></div>
        <div class="aff-info"><div class="aff-name"></div><div class="aff-sub"></div></div>
        <div class="aff-hearts">${hearts}</div>
        <div class="aff-state">${ok ? '✓ 可以进入个人线' : '还差 ' + (af.need - v) + ' 点'}</div>`;
      row.querySelector('.aff-name').textContent = info.name;
      row.querySelector('.aff-sub').textContent = info.sub;
      list.appendChild(row);
    });
    const routeInfo = S.route && af.list.find(x => x.v === S.route);
    $('#aff-screen .aff-note').textContent = S.route
      ? '当前路线：' + (routeInfo ? routeInfo.name + '线' : '普通线（第五条音轨）') + '。'
      : `在第一~三章的选择里积累好感度。第三章结尾，好感度达到 ${af.need} 点的女主，才能进入她的个人线；谁都没有达到时，会进入普通线。好感度会永久累计：用分支图回到以前的选项改选别人，已经得到的好感度不会减少，新得到的会叠加上去。`;
    showScreen('aff-screen');
  }
  function evalCond(c) {
    try {
      const expr = c.replace(/[A-Za-z_]\w*/g, k => (k === 'true' || k === 'false') ? k : String(S.vars[k] || 0));
      if (/[^\d\s<>=!&|()+\-*.]/.test(expr)) return false;
      return !!Function('return (' + expr + ')')();
    } catch (e) { console.error('条件错误', c); return false; }
  }

  async function exec(op, id) {
    if (op.t === 'say') {
      const wasRead = readSet.has(op.key);
      if (isSkipping() && !wasRead && !cfg.skipUnread) { skipMode = false; updateIndicators(); }
      if (S.line && op.name) {
        // LINE 消息
        if (pendingReveal) { pendingReveal = false; await revealFromCard(); }
        tb.classList.add('hidden');
        if (!isSkipping()) AudioSys.se(op.name === PROTAG ? 'line_send' : 'line_recv');
        lineAdd(op.name, op.text);
        backlog.push({ name: op.name + '（LINE）', text: op.text });
        S.lastText = op.text; S.lastName = op.name;
        readSet.add(op.key); globDirty = true;
        await waitAdvance(op.text, id);
        return;
      }
      await showText(op.name, op.text);
      readSet.add(op.key); globDirty = true;
      await waitAdvance(op.text, id);
      return;
    }
    if (op.t === 'choice') {
      skipMode = false; updateIndicators();
      if (pendingReveal) { pendingReveal = false; await revealFromCard(); }
      autoSave();
      const box = $('#choices'); box.innerHTML = '';
      const opts = op.opts.filter(o => !o.cond || evalCond(o.cond));
      const pick = await new Promise(res => {
        opts.forEach((o, i) => {
          const b = document.createElement('button'); b.textContent = o.text; b.style.animationDelay = (i * 0.12) + 's';
          if (o.lock && !evalCond(o.lock)) {
            // 好感度不足：显示，但不能选
            const m = o.lock.match(/^(\w+)\s*>=\s*(\d+)$/), info = m && A.affinity.list.find(x => x.v === m[1]);
            b.textContent = info ? `🔒 ${info.name} —— 好感度不足（${S.vars[m[1]] || 0} / ${m[2]}）` : o.text + '（条件未满足）';
            if (info) b.style.setProperty('--lc', A.ch[info.ch].color);
            b.classList.add('locked'); b.disabled = true;
            b.onclick = e => { e.stopPropagation(); AudioSys.se('click'); };
          } else b.onclick = e => { e.stopPropagation(); AudioSys.se('select'); res(o); };
          box.appendChild(b);
        });
        box.classList.add('on');
        const abortCheck = setInterval(() => { if (id !== runId) { clearInterval(abortCheck); res(null); } }, 200);
      });
      box.classList.remove('on'); box.innerHTML = '';
      if (!pick || id !== runId) return;
      backlog.push({ name: '▶', text: pick.text });
      applyFx(pick.fx, op.key + '/' + op.opts.indexOf(pick));
      if (pick.target) jump(pick.target);
      return;
    }
    const a = op.args, r = op.rest;
    switch (op.cmd) {
      case 'bg': {
        const keep = a.includes('keep');
        const args = a.filter(x => x !== 'keep');
        if (!keep) { hideSprite('all'); setFx('none'); }
        if (S.line) lineClose();
        await setBg(args[0], args[1] || 'dissolve', args[2] ? +args[2] : (args[1] === 'black' ? 1400 : 900));
        if (!keep) clearSpritesNow();
        else if (WEATHER.includes(S.fx) && !isOutdoor(S.bg)) setFx('none');
        break;
      }
      case 'cg': await setCg(a[0], a[1] ? +a[1] : 1000); break;
      case 'show': {
        const [cid, expr, ...rest] = a;
        let pos, anim, size;
        rest.forEach(t => { if (POS[t]) pos = t; else if (t === 'close' || t === 'far') size = t === 'close' ? 'close' : 'normal'; else anim = t; });
        showSprite(cid, expr || 'normal', pos, anim, size);
        await sleep(isSkipping() ? 0 : 120);
        break;
      }
      case 'hide': hideSprite(a[0] || 'all'); await sleep(isSkipping() ? 0 : 250); break;
      // 淡入淡出时长：小于 50 的数按秒算，否则按毫秒算（剧本里两种写法都有）
      case 'bgm': { const sec0 = v => v == null ? null : (+v < 50 ? +v : +v / 1000), sec = v => isSkipping() ? 0.1 : sec0(v); // 快进时换曲不做长淡入淡出
        if (a[0] === 'stop') { AudioSys.stopTheme(sec(a[1]) ?? 2); S.bgm = null; } else { AudioSys.playTheme(a[0], sec(a[1]) ?? 1.5); S.bgm = a[0]; } break; }
      case 'amb': { const sec = v => v == null || isNaN(+v) ? null : (+v < 50 ? +v : +v / 1000);
        if (a[0] === 'stop') { AudioSys.stopAmb(a[1], 2); S.amb = a[1] ? S.amb.filter(x => x !== a[1]) : []; }
        else { AudioSys.startAmb(a[0], sec(a[1]) ?? 2); if (!S.amb.includes(a[0])) S.amb.push(a[0]); }
        break; }
      case 'se': if (!isSkipping()) AudioSys.se(a[0]); break;
      case 'wait': if (pendingReveal) { pendingReveal = false; await revealFromCard(); } await wait(+a[0] || 500); break;
      case 'shake': stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake'); break;
      case 'flash': { const f = $('#layer-flash'); f.style.background = a[0] || '#fff'; f.style.transition = 'none'; f.style.opacity = 0.9; void f.offsetWidth; f.style.transition = 'opacity .9s ease'; f.style.opacity = 0; break; }
      case 'black': await curtain(true, a[0] ? +a[0] : 800); break;
      case 'white': await curtain(true, a[0] ? +a[0] : 800, '#fff'); break;
      case 'reveal': await curtain(false, a[0] ? +a[0] : 800); break;
      case 'fx': setFx(a[0] || 'none'); break;
      case 'tint': setTint(a[0] || 'none'); break;
      case 'mode': S.mode = a[0] || 'normal'; tb.classList.remove('tape', 'phone'); if (S.mode !== 'normal') tb.classList.add(S.mode); break;
      case 'line': if (!a[0] || a[0] === 'off') lineClose(); else lineOpen(r); break;
      case 'muffle': S.muffle = a[0] === 'on'; AudioSys.setMuffle(S.muffle, a[1] ? +a[1] / 1000 : 1.5); break;
      case 'textbox': if (a[0] === 'hide') tb.classList.add('hidden'); else tb.classList.remove('hidden'); break;
      case 'chapter': await chapterCard(r.split('|')); break;
      case 'date': showDate(r.split('|')); break;
      case 'center': await centerText(r.replace(/\\n/g, '\n')); break;
      case 'set': applyFx(a, op.key); break;
      case 'face': (S.lastExpr = S.lastExpr || {})[a[0]] = a[1] || 'normal'; break;
      case 'if': { const [cond, target] = r.split('=>').map(s => s.trim()); if (evalCond(cond)) jump(target); break; }
      case 'jump': jump(a[0]); break;
      case 'ending': await endingCard(a[0]); break;
      case 'credits': await credits(a[0]); break;
      case 'totitle': await toTitle(); break;
      case 'autosave': autoSave(); break;
      case 'node': recordNode(r.split('|')[0]); break;
      case 'route': S.route = a[0]; glob.route = a[0]; if (!glob.cg.includes('title_' + a[0])) glob.cg.push('title_' + a[0]); saveGlobal(); break;
      default: console.warn('未知命令', op.cmd);
    }
  }

  async function waitAdvance(text, id) {
    while (id === runId) {
      if (isSkipping()) { await sleep(cfg.textSpeed > 95 ? 25 : 45); if (isSkipping()) return; }
      if (autoMode) {
        const ms = 900 + (110 - cfg.autoSpeed) * 14 + text.length * (95 - cfg.autoSpeed * 0.6);
        const v = await wait(ms, true);
        if (v === 'abort') return;
        if (v === 'time' && !autoMode && !isSkipping()) { continue; }
        return;
      }
      const v = await waitClickOrMode();
      if (v === 'abort') return;
      if (v === 'mode') continue;
      return;
    }
  }
  function waitClickOrMode() { return new Promise(r => { clickResolver = r; modeResolver = () => r('mode'); }); }
  let modeResolver = null;
  function modeChanged() { if (modeResolver) { const m = modeResolver; modeResolver = null; if (clickResolver) clickResolver = null; m(); } }

  async function revealFromCard() {
    const card = $('#chapter-card');
    if (card.classList.contains('on')) { card.classList.remove('on'); }
    await curtain(false, 900);
  }
  async function chapterCard([num, title, sub]) {
    tb.classList.add('hidden');
    hideSprite('all'); lineClose();
    const card = $('#chapter-card');
    card.classList.remove('ending');
    card.querySelector('.cc-num').textContent = num || '';
    card.querySelector('.cc-title').textContent = title || '';
    card.querySelector('.cc-sub').textContent = sub || '';
    S.chapter = (num ? num + ' ' : '') + (title || '');
    await curtain(true, 700);
    card.classList.add('on');
    autoSave();
    if (!isSkipping()) AudioSys.se('chapter');
    await wait(isSkipping() ? 300 : 3800, true);
    clearSpritesNow();
    card.classList.remove('on');
    await sleep(isSkipping() ? 0 : 900);
    pendingReveal = true;
  }
  function showDate([main, sub]) {
    const d = $('#date-card');
    d.querySelector('.date-main').textContent = main || '';
    d.querySelector('.date-sub').textContent = sub || '';
    d.classList.add('show');
    clearTimeout(showDate.t);
    showDate.t = setTimeout(() => d.classList.remove('show'), 4200);
  }
  async function centerText(t) {
    if (pendingReveal) { pendingReveal = false; }
    const el = $('#center-text');
    tb.classList.add('hidden');
    el.textContent = t; el.classList.add('on');
    backlog.push({ name: '', text: t });
    S.lastText = t;
    await sleep(isSkipping() ? 0 : 700);
    if (isSkipping()) await sleep(200);
    else if (autoMode) await wait(2500 + t.length * 60);
    else await waitClick();
    el.classList.remove('on');
    await sleep(isSkipping() ? 0 : 700);
  }
  async function endingCard(eid) {
    skipMode = false; updateIndicators();
    const e = A.endings.find(x => x.id === eid) || { tag: 'END', title: eid };
    if (!glob.endings.includes(eid)) glob.endings.push(eid);
    glob.cleared = true;
    saveGlobal();
    tb.classList.add('hidden'); lineClose();
    await curtain(true, 1500);
    const card = $('#chapter-card');
    card.classList.add('ending');
    card.style.setProperty('--end-color', e.color || '#f29bb8');
    card.querySelector('.cc-num').textContent = e.tag;
    card.querySelector('.cc-title').textContent = e.title;
    card.querySelector('.cc-sub').textContent = e.sub || '';
    card.classList.add('on');
    await sleep(2500);
    await waitClick();
    card.classList.remove('on');
    await sleep(1000);
  }
  async function credits(cgName) {
    const c = $('#credits'), roll = $('#credits-roll');
    tb.classList.add('hidden');
    roll.innerHTML = A.credits(cgName);
    c.classList.add('on');
    await sleep(100);
    const h = roll.scrollHeight;
    const dur = 56000;
    roll.style.transition = 'none'; roll.style.transform = 'translateY(0)';
    void roll.offsetWidth;
    roll.style.transition = `transform ${dur}ms linear`; roll.style.transform = `translateY(${-(h + stageH - 300)}px)`;
    let fast = false;
    const t0 = Date.now();
    while (Date.now() - t0 < dur && !fast) {
      const v = await wait(500, true);
      if (v === 'click' && Date.now() - t0 > 3000) fast = true;
      if (v === 'abort') break;
    }
    c.classList.remove('on');
  }

  function updateIndicators() {
    const q = $('#quickmenu');
    q.querySelector('[data-act=auto]').classList.toggle('on', autoMode);
    q.querySelector('[data-act=skip]').classList.toggle('on', skipMode);
    const mi = $('#mode-indicator');
    mi.textContent = isSkipping() ? '▶▶ 快进' : autoMode ? '▶ 自动' : '';
    mi.classList.toggle('on', isSkipping() || autoMode);
  }

  // ================= 存档 =================
  function snapshot() {
    const op = ops[Math.max(0, pc - 1)];
    return { key: op ? op.key : ops[0].key, S: JSON.parse(JSON.stringify(S)), time: Date.now(),
      chapter: S.chapter, text: (S.lastName ? S.lastName + '：' : '') + S.lastText, thumb: S.cg ? 'assets/cg/' + S.cg + '.png' : (bgSrc(S.bg) || '') };
  }
  function writeSlot(slot) { LS.set('save_' + slot, snapshot()); }
  function autoSave() { if (inGame) writeSlot('auto'); }
  async function restore(data) {
    runId++; abortWaits();
    await sleep(30);
    S = Object.assign(freshState(), data.S);
    syncAff(); // 读档 / 回溯：好感度补到永久累计的值（只增不减）
    $('#choices').classList.remove('on'); $('#center-text').classList.remove('on'); $('#chapter-card').classList.remove('on'); $('#credits').classList.remove('on');
    pendingReveal = false;
    const spr = Object.assign({}, S.sprites);
    clearSpritesNow();
    await setBg(S.bg || 'black', 'cut');
    ['a', 'b'].forEach(k => { $('#cg-' + k).style.opacity = 0; });
    if (data.S.cg) await setCg(data.S.cg, 0); else S.cg = null;
    Object.entries(spr).forEach(([id, v]) => showSprite(id, v.expr, v.pos, null, v.size));
    setFx(S.fx || 'none'); setTint(S.tint || 'none');
    lineRestore();
    tb.classList.remove('tape', 'phone'); if (S.mode && S.mode !== 'normal') tb.classList.add(S.mode);
    AudioSys.stopAmb(null, 0.5);
    if (S.bgm) { AudioSys.stopTheme(0.3); AudioSys.playTheme(S.bgm, 1.5); } else AudioSys.stopTheme(0.5);
    (S.amb || []).forEach(n => AudioSys.startAmb(n, 1.5));
    AudioSys.setMuffle(!!S.muffle, 0.3);
    await curtain(false, 400);
    const idx = keyIndex[data.key];
    pc = idx != null ? idx : 0;
    backlog = [];
    showScreen(null);
    inGame = true;
    const id = runId;
    run(id);
  }
  function slotData(slot) { return LS.get('save_' + slot, null); }
  function fmtTime(t) { const d = new Date(t); const p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; }

  let saveMode = 'save', savePage = 1;
  function openSave(mode) {
    saveMode = mode;
    const sc = $('#save-screen');
    sc.querySelector('.panel-title').textContent = mode === 'save' ? '存档' : '读档';
    if (mode === 'save' && savePage === 0) savePage = 1;
    renderSave();
    showScreen('save-screen');
  }
  function renderSave() {
    const pages = $('#save-screen .save-pages'); pages.innerHTML = '';
    const pnames = saveMode === 'load' ? ['自动·快速', '1', '2', '3', '4', '5'] : ['1', '2', '3', '4', '5'];
    pnames.forEach((n, i) => {
      const p = saveMode === 'load' ? i : i + 1;
      const b = document.createElement('button'); b.textContent = n; if (p === savePage) b.classList.add('on');
      b.onclick = () => { savePage = p; renderSave(); };
      pages.appendChild(b);
    });
    const grid = $('#save-screen .save-grid'); grid.innerHTML = '';
    const slots = savePage === 0 ? ['auto', 'quick'] : Array.from({ length: 6 }, (_, i) => String((savePage - 1) * 6 + i + 1));
    slots.forEach(slot => {
      const d = slotData(slot);
      const el = document.createElement('div'); el.className = 'save-slot' + (d ? '' : ' empty');
      const label = slot === 'auto' ? '自动存档' : slot === 'quick' ? '快速存档' : 'No.' + slot.padStart(2, '0');
      if (d) el.innerHTML = `<div class="save-thumb" style="background-image:url('${d.thumb}')"></div><div class="save-info"><div class="save-no">${label}</div><div class="save-chap">${d.chapter || ''}</div><div class="save-date">${fmtTime(d.time)}</div><div class="save-snip"></div></div>`;
      else el.innerHTML = `<div class="save-thumb"></div><div class="save-info">${label}<br>— 空 —</div>`;
      if (d) el.querySelector('.save-snip').textContent = d.text;
      el.onclick = async () => {
        if (saveMode === 'save') {
          if (d && !(await confirmBox('覆盖这个存档吗？'))) return;
          writeSlot(slot); AudioSys.se('save'); renderSave(); toast('已存档');
        } else if (d) {
          if (inGame && !(await confirmBox('读取这个存档吗？\n未保存的进度将会丢失。'))) return;
          AudioSys.se('load'); hideTitle(); restore(d);
        } else AudioSys.se('click');
      };
      grid.appendChild(el);
    });
  }

  // ================= 分支图 =================
  // 节点 = 剧本里的 @node。经过节点时记录当时的完整状态，之后可以从分支图点回来。
  const nodeSnaps = LS.get('nodes', {});
  function recordNode(id) {
    if (!inGame) return;
    nodeSnaps[id] = snapshot(); glob.lastNode = id;
    LS.set('nodes', nodeSnaps); globDirty = true;
  }
  let flowGraph = null;
  function buildFlow() {
    if (flowGraph) return flowGraph;
    const nodes = [], byIdx = {}, edges = new Set();
    let chapter = '';
    ops.forEach((op, i) => {
      if (op.t === 'cmd' && op.cmd === 'chapter') chapter = op.rest.split('|').slice(0, 2).join(' ');
      if (op.t === 'cmd' && op.cmd === 'node') { const [id, title] = op.rest.split('|'); const n = { id, title: title || id, idx: i, chapter }; nodes.push(n); byIdx[i] = n; }
      if (op.t === 'cmd' && op.cmd === 'ending') { const id = 'END_' + op.args[0]; if (!nodes.find(n => n.id === id)) { const e = A.endings.find(x => x.id === op.args[0]) || {}; const n = { id, title: e.title || op.args[0], idx: i, chapter, end: op.args[0] }; nodes.push(n); byIdx[i] = n; } }
    });
    const endIdx = {}; nodes.filter(n => n.end).forEach(n => endIdx['END_' + n.end] = n);
    // 从每个节点往后走，直到遇到下一个节点（连一条边）
    nodes.filter(n => !n.end).forEach(src => {
      const seen = new Set(), stack = [src.idx + 1];
      while (stack.length) {
        let i = stack.pop();
        while (i < ops.length && !seen.has(i)) {
          seen.add(i);
          const op = ops[i];
          if (byIdx[i] && byIdx[i] !== src) { edges.add(src.id + '>' + byIdx[i].id); break; }
          if (op.t === 'choice') { op.opts.forEach(o => { if (o.target && o.target in labels) stack.push(labels[o.target]); else stack.push(i + 1); }); break; }
          if (op.t === 'cmd' && op.cmd === 'jump') { if (op.args[0] in labels) stack.push(labels[op.args[0]]); break; }
          if (op.t === 'cmd' && op.cmd === 'if') { const t = op.rest.split('=>')[1].trim(); if (t in labels) stack.push(labels[t]); i++; continue; }
          if (op.t === 'cmd' && op.cmd === 'totitle') break;
          i++;
        }
      }
    });
    // 布局：列 = 最长路径深度；行 = 角色线
    const LANES = { bocchi: 0, nijika: 1, common: 2, ryo: 3, kita: 4 };
    const laneOf = id => {
      if (/^END_/.test(id)) { const e = id.slice(4); return e in LANES ? LANES[e] : 2; }
      const p = id[0];
      if (p === 'b') return 0; if (p === 'n') return 1; if (p === 'r') return 3; if (p === 'k') return 4; if (p === 'x') return 2;
      const s = id.match(/_(b|n|r|k)$/); if (s) return { b: 0, n: 1, r: 3, k: 4 }[s[1]];
      return 2;
    };
    const ins = {}, outs = {}; nodes.forEach(n => { ins[n.id] = []; outs[n.id] = []; });
    edges.forEach(e => { const [a, b] = e.split('>'); outs[a].push(b); ins[b].push(a); });
    const col = {}; const order = nodes.map(n => n.id);
    order.forEach(id => { col[id] = 0; });
    for (let pass = 0; pass < order.length; pass++) { let changed = false; edges.forEach(e => { const [a, b] = e.split('>'); if (col[b] < col[a] + 1) { col[b] = col[a] + 1; changed = true; } }); if (!changed) break; }
    nodes.forEach(n => { n.col = col[n.id]; n.lane = laneOf(n.id); });
    flowGraph = { nodes, edges: [...edges].map(e => e.split('>')) };
    return flowGraph;
  }
  const LANE_COLOR = ['#f49bbd', '#f6d44a', '#e9e4d8', '#5f8fe0', '#ef5a52'];
  function openFlow() {
    const g = buildFlow();
    const W = MOBILE ? 238 : 176, H = MOBILE ? 150 : 132, BW = MOBILE ? 208 : 150, BH = MOBILE ? 86 : 56, X0 = 40, Y0 = MOBILE ? 80 : 70;
    const box = $('#flow-screen .flow-canvas');
    const maxCol = Math.max(...g.nodes.map(n => n.col));
    box.style.width = (X0 * 2 + (maxCol + 1) * W) + 'px';
    box.style.height = (Y0 + 5 * H + 20) + 'px';
    const pos = {}; g.nodes.forEach(n => pos[n.id] = { x: X0 + n.col * W, y: Y0 + n.lane * H });
    const seen = id => !!nodeSnaps[id] || (id.startsWith('END_') && glob.endings.includes(id.slice(4)));
    let svg = `<svg width="${box.style.width}" height="${box.style.height}">`;
    g.edges.forEach(([a, b]) => {
      const p = pos[a], q = pos[b]; if (!p || !q) return;
      const x1 = p.x + BW, y1 = p.y + BH / 2, x2 = q.x, y2 = q.y + BH / 2, mx = (x1 + x2) / 2;
      const lit = seen(a) && seen(b);
      svg += `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}" class="fl-edge${lit ? ' lit' : ''}"/>`;
    });
    svg += '</svg>';
    // 章节标题
    let heads = ''; const firstCol = {};
    g.nodes.forEach(n => { if (n.chapter && (firstCol[n.chapter] == null || n.col < firstCol[n.chapter])) firstCol[n.chapter] = n.col; });
    const usedCols = {};
    Object.entries(firstCol).sort((a, b) => a[1] - b[1]).forEach(([c, cl]) => { if (usedCols[cl]) return; usedCols[cl] = 1; heads += `<div class="fl-chap" style="left:${X0 + cl * W}px">${c.split(' ')[0]}</div>`; });
    box.innerHTML = svg + heads + g.nodes.map(n => {
      const ok = seen(n.id), cur = glob.lastNode === n.id && !n.end;
      const p = pos[n.id];
      return `<div class="fl-node${ok ? ' on' : ''}${n.end ? ' end' : ''}${cur ? ' cur' : ''}" data-id="${n.id}" style="left:${p.x}px;top:${p.y}px;--lc:${LANE_COLOR[n.lane]}">` +
        `<span>${ok ? (n.end ? '★ ' : '') + n.title : '？？？'}</span></div>`;
    }).join('');
    box.querySelectorAll('.fl-node.on:not(.end)').forEach(el => el.onclick = async e => {
      e.stopPropagation();
      const n = g.nodes.find(x => x.id === el.dataset.id);
      const snap = nodeSnaps[n.id]; if (!snap) return;
      if (!(await confirmBox(`回到「${n.title}」这一刻吗？\n当前未保存的进度将会丢失。`))) return;
      hideTitle(); restore(snap);
    });
    $('#flow-screen .flow-legend').innerHTML = ['后藤一里', '伊地知虹夏', '共通 / 普通', '山田凉', '喜多郁代'].map((t, i) => `<span style="--lc:${LANE_COLOR[i]}">${t}</span>`).join('');
    showScreen('flow-screen');
    const wrap = $('#flow-screen .flow-wrap');
    const curEl = box.querySelector('.fl-node.cur');
    wrap.scrollLeft = curEl ? Math.max(0, parseFloat(curEl.style.left) - 600) : 0;
  }

  // ================= 界面 =================
  let curScreen = null;
  function showScreen(id) {
    $$('.panel').forEach(p => p.classList.remove('on'));
    curScreen = id;
    if (id) $('#' + id).classList.add('on');
  }
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1600); }
  function confirmBox(msg) {
    return new Promise(res => {
      const c = $('#confirm'); c.querySelector('.confirm-msg').textContent = msg; c.classList.add('on');
      c.querySelectorAll('button').forEach(b => b.onclick = e => { e.stopPropagation(); c.classList.remove('on'); res(b.dataset.v === '1'); });
    });
  }
  function openLog() {
    const list = $('#log-screen .log-list'); list.innerHTML = '';
    backlog.forEach(e => {
      const d = document.createElement('div'); d.className = 'log-item';
      d.innerHTML = '<div class="log-name"></div><div class="log-text"></div>';
      d.children[0].textContent = e.name; d.children[1].textContent = e.text;
      d.children[0].style.color = nameColor(e.name.replace('（LINE）', ''));
      list.appendChild(d);
    });
    showScreen('log-screen');
    list.scrollTop = list.scrollHeight;
  }
  function openConfig() {
    $$('#config-screen [data-cfg]').forEach(inp => {
      const k = inp.dataset.cfg;
      if (inp.type === 'checkbox') inp.checked = !!cfg[k]; else { inp.value = cfg[k]; inp.nextElementSibling.textContent = cfg[k]; }
    });
    showScreen('config-screen');
  }
  $$('#config-screen [data-cfg]').forEach(inp => {
    inp.addEventListener('input', () => {
      const k = inp.dataset.cfg;
      cfg[k] = inp.type === 'checkbox' ? inp.checked : +inp.value;
      if (inp.type !== 'checkbox') inp.nextElementSibling.textContent = cfg[k];
      if (k === 'fullscreen') { try { cfg.fullscreen ? document.documentElement.requestFullscreen() : document.exitFullscreen(); } catch (e) { } }
      applyCfg(); LS.set('cfg', cfg);
    });
  });
  function openGallery(tab = 'cg') {
    $$('.gallery-tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === tab));
    const grid = $('.gallery-grid'), endl = $('.gallery-end');
    grid.style.display = tab === 'cg' ? 'grid' : 'none'; endl.style.display = tab === 'end' ? 'flex' : 'none';
    const mus = $('.gallery-music'); mus.style.display = tab === 'music' ? 'grid' : 'none'; mus.innerHTML = '';
    Object.entries(AudioSys.TITLES).forEach(([k, title], i) => {
      const d = document.createElement('div'); d.className = 'music-item' + (AudioSys.theme === k ? ' on' : '');
      d.innerHTML = `<span class="music-no">${String(i + 1).padStart(2, '0')}</span><span>${title}</span>`;
      d.onclick = () => { AudioSys.playTheme(k, 1); openGallery('music'); };
      mus.appendChild(d);
    });
    grid.innerHTML = '';
    A.cg.forEach(c => {
      const ok = glob.cg.includes(c.id);
      const d = document.createElement('div'); d.className = 'gal-item' + (ok ? '' : ' locked');
      if (ok) { d.style.backgroundImage = `url("assets/cg/${c.id}.png")`; d.title = c.title; d.onclick = () => { const v = $('#gallery-view'); v.style.backgroundImage = `url("assets/cg/${c.id}.png")`; v.classList.add('on'); }; }
      else d.textContent = '？';
      grid.appendChild(d);
    });
    endl.innerHTML = '';
    A.endings.forEach(e => {
      const ok = glob.endings.includes(e.id);
      const d = document.createElement('div'); d.className = 'end-item' + (ok ? '' : ' locked');
      d.style.setProperty('--end-color', e.color || '#f29bb8');
      d.innerHTML = `<span class="end-tag">${e.tag}</span><span>${ok ? e.title : '？？？'}</span><span class="end-hint">${ok ? '' : e.hint}</span>`;
      endl.appendChild(d);
    });
    showScreen('gallery-screen');
  }
  $$('.gallery-tabs button').forEach(b => b.onclick = () => openGallery(b.dataset.tab));
  $('#gallery-view').onclick = e => { e.stopPropagation(); $('#gallery-view').classList.remove('on'); };
  $$('.panel-close').forEach(b => b.onclick = e => { e.stopPropagation(); if (curScreen === 'gallery-screen' && !inGame) { const k = $('#title-screen').dataset.route || 'common'; AudioSys.playTheme(A.titleBgms[k] || A.titleBgm, 1.5); } showScreen(null); });

  // ================= 标题 =================
  function showTitle() {
    inGame = false; runId++; abortWaits();
    const ts = $('#title-screen');
    // 标题画面随最后进入的分支变化；五个结局都达成后换成全员图
    const allEnd = A.endings.every(e => glob.endings.includes(e.id));
    ['title', allEnd ? 'title_complete' : null].forEach(t => { if (t && !glob.cg.includes(t)) glob.cg.push(t); });
    const key = allEnd ? 'complete' : (glob.route || 'common');
    const tb = ts.querySelector('.title-bg');
    tb.style.backgroundImage = `url("${A.titles[key] || A.titles.common}"), url("${A.titles.common}")`;
    ts.dataset.route = key;
    const hasSave = ['auto', 'quick', ...Array.from({ length: 30 }, (_, i) => String(i + 1))].some(s => slotData(s));
    ts.querySelector('[data-act=continue]').classList.toggle('disabled', !hasSave);
    ts.classList.add('on');
    AudioSys.stopAmb(null, 1); AudioSys.setMuffle(false, 0.3);
    AudioSys.playTheme(A.titleBgms[key] || A.titleBgm, 2);
  }
  function hideTitle() { $('#title-screen').classList.remove('on'); }
  async function toTitle() {
    runId++; abortWaits(); inGame = false; autoMode = false; skipMode = false; updateIndicators();
    saveGlobal();
    await curtain(true, 900);
    resetStage();
    showScreen(null);
    showTitle();
    await curtain(false, 900);
  }
  function resetStage() {
    S = freshState(); syncAff(); clearSpritesNow(); setFx('none'); setTint('none'); lineClose();
    ['bg-a', 'bg-b', 'cg-a', 'cg-b'].forEach(k => { $('#' + k).style.opacity = 0; $('#' + k).style.backgroundImage = 'none'; });
    tb.classList.add('hidden'); tb.classList.remove('tape', 'phone'); faceBox.classList.remove('on');
    $('#choices').classList.remove('on'); $('#center-text').classList.remove('on'); $('#chapter-card').classList.remove('on');
    $('#credits').classList.remove('on');
    backlog = [];
  }
  async function newGame() {
    AudioSys.stopTheme(1.5); AudioSys.stopAmb(null, 1.5);
    await curtain(true, 1000);
    hideTitle(); resetStage();
    pc = 0; runId++; inGame = true;
    const id = runId;
    run(id);
  }
  function latestSave() {
    let best = null;
    ['auto', 'quick', ...Array.from({ length: 30 }, (_, i) => String(i + 1))].forEach(s => { const d = slotData(s); if (d && (!best || d.time > best.time)) best = d; });
    return best;
  }
  $$('.title-menu button').forEach(b => b.onclick = async e => {
    e.stopPropagation(); AudioSys.init();
    const act = b.dataset.act;
    if (act === 'new') newGame();
    else if (act === 'continue') { const d = latestSave(); if (d) { await curtain(true, 600); hideTitle(); restore(d); } }
    else if (act === 'load') { savePage = 0; openSave('load'); }
    else if (act === 'gallery') openGallery('cg');
    else if (act === 'flow') openFlow();
    else if (act === 'config') openConfig();
  });

  // ================= 输入 =================
  function advance() {
    if (!inGame || curScreen || $('#confirm').classList.contains('on')) return;
    if (uiHidden) { uiHidden = false; stage.classList.remove('ui-hidden'); return; }
    if ($('#choices').classList.contains('on')) return;
    if (typing) { typeSkip = true; return; }
    if (autoMode) { autoMode = false; updateIndicators(); }
    if (skipMode) { skipMode = false; updateIndicators(); }
    fireClick('click');
  }
  stage.addEventListener('click', e => {
    if (e.target.closest('button') || e.target.closest('.panel') || e.target.closest('#title-screen')) return;
    advance();
  });
  stage.addEventListener('contextmenu', e => {
    e.preventDefault();
    if (MOBILE) return; // 手机上长按由下面的触摸手势处理
    if (curScreen) { showScreen(null); return; }
    if (!inGame) return;
    uiHidden = !uiHidden; stage.classList.toggle('ui-hidden', uiHidden);
  });
  stage.addEventListener('wheel', e => {
    if (!inGame) return;
    if (curScreen === 'log-screen') { if (e.deltaY > 0) { const l = $('#log-screen .log-list'); if (l.scrollTop + l.clientHeight >= l.scrollHeight - 4) showScreen(null); } return; }
    if (curScreen) return;
    if (e.deltaY < 0) openLog(); else advance();
  }, { passive: true });
  addEventListener('keydown', e => {
    if (e.key === 'Control') { if (inGame && !curScreen) { ctrlHeld = true; updateIndicators(); fireClick('click'); typeSkip = true; } return; }
    if (e.repeat) return;
    if (e.key === 'Escape') { if ($('#gallery-view').classList.contains('on')) $('#gallery-view').classList.remove('on'); else if (curScreen) showScreen(null); else if (inGame) openConfig(); return; }
    if (!inGame || curScreen) return;
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); advance(); }
    else if (e.key === 'a' || e.key === 'A') toggleAuto();
    else if (e.key === 'f' || e.key === 'F') openFlow();
    else if (e.key === 'g' || e.key === 'G') openAffinity();
    else if (e.key === 's' || e.key === 'S') { writeSlot('quick'); toast('快速存档完成'); }
    else if (e.key === 'l' || e.key === 'L') { const d = slotData('quick'); if (d) restore(d); }
    else if (e.key === 'h' || e.key === 'H' || e.key === 'Backspace') { uiHidden = !uiHidden; stage.classList.toggle('ui-hidden', uiHidden); }
  });
  // ---------- 触摸手势：点击前进 / 长按隐藏界面 / 下滑看记录 ----------
  if (MOBILE) {
    let t0 = null, lpTimer = null, lpFired = false;
    stage.addEventListener('touchstart', e => {
      clearTimeout(lpTimer); lpFired = false;
      if (e.touches.length !== 1) { t0 = null; return; }
      const t = e.touches[0]; t0 = { x: t.clientX, y: t.clientY, time: Date.now() };
      if (!inGame || curScreen || e.target.closest('button') || $('#choices').classList.contains('on')) return;
      lpTimer = setTimeout(() => {
        lpFired = true; uiHidden = !uiHidden; stage.classList.toggle('ui-hidden', uiHidden);
        try { navigator.vibrate && navigator.vibrate(12); } catch (err) { }
      }, 550);
    }, { passive: true });
    stage.addEventListener('touchmove', e => {
      if (!t0) return; const t = e.touches[0];
      if (Math.hypot(t.clientX - t0.x, t.clientY - t0.y) > 14) clearTimeout(lpTimer);
    }, { passive: true });
    stage.addEventListener('touchend', e => {
      clearTimeout(lpTimer);
      if (!t0) return; const s = t0; t0 = null;
      if (lpFired) { e.preventDefault(); return; } // 长按之后不再触发一次点击
      if (!inGame || curScreen || $('#choices').classList.contains('on')) return;
      const t = e.changedTouches[0], dx = t.clientX - s.x, dy = t.clientY - s.y;
      if (dy > 60 && Math.abs(dy) > Math.abs(dx) * 1.5 && Date.now() - s.time < 700) { e.preventDefault(); openLog(); }
    });
  }
  // ---------- 界面音效：所有按钮统一在这里出声（选项按钮自己处理） ----------
  const SFX_OF = el => {
    if (el.matches('.save-slot')) return null; // 存档格子：存 / 读成功时自己出声
    if (el.matches('.panel-close, #confirm button[data-v="0"]')) return 'cancel';
    if (el.matches('#confirm button[data-v="1"], .title-menu [data-act=new], .title-menu [data-act=continue]')) return 'select';
    if (el.matches('#quickmenu [data-act=qsave]')) return 'save';
    if (el.matches('#quickmenu [data-act=qload]')) return 'load';
    if (el.matches('#quickmenu [data-act=auto], #quickmenu [data-act=skip], #quickmenu [data-act=hide], label.check')) return 'toggle';
    return 'click';
  };
  document.addEventListener('click', e => {
    if (e.target.closest('#choices')) return;
    if (e.target.matches('label.check input')) return; // 点 label 会再触发一次 input 的 click
    const el = e.target.closest('button, .save-slot, .gal-item:not(.locked), .fl-node.on:not(.end), .music-item, label.check, #gallery-view');
    if (!el || el.disabled || el.classList.contains('disabled')) return;
    const snd = el.id === 'gallery-view' ? 'cancel' : SFX_OF(el); if (snd) { AudioSys.init(); AudioSys.se(snd); }
  }, true);
  let tickAt = 0;
  document.addEventListener('input', e => { if (e.target.type === 'range' && Date.now() - tickAt > 70) { tickAt = Date.now(); AudioSys.se('tick'); } }, true);

  // ---------- 安卓返回键 / 切到后台 ----------
  function goBack() {
    AudioSys.se('cancel');
    const conf = $('#confirm');
    if (conf.classList.contains('on')) { conf.querySelector('button[data-v="0"]').click(); return; }
    if ($('#gallery-view').classList.contains('on')) { $('#gallery-view').classList.remove('on'); return; }
    if (curScreen) { const pc = $('#' + curScreen + ' .panel-close'); if (pc) pc.click(); else showScreen(null); return; }
    if (uiHidden) { uiHidden = false; stage.classList.remove('ui-hidden'); return; }
    if (inGame) { confirmBox('返回标题画面吗？\n未保存的进度将会丢失。').then(ok => { if (ok) toTitle(); }); return; }
    confirmBox('退出游戏吗？').then(ok => { if (ok && CAP.Plugins.App) CAP.Plugins.App.exitApp(); });
  }
  if (NATIVE && CAP.Plugins && CAP.Plugins.App) CAP.Plugins.App.addListener('backButton', goBack);
  if (MOBILE) document.addEventListener('visibilitychange', () => AudioSys.suspend(document.hidden));
  addEventListener('keyup', e => { if (e.key === 'Control') { ctrlHeld = false; updateIndicators(); } });
  addEventListener('blur', () => { ctrlHeld = false; updateIndicators(); });
  function toggleAuto() { autoMode = !autoMode; skipMode = false; updateIndicators(); if (autoMode && !typing) modeChanged(); }
  $$('#quickmenu button').forEach(b => b.onclick = async e => {
    e.stopPropagation();
    switch (b.dataset.act) {
      case 'auto': toggleAuto(); break;
      case 'skip': skipMode = !skipMode; autoMode = false; updateIndicators(); if (skipMode) { typeSkip = true; fireClick('click'); } break;
      case 'log': openLog(); break;
      case 'flow': openFlow(); break;
      case 'aff': openAffinity(); break;
      case 'save': openSave('save'); break;
      case 'load': savePage = 0; openSave('load'); break;
      case 'qsave': writeSlot('quick'); toast('快速存档完成'); break;
      case 'qload': { const d = slotData('quick'); if (d) restore(d); else toast('没有快速存档'); break; }
      case 'config': openConfig(); break;
      case 'hide': uiHidden = true; stage.classList.add('ui-hidden'); break;
      case 'title': if (await confirmBox('返回标题画面吗？\n未保存的进度将会丢失。')) toTitle(); break;
    }
  });

  // ================= 预加载 =================
  async function preload() {
    const urls = [];
    if (MOBILE) {
      // 手机内存小：只预读标题图和四位女主的常用立绘，其余用到时再读（本地文件很快）
      Object.values(A.titles).forEach(u => urls.push(u));
      ['bocchi', 'nijika', 'ryo', 'kita'].forEach(id => urls.push(spritePath(id, 'normal')));
    } else {
      Object.keys(A.bg).forEach(k => { const u = bgSrc(k); if (u) urls.push(u); });
      Object.entries(A.ch).forEach(([id, c]) => c.exprs.forEach(x => urls.push(spritePath(id, x))));
      A.cg.forEach(c => urls.push(`assets/cg/${c.id}.png`));
      urls.push(A.titleImage);
    }
    let n = 0;
    const bar = $('#loading .loading-bar span');
    await Promise.all(urls.map(u => new Promise(r => { const i = new Image(); i.onload = i.onerror = () => { n++; bar.style.width = (n / urls.length * 100) + '%'; r(); }; i.src = u; })));
    const lt = $('#loading .loading-text');
    lt.className = 'click-start'; lt.textContent = '点击屏幕开始';
    $('#loading .loading-bar').style.opacity = 0;
    if (!QS.get('jump')) await new Promise(r => $('#loading').addEventListener('click', r, { once: true }));
    AudioSys.init(); applyCfg();
    $('#loading').classList.add('done');
    showTitle();
  }
  applyCfg();
  // 调试：?jump=标签 直接从某个标签开始；?vars=bocchi:5,kita:2 预设变量
  window.__VN = { ops, labels, cfg, S: () => S, flow: () => buildFlow(), jumpTo: (l, vars) => { hideTitle(); resetStage(); if (vars) Object.assign(S.vars, vars); jump(l); runId++; inGame = true; run(runId); } };
  preload().then(() => {
    if (QS.get('jump')) {
      const vars = {}; (QS.get('vars') || '').split(',').filter(Boolean).forEach(kv => { const [k, v] = kv.split(':'); vars[k] = +v; });
      window.__VN.jumpTo(QS.get('jump'), vars);
    }
  });
})();
