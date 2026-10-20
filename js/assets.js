// 素材清单
window.SCRIPTS = window.SCRIPTS || [];
(() => {
  // 背景：out = 户外（只有户外才允许雨雪粒子）；tint = 立绘色调（night / evening / stage / dim）
  const B = (file, opt = {}) => Object.assign({ src: `assets/bg/${file}.png` }, opt);
  const bg = {
    starry_hall: B('starry_hall'), starry_stage: B('starry_stage', { tint: 'stage' }), starry_bar: B('starry_bar'), starry_pa: B('starry_pa', { tint: 'dim' }),
    starry_storage: B('starry_storage', { tint: 'dim' }), starry_party: B('starry_party'),
    starry_stairs: B('starry_stairs', { out: true }), starry_stairs_night: B('starry_stairs_night', { out: true, tint: 'night' }),
    starry_roof: B('starry_roof', { out: true, tint: 'evening' }), vending_night: B('vending_night', { out: true, tint: 'night' }),
    shimokita_day: B('shimokita_day', { out: true }), shimokita_evening: B('shimokita_evening', { out: true, tint: 'evening' }),
    shimokita_night: B('shimokita_night', { out: true, tint: 'night' }), shimokita_xmas: B('shimokita_xmas', { out: true, tint: 'night' }),
    shimokita_rain: B('shimokita_rain', { out: true, tint: 'night' }), station: B('station', { out: true }), lot_night: B('lot_night', { out: true, tint: 'night' }),
    park: B('park', { out: true }), record_shop: B('record_shop'), cafe: B('cafe'), karaoke: B('karaoke', { tint: 'dim' }),
    classroom: B('classroom'), classroom_evening: B('classroom_evening', { tint: 'evening' }), school_stairs: B('school_stairs', { tint: 'dim' }),
    school_hall: B('school_hall'), school_gate: B('school_gate', { out: true }),
    gotoh_house: B('gotoh_house', { out: true }), gotoh_room: B('gotoh_room'), gotoh_closet: B('gotoh_closet', { tint: 'dim' }), gotoh_living: B('gotoh_living'),
    hakkei: B('hakkei', { out: true, tint: 'evening' }), train: B('train', { tint: 'evening' }),
    home: B('home', { tint: 'night' }), tooru_room: B('tooru_room', { tint: 'night' }), storage: B('storage', { tint: 'dim' }),
    studio_site: B('studio_site', { out: true, tint: 'night' }),
    ruins: B('ruins'), ryo_room: B('ryo_room', { tint: 'night' }), riverside_dawn: B('riverside_dawn', { out: true, tint: 'evening' }),
    folt: B('folt', { tint: 'stage' }), shrine_night: B('shrine_night', { out: true, tint: 'night' }),
    // 终章（2018 年 1~4 月）
    aquarium: B('aquarium', { tint: 'dim' }), aquarium_hall: B('aquarium_hall'), nijika_room: B('nijika_room'), kita_home: B('kita_home'), ochanomizu: B('ochanomizu', { out: true }),
    cemetery: B('cemetery', { out: true }), park_sakura: B('park_sakura', { out: true }), riverside_dusk: B('riverside_dusk', { out: true, tint: 'evening' }),
    black: null, white: null
  };
  // 立绘。face = [头像中心 x, y, 裁切尺寸]（由 tools/facecrop.js 计算）；scale = 相对身高
  const ch = {
    bocchi: { name: '一里', color: '#f49bbd', lineName: 'ひとり', face: [540, 233, 360], scale: 1,
      exprs: ['normal', 'smile', 'happy', 'panic', 'sad', 'surprised', 'cry', 'blush', 'serious', 'gag', 'guitar', 'winter_normal', 'winter_smile', 'winter_blush', 'winter_cry'] },
    nijika: { name: '虹夏', color: '#f6d44a', lineName: 'にじか', face: [539, 247, 360], scale: 0.985,
      exprs: ['normal', 'laugh', 'surprised', 'pout', 'soft', 'dark', 'sad', 'cry', 'blush', 'serious', 'coat_normal', 'coat_smile', 'coat_cry', 'coat_blush'] },
    ryo: { name: '凉', color: '#5f8fe0', lineName: '山田', face: [489, 232, 360], scale: 1.03,
      exprs: ['normal', 'smug', 'smile', 'surprised', 'sad', 'blush', 'hungry', 'serious', 'coat_normal', 'coat_smile', 'coat_sad', 'coat_blush'] },
    kita: { name: '喜多', color: '#ef5a52', lineName: 'きた☆', face: [490, 222, 360], scale: 0.955,
      exprs: ['normal', 'happy', 'surprised', 'pout', 'soft', 'sad', 'cry', 'blush', 'serious', 'coat_normal', 'coat_smile', 'coat_cry', 'coat_blush'] },
    seika: { name: '星歌', color: '#e8c05a', face: [488, 250, 360], scale: 1.06, exprs: ['normal', 'annoyed', 'smile', 'surprised', 'cry'] },
    pa: { name: 'PA', color: '#b9a3d8', face: [499, 222, 360], scale: 1.02, exprs: ['normal', 'smile', 'mask'] },
    kikuri: { name: '广井', color: '#c27bd6', face: [495, 227, 360], scale: 1.04, exprs: ['normal', 'serious'] },
    futari: { name: '二里', color: '#f7a8c4', face: [527, 182, 300], scale: 0.62, exprs: ['normal', 'smile'] },
    michiyo: { name: '一里妈妈', color: '#f4b3c8', face: [484, 227, 360], scale: 1.02, exprs: ['normal'] },
    naoki: { name: '一里爸爸', color: '#a8b8c8', face: [498, 222, 360], scale: 1.08, exprs: ['normal'] },
    father: { name: '修二', color: '#9fb2c9', face: [471, 242, 360], scale: 1.08, exprs: ['normal', 'sad', 'smile', 'serious'] },
    scout: { name: '星探', color: '#a0a0a0', face: [480, 232, 360], scale: 1.08, exprs: ['normal'] },
    kita_mom: { name: '喜多妈妈', color: '#e98a7e', face: [500, 227, 360], scale: 1.02, exprs: ['normal', 'smile'] },
    kita_dad: { name: '喜多爸爸', color: '#8fa3b8', face: [490, 223, 360], scale: 1.08, exprs: ['normal'] }
  };
  const speakers = { '一里': 'bocchi', '虹夏': 'nijika', '凉': 'ryo', '喜多': 'kita', '星歌': 'seika', 'PA': 'pa', '广井': 'kikuri',
    '二里': 'futari', '一里妈妈': 'michiyo', '一里爸爸': 'naoki', '修二': 'father', '星探': 'scout', '喜多妈妈': 'kita_mom', '喜多爸爸': 'kita_dad' };
  const cg = [
    { id: 'festival', title: '借来的酒杯' }, { id: 'stairs', title: '楼梯底下的合租人' }, { id: 'bin', title: '职场的垃圾桶' }, { id: 'cable', title: '三秒钟' },
    { id: 'fourtrack', title: '四条音轨' }, { id: 'closet_booth', title: '壁橱录音间' }, { id: 'kikuri', title: '躲在酒里的人' }, { id: 'pa_board', title: '调音台的后面' },
    { id: 'b_closet', title: '两个人的壁橱' }, { id: 'b_hakkei', title: '平潟湾的黄昏' }, { id: 'b_reveal', title: '透明人间' }, { id: 'b_dive', title: '这一次，有人接住了' }, { id: 'b_end', title: '一米外的 LINE' }, { id: 'b_aqua', title: '蓝色的壁橱' }, { id: 'b_door', title: '门的那一边' },
    { id: 'n_stage', title: '舞台边的茶' }, { id: 'n_lot', title: '乱掉的节拍' }, { id: 'n_birthday', title: '三十岁的礼物' }, { id: 'n_count', title: '一、二、三、四' }, { id: 'n_end', title: '初日之出' }, { id: 'n_fever', title: '融化的巧克力' }, { id: 'n_grave', title: '春分' },
    { id: 'r_nikuman', title: '半个肉包' }, { id: 'r_ruins', title: '废墟的混响' }, { id: 'r_found', title: '黎明的河岸' }, { id: 'r_sing', title: '诚实的桥段' }, { id: 'r_end', title: '借据' }, { id: 'r_choco', title: '借来的巧克力' }, { id: 'r_tape', title: '底噪' },
    { id: 'k_karaoke', title: '凌晨两点的创可贴' }, { id: 'k_rain', title: '没有名字的光' }, { id: 'k_solo', title: '第一次的 solo' }, { id: 'k_end', title: '郁代' }, { id: 'k_selfie', title: '取景框之外' }, { id: 'k_manuscript', title: '原稿纸上的名字' },
    { id: 'x_site', title: '拆掉的录音室' }, { id: 'x_end', title: '第五条音轨' }, { id: 'live', title: 'ハウリング' }, { id: 'father', title: '最后一排' },
    { id: 'title', title: '标题画面' }, { id: 'title_bocchi', title: '标题画面・一里' }, { id: 'title_nijika', title: '标题画面・虹夏' }, { id: 'title_ryo', title: '标题画面・凉' },
    { id: 'title_kita', title: '标题画面・喜多' }, { id: 'title_normal', title: '标题画面・第五条音轨' }, { id: 'title_complete', title: '标题画面・全员' }
  ];
  const endings = [
    { id: 'bocchi', tag: '一里 END', title: '你好，透明人间', color: '#f49bbd', hint: '和后藤一里一起度过……' },
    { id: 'nijika', tag: '虹夏 END', title: '替你数拍子的人', color: '#f6d44a', hint: '和伊地知虹夏一起度过……' },
    { id: 'ryo', tag: '凉 END', title: '借你一辈子', color: '#5f8fe0', hint: '和山田凉一起度过……' },
    { id: 'kita', tag: '喜多 END', title: '郁代', color: '#ef5a52', hint: '和喜多郁代一起度过……' },
    { id: 'normal', tag: 'NORMAL END', title: '第五条音轨', color: '#e9e4d8', hint: '谁也不去找的那一晚……' }
  ];
  // 标题画面：随最后进入的分支变化；五个结局全部达成后显示 complete
  const titles = { common: 'assets/cg/title.png', bocchi: 'assets/cg/title_bocchi.png', nijika: 'assets/cg/title_nijika.png', ryo: 'assets/cg/title_ryo.png',
    kita: 'assets/cg/title_kita.png', normal: 'assets/cg/title_normal.png', complete: 'assets/cg/title_complete.png' };
  const titleBgms = { common: 'title', bocchi: 'hitori', nijika: 'nijika', ryo: 'ryo', kita: 'kita', normal: 'ending', complete: 'title' };
  function credits(cgName) {
    const rows = [
      ['', '<div class="cr-t">孤独摇滚！</div><div class="cr-n" style="color:#f7d84a;letter-spacing:14px">第五条音轨</div><div class="cr-n" style="font-size:24px;letter-spacing:10px;opacity:.7">THE FIFTH TRACK</div>'],
      ['原作', 'はまじあき《ぼっち・ざ・ろっく！》（芳文社）'], ['', '<div class="cr-n" style="font-size:24px;opacity:.7">本作为非官方同人作品</div>'],
      ['剧本', 'Claude'], ['主人公', '水野 透'],
      ['结束乐队', '后藤 一里<br>伊地知 虹夏<br>山田 凉<br>喜多 郁代'],
      ['STARRY', '伊地知 星歌<br>PA 小姐'], ['特别出演', '广井 菊里<br>后藤家的各位'], ['原创角色', '水野 修二'],
      ['图像', 'Codex 图像生成（gpt-6-sol）'], ['音乐', 'Suno 生成'], ['第一次 live 的曲子', '「ギターと孤独と蒼い惑星」（结束乐队）<br>Off Vocal 耳コピ：satsukiongaku'], ['音效 · 环境音', 'WebAudio 实时合成'], ['程序', '自制 Web 视觉小说引擎'],
      ['', cgName ? `<img src="assets/cg/${cgName}.png">` : ''],
      ['', '<div class="cr-q">「工程师可以看不见。<br>但不是不在场。」</div>'],
      ['', '<div class="cr-n" style="margin-top:300px">Thank you for listening.</div>']
    ];
    return rows.map(([h, n]) => (h ? `<div class="cr-h">${h}</div>` : '') + (n.startsWith('<') ? n : `<div class="cr-n">${n}</div>`)).join('');
  }
  // 好感度：共通线（第一~三章）的选择累积；第三章结尾的分歧里，达到 need 的女主才能进入个人线
  const affinity = { need: 4, max: 7, list: [
    { v: 'bocchi', ch: 'bocchi', name: '后藤一里', sub: '秀华高中 1年2班 · 吉他 · 作词' },
    { v: 'nijika', ch: 'nijika', name: '伊地知虹夏', sub: '下北泽高中 2年 · 鼓 · 队长' },
    { v: 'ryo', ch: 'ryo', name: '山田凉', sub: '下北泽高中 2年 · 贝斯 · 作曲' },
    { v: 'kita', ch: 'kita', name: '喜多郁代', sub: '秀华高中 1年5班 · 吉他 · 主唱' }
  ] };
  window.ASSETS = { protagonist: '透', bg, ch, speakers, cg, endings, titles, titleBgms, titleBgm: 'title', titleImage: titles.common, credits, affinity };
})();
