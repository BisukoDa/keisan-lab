// content/ 配下の *.test.mjs をすべて node:test で実行する（Node のバージョン差でディレクトリ指定の挙動が変わるため自前で列挙）
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT } from './lib.mjs';

const only = process.argv[2]; // 例: node scripts/test.mjs loan
const files = [];
const walk = (d) => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.test.mjs') && (!only || p.includes(`${path.sep}${only}${path.sep}`))) files.push(p);
  }
};
walk(path.join(ROOT, 'content'));
if (!files.length) {
  console.error('テストファイルが見つかりません');
  process.exit(1);
}
const r = spawnSync(process.execPath, ['--test', ...files], { stdio: 'inherit' });
process.exit(r.status ?? 1);
