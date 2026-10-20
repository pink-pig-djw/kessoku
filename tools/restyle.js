// 背景重画成更「动漫」的画风：以旧图（assets/_bg_photo_backup）为构图参考，逐张生成提示词
// node tools/restyle.js name1 name2 ...   → 写出 tools/prompts/R_<name>.txt / .body.txt，并打印每张的参考图路径
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'prompts');
const P = require('./prompts/_parts.js'), B = require('./prompts/batches.js');
const spec = {};
Object.values(B).forEach(b => b.style === 'bg' && b.items.forEach(([id, s]) => spec[id] = s));
const style = `RESTYLE TASK. The attached image is an existing background of this visual novel, but it looks too PHOTOREALISTIC. Redraw the SAME scene: same place, same camera angle and composition, the same objects in the same positions, the same time of day, season, weather and lighting mood. But draw it as hand-drawn 2D ANIME BACKGROUND ART, like a background frame from the "Bocchi the Rock!" TV anime (CloverWorks, 2022):
- clean thin outlines on buildings, furniture and objects; flat cel-shaded color areas with simple soft gradients; simplified, tidy details (fewer tiny objects, simpler textures);
- noticeably LESS fine detail than the reference: walls, floors and roads as clean flat colors with only a few simple shadow or stain shapes; grass, leaves and trees drawn as simple stylized clumps with two-tone cel shading (not individual realistic blades); water as flat color bands with a few simple highlight strokes;
- a slightly brighter, cleaner, softly saturated anime palette; painted anime sky and clouds; light and shadow drawn as clear simple shapes;
- it must clearly read as an anime frame, NOT a photograph and NOT a 3D render: no photographic grain, no realistic material textures, no camera lens blur or bokeh, no HDR look, no glossy realistic reflections.
Output: landscape 3:2, 1536x1024 PNG. No people or characters, no text, no readable letters on signs (only blurry unreadable shapes), no logos, no watermark.
`;
for (const name of process.argv.slice(2)) {
  const id = 'bg_' + name;
  const body = `1. id "${id}": ${spec[id] || name}\n`;
  fs.writeFileSync(path.join(dir, `R_${name}.body.txt`), body);
  fs.writeFileSync(path.join(dir, `R_${name}.txt`), P.header + '\n' + style + '\n' + body);
}
