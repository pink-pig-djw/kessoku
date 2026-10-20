// 由 prompts/batches.js 生成每个批次的提示词文件
const fs = require('fs'), path = require('path');
const dir = path.join(__dirname, 'prompts');
delete require.cache[require.resolve('./prompts/batches.js')];
const P = require('./prompts/_parts.js'), B = require('./prompts/batches.js');
const want = process.argv.slice(2);
for (const [name, b] of Object.entries(B)) {
  if (want.length && !want.includes(name)) continue;
  const body = b.items.map(([id, spec], i) => `${i + 1}. id "${id}": ${spec}`).join('\n');
  fs.writeFileSync(path.join(dir, name + '.body.txt'), body + '\n');
  fs.writeFileSync(path.join(dir, name + '.txt'), P.header + '\n' + P[b.style] + '\n' + body + '\n');
  console.log(name, b.items.length, 'items', b.refs ? 'refs=' + b.refs.join(',') : '');
}
