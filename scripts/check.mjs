// 機械的に判定できる品質基準をすべてここで検査する（LLM コスト 0 の一次ゲート）。
// エラーが 1 件でもあれば exit 1。警告は Fable レビューで人間的な判断に回す。
// 使い方: node scripts/check.mjs [--only <locale>/<slug>] [--no-dist]
//   --only en/tip-calculator  … そのツールだけ検査（並行して執筆しているときに他の作業中ツールを巻き込まない）
//   --no-dist                 … dist（ビルド成果物）の検査を省く
import fs from 'node:fs';
import path from 'node:path';
import { DIST, LOCALES, LOCALE_CODES, categoriesFor, affiliatesFor, basePath, loadTools, loadPages, todayJst } from './lib.mjs';
import { parseValues, resolveDefault } from '../static/render.js';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const noDist = args.includes('--no-dist') || Boolean(only);

const errors = [];
const warnings = [];
const err = (where, msg) => errors.push(`✗ ${where}: ${msg}`);
const warn = (where, msg) => warnings.push(`! ${where}: ${msg}`);

const today = todayJst();
const isDate = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const plainText = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, '');
const len = (s) => [...(s ?? '')].length;

// 言語ごとの基準
const RULES = {
  ja: {
    title: [12, 40], shortTitle: [2, 20], description: [50, 140], lead: 30, articleChars: 1200,
    // 景品表示法・金融商品取引法の観点で断定・誇大表現になりやすい語句
    banned: [/必ず(儲|もう)か/, /絶対(に)?(儲|もう)か/, /確実に(儲|もう)か/, /元本保証(され|します|です)/],
    risky: [/損しない/, /最強/, /No\.?\s?1/i, /日本一/, /業界最安/, /今すぐ/, /絶対/],
  },
  en: {
    // 文字数は空白を除いた文字数（英語 1 語 ≈ 5 文字。3,500 文字 ≈ 700 語）
    title: [20, 70], shortTitle: [3, 32], description: [70, 170], lead: 60, articleChars: 3500,
    banned: [/guaranteed (returns?|profits?|income)/i, /get rich/i, /can'?t lose/i, /no risk/i],
    risky: [/risk[- ]free/i, /#1\b|number one/i, /\bthe best\b/i, /guarantee/i, /\bact now\b/i],
    noCjk: true,
  },
};
const PLACEHOLDER = [/lorem ipsum/i, /\bTODO\b/, /\bTBD\b/, /\bFIXME\b/, /〇〇/, /○○/, /XXX/];
// オーナー方針：公開ページに制作手段（AI）を書かない
const NO_AI = /\bClaude\b|Anthropic|ChatGPT|\bGPT-\d|生成AI|人工知能|\bAI\b|ＡＩ/;
const CJK = /[぀-ヿ㐀-鿿！-｠]/;

const toolsBy = {};
for (const code of LOCALE_CODES) toolsBy[code] = await loadTools({ locale: code, includeDrafts: true });

for (const code of LOCALE_CODES) {
  const R = RULES[code];
  const cats = categoriesFor(code);
  const ads = affiliatesFor(code);
  const slugs = new Set(toolsBy[code].map((t) => t.slug));

  for (const t of toolsBy[code]) {
    const { slug, meta, article, mod } = t;
    if (only && only !== `${code}/${slug}`) continue;
    const where = `${LOCALES[code].toolsDir.replace('content/', '')}/${slug}`;

    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) err(where, 'slug は半角英小文字・数字・ハイフンのみ');

    // ---- meta.json ----
    const range = (key) => {
      const [lo, hi] = R[key];
      if (len(meta[key]) < lo || len(meta[key]) > hi) err(where, `${key} は ${lo}〜${hi} 文字（現在 ${len(meta[key])}）`);
    };
    range('title');
    range('shortTitle');
    range('description');
    if (len(meta.lead) < R.lead) err(where, `lead は ${R.lead} 文字以上`);
    if (!cats.some((c) => c.id === meta.category)) err(where, `未定義のカテゴリ ${meta.category}`);
    if (!Array.isArray(meta.keywords) || meta.keywords.length < 3) err(where, 'keywords を 3 つ以上');
    if (!isDate(meta.published) || meta.published > today) err(where, `published が不正（${meta.published}）`);
    if (meta.updated && (!isDate(meta.updated) || meta.updated < meta.published || meta.updated > today)) err(where, `updated が不正（${meta.updated}）`);
    if (!Array.isArray(meta.sources) || meta.sources.length < 1) err(where, '参考資料（sources）を 1 件以上');
    for (const s of meta.sources ?? []) {
      if (!s.title || !/^https:\/\//.test(s.url ?? '')) err(where, `sources の形式が不正: ${JSON.stringify(s)}`);
    }
    for (const k of meta.offers ?? []) if (!(k in ads)) err(where, `未定義の offers キー ${k}（${LOCALES[code].affiliatesFile}）`);
    for (const r of meta.related ?? []) if (!slugs.has(r)) err(where, `related のツールが存在しない: ${r}`);
    for (const [other, s] of Object.entries(meta.alternate ?? {})) {
      if (!LOCALES[other]) err(where, `alternate の言語が不正: ${other}`);
      else if (!toolsBy[other].some((x) => x.slug === s)) err(where, `alternate のツールが存在しない: ${other}/${s}`);
    }

    // ---- article.html ----
    const h2 = (article.match(/<h2[\s>]/g) ?? []).length;
    if (/<h1[\s>]/i.test(article)) err(where, 'article.html に h1 を書かない（テンプレートが出力する）');
    if (h2 < 3) err(where, `h2 見出しが ${h2} 個（3 個以上）`);
    const chars = plainText(article).length;
    if (chars < R.articleChars) err(where, `本文が ${chars} 文字（空白除く。${R.articleChars} 文字以上）`);
    if (/<script/i.test(article)) err(where, 'article.html に script を書かない');
    const metaText = JSON.stringify(meta);
    for (const re of [...R.banned, ...PLACEHOLDER]) if (re.test(article) || re.test(metaText)) err(where, `禁止表現 ${re}`);
    for (const re of R.risky) if (re.test(article)) warn(where, `要確認の表現 ${re}（根拠・文脈を Fable が確認）`);
    if (NO_AI.test(article) || NO_AI.test(metaText)) err(where, '公開ページに制作手段（AI 等）を書かない（オーナー方針）');
    if (R.noCjk) {
      const calcSrc = fs.readFileSync(path.join(t.dir, 'calc.js'), 'utf8').replace(/\/\/.*$|\/\*[\s\S]*?\*\//gm, '');
      if (CJK.test(article) || CJK.test(metaText) || CJK.test(calcSrc)) err(where, '英語ページに日本語（全角文字）が残っている');
    }

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
        if (R.noCjk) {
          for (const it of r.items) {
            if (typeof it.unit === 'string' && /^[A-Za-z]/.test(it.unit)) err(where, `英語の単位は先頭にスペースを付ける（"${it.label}" の unit "${it.unit}" → " ${it.unit}"）`);
          }
        }
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

  if (only) continue;

  // ---- 固定ページ ----
  for (const pg of loadPages(code)) {
    if (NO_AI.test(pg.body) || NO_AI.test(JSON.stringify(pg.meta))) err(`${LOCALES[code].pagesDir}/${pg.slug}`, '公開ページに制作手段（AI 等）を書かない（オーナー方針）');
    if (R.noCjk && (CJK.test(pg.body) || CJK.test(JSON.stringify(pg.meta)))) err(`${LOCALES[code].pagesDir}/${pg.slug}`, '英語ページに日本語（全角文字）が残っている');
  }

  // ---- 提携広告タグ ----
  // 外部から持ち込まれる HTML なので、許可した ASP のドメインだけを参照し、スクリプトを含まないことを機械的に保証する
  const AD_HOSTS = /^(px\.a8\.net|www\d*\.a8\.net|a8\.net)$/;
  for (const [key, ad] of Object.entries(ads)) {
    if (key.startsWith('_')) continue;
    const where = `${LOCALES[code].affiliatesFile}#${key}`;
    if (!ad.html) {
      if (ad.enabled) err(where, 'enabled なのに html が空');
      continue;
    }
    if (/<script|<iframe|<style|javascript:|\son\w+\s*=/i.test(ad.html)) err(where, 'script・iframe・イベント属性などは使えない');
    const tags = ad.html.match(/<[a-z][^>]*>/gi) ?? [];
    for (const tag of tags) if (!/^<(a|img|br)\b/i.test(tag)) err(where, `許可していないタグ ${tag.slice(0, 30)}`);
    for (const [, url] of ad.html.matchAll(/(?:href|src)\s*=\s*"([^"]*)"/gi)) {
      let host = '';
      try {
        host = new URL(url).hostname;
      } catch {}
      if (!AD_HOSTS.test(host)) err(where, `許可していないドメインへのリンク ${url}`);
    }
    for (const a of ad.html.match(/<a\b[^>]*>/gi) ?? []) if (!/rel="[^"]*nofollow/i.test(a)) err(where, '広告リンクに rel="nofollow" がない');
  }

  // ---- 重複（同じ言語の中で）----
  for (const key of ['title', 'description']) {
    const seen = new Map();
    for (const t of toolsBy[code]) {
      const v = t.meta[key];
      if (seen.has(v)) err(`${code}/${t.slug}`, `${key} が ${seen.get(v)} と重複`);
      seen.set(v, t.slug);
    }
  }
}

// ---- dist（ビルド成果物）----
if (!noDist) {
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
}

const total = LOCALE_CODES.map((c) => `${c} ${toolsBy[c].length}`).join(', ');
for (const w of warnings) console.log(w);
for (const e of errors) console.log(e);
console.log(`\ncheck: tools (${total})${only ? ` [only ${only}]` : ''}, ${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
