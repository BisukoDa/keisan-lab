// 機械的に判定できる品質基準をすべてここで検査する（LLM コスト 0 の一次ゲート）。
// エラーが 1 件でもあれば exit 1。警告は Fable レビューで人間的な判断に回す。
import fs from 'node:fs';
import path from 'node:path';
import { DIST, categories, affiliates, basePath, loadTools, todayJst } from './lib.mjs';
import { parseValues, resolveDefault } from '../static/render.js';

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`✗ ${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`! ${where}: ${msg}`);

const today = todayJst();
const tools = await loadTools({ includeDrafts: true });
const slugs = new Set(tools.map((t) => t.slug));
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const plainText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, '');

// 景品表示法・金融商品取引法の観点で断定・誇大表現になりやすい語句
const BANNED = [/必ず(儲|もう)か/, /絶対(に)?(儲|もう)か/, /確実に(儲|もう)か/, /元本保証(され|します|です)/];
const PLACEHOLDER = [/lorem ipsum/i, /\bTODO\b/, /\bTBD\b/, /\bFIXME\b/, /〇〇/, /○○/, /XXX/];
const RISKY = [/損しない/, /最強/, /No\.?\s?1/i, /日本一/, /業界最安/, /今すぐ/, /絶対/];

for (const t of tools) {
  const { slug, meta, article, mod } = t;
  const where = `tools/${slug}`;

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err(where, 'slug は半角英小文字・数字・ハイフンのみ');

  // ---- meta.json ----
  const len = (s) => [...(s ?? '')].length;
  if (len(meta.title) < 12 || len(meta.title) > 40) err(where, `title は 12〜40 文字（現在 ${len(meta.title)}）`);
  if (len(meta.shortTitle) < 2 || len(meta.shortTitle) > 20) err(where, `shortTitle は 2〜20 文字（現在 ${len(meta.shortTitle)}）`);
  if (len(meta.description) < 50 || len(meta.description) > 140) err(where, `description は 50〜140 文字（現在 ${len(meta.description)}）`);
  if (len(meta.lead) < 30) err(where, 'lead は 30 文字以上');
  if (!categories.some((c) => c.id === meta.category)) err(where, `未定義のカテゴリ ${meta.category}`);
  if (!Array.isArray(meta.keywords) || meta.keywords.length < 3) err(where, 'keywords を 3 つ以上');
  if (!isDate(meta.published) || meta.published > today) err(where, `published が不正（${meta.published}）`);
  if (meta.updated && (!isDate(meta.updated) || meta.updated < meta.published || meta.updated > today)) err(where, `updated が不正（${meta.updated}）`);
  if (!Array.isArray(meta.sources) || meta.sources.length < 1) err(where, '参考資料（sources）を 1 件以上');
  for (const s of meta.sources ?? []) {
    if (!s.title || !/^https:\/\//.test(s.url ?? '')) err(where, `sources の形式が不正: ${JSON.stringify(s)}`);
  }
  for (const k of meta.offers ?? []) if (!(k in affiliates)) err(where, `未定義の offers キー ${k}`);
  for (const r of meta.related ?? []) if (!slugs.has(r)) err(where, `related のツールが存在しない: ${r}`);

  // ---- article.html ----
  const h2 = (article.match(/<h2[\s>]/g) ?? []).length;
  if (/<h1[\s>]/i.test(article)) err(where, 'article.html に h1 を書かない（テンプレートが出力する）');
  if (h2 < 3) err(where, `h2 見出しが ${h2} 個（3 個以上）`);
  const chars = plainText(article).length;
  if (chars < 1200) err(where, `本文が ${chars} 文字（1200 文字以上）`);
  if (/<script/i.test(article)) err(where, 'article.html に script を書かない');
  for (const re of [...BANNED, ...PLACEHOLDER]) if (re.test(article) || re.test(JSON.stringify(meta))) err(where, `禁止表現 ${re}`);
  for (const re of RISKY) if (re.test(article)) warn(where, `要確認の表現 ${re}（根拠・文脈を Fable が確認）`);

  // ---- calc.js ----
  if (!Array.isArray(mod.inputs) || mod.inputs.length === 0) err(where, 'calc.js が inputs を export していない');
  if (typeof mod.calculate !== 'function') err(where, 'calc.js が calculate を export していない');
  const ids = new Set();
  for (const i of mod.inputs ?? []) {
    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(i.id ?? '')) err(where, `input id が不正: ${i.id}`);
    if (ids.has(i.id)) err(where, `input id が重複: ${i.id}`);
    ids.add(i.id);
    if (!i.label) err(where, `input ${i.id} に label がない`);
    if (!['number', 'date', 'select'].includes(i.type)) err(where, `input ${i.id} の type が不正: ${i.type}`);
    if (i.default === undefined) err(where, `input ${i.id} に default がない`);
    if (i.type === 'select' && !(i.options ?? []).some((o) => String(o.value) === String(i.default))) err(where, `select ${i.id} の default が options にない`);
  }
  if (typeof mod.calculate === 'function' && Array.isArray(mod.inputs)) {
    const raw = Object.fromEntries(mod.inputs.map((i) => [i.id, String(resolveDefault(i, today) ?? '')]));
    try {
      const r = mod.calculate(parseValues(mod.inputs, raw));
      if (r?.error) err(where, `初期値で計算エラー: ${r.error}`);
      else if (!r?.items?.length) err(where, '初期値の計算結果 items が空');
      else if (!r.items.some((it) => it.primary)) warn(where, 'primary な結果項目がない');
    } catch (e) {
      err(where, `初期値で例外: ${e.message}`);
    }
  }

  // ---- tests ----
  const testFile = path.join(t.dir, 'calc.test.mjs');
  if (!fs.existsSync(testFile)) err(where, 'calc.test.mjs がない');
  else {
    const n = (fs.readFileSync(testFile, 'utf8').match(/\btest\(/g) ?? []).length;
    if (n < 4) err(where, `テストが ${n} 件（4 件以上。境界値・異常値・公的資料の計算例を含める）`);
  }
}

// ---- 重複 ----
for (const key of ['title', 'description']) {
  const seen = new Map();
  for (const t of tools) {
    const v = t.meta[key];
    if (seen.has(v)) err(`tools/${t.slug}`, `${key} が ${seen.get(v)} と重複`);
    seen.set(v, t.slug);
  }
}

// ---- dist（ビルド成果物）----
if (!fs.existsSync(DIST)) err('dist', 'ビルドされていない（npm run build を先に実行）');
else {
  const htmlFiles = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.html')) htmlFiles.push(p);
    }
  };
  walk(DIST);
  for (const file of htmlFiles) {
    const rel = path.relative(DIST, file).replaceAll('\\', '/');
    const html = fs.readFileSync(file, 'utf8');
    if (!/<title>[^<]+<\/title>/.test(html)) err(rel, 'title がない');
    if (!/<meta name="description" content="[^"]+">/.test(html)) err(rel, 'meta description がない');
    for (const [, url] of html.matchAll(/(?:href|src)="([^"]+)"/g)) {
      if (!url.startsWith('/')) continue;
      if (basePath && !url.startsWith(`${basePath}/`)) {
        err(rel, `basePath なしの内部リンク ${url}`);
        continue;
      }
      let target = url.slice(basePath.length).split(/[?#]/)[0];
      if (target.endsWith('/')) target += 'index.html';
      if (!fs.existsSync(path.join(DIST, target))) err(rel, `リンク切れ ${url}`);
    }
  }
}

for (const w of warnings) console.log(w);
for (const e of errors) console.log(e);
console.log(`\ncheck: ${tools.length} tools, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
