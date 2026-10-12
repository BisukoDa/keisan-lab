import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist');

export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const readJsonIfExists = (p, fallback) => (fs.existsSync(path.join(ROOT, p)) ? readJson(p) : fallback);

export const site = readJson('config/site.json');

// 言語ごとの設定。日本語はルート、英語は /en/ 配下に出力する（ドメインは1つ）
export const LOCALES = {
  ja: {
    code: 'ja',
    prefix: '',
    toolsDir: 'content/tools',
    pagesDir: 'content/pages',
    categoriesFile: 'config/categories.json',
    affiliatesFile: 'config/affiliates.json',
    ogLocale: 'ja_JP',
    currency: 'JPY',
  },
  en: {
    code: 'en',
    prefix: '/en',
    toolsDir: 'content/en/tools',
    pagesDir: 'content/en/pages',
    categoriesFile: 'config/categories.en.json',
    affiliatesFile: 'config/affiliates.en.json',
    ogLocale: 'en_US',
    currency: 'USD',
  },
};
export const LOCALE_CODES = Object.keys(LOCALES);

// サイト名・説明などの言語別の値（config/site.json の i18n.<code> で上書き）
export const siteFor = (code) => ({ ...site, ...(site.i18n?.[code] ?? {}) });
export const categoriesFor = (code) => readJson(LOCALES[code].categoriesFile);
export const affiliatesFor = (code) => readJsonIfExists(LOCALES[code].affiliatesFile, {});

// 互換用（日本語）
export const categories = categoriesFor('ja');
export const affiliates = affiliatesFor('ja');

// 独自ドメインを設定したら basePath は不要になる
export const basePath = site.customDomain ? '' : site.basePath;
export const baseUrl = site.customDomain ? `https://${site.customDomain}` : site.baseUrl;
export const href = (p) => `${basePath}${p}`;
export const abs = (p) => `${baseUrl}${p}`;

export function todayJst() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function loadTools({ locale = 'ja', includeDrafts = false } = {}) {
  const dir = path.join(ROOT, LOCALES[locale].toolsDir);
  if (!fs.existsSync(dir)) return [];
  const tools = [];
  for (const slug of fs.readdirSync(dir).sort()) {
    const tdir = path.join(dir, slug);
    if (!fs.statSync(tdir).isDirectory()) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(tdir, 'meta.json'), 'utf8'));
    if (meta.draft && !includeDrafts) continue;
    const article = fs.readFileSync(path.join(tdir, 'article.html'), 'utf8');
    const mod = await import(pathToFileURL(path.join(tdir, 'calc.js')).href);
    tools.push({ slug, locale, dir: tdir, meta, article, mod });
  }
  return tools;
}

export async function loadAllTools(opts = {}) {
  const all = [];
  for (const code of LOCALE_CODES) all.push(...(await loadTools({ ...opts, locale: code })));
  return all;
}

export function loadPages(locale = 'ja') {
  const dir = path.join(ROOT, LOCALES[locale].pagesDir);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((slug) => fs.statSync(path.join(dir, slug)).isDirectory())
    .map((slug) => ({
      slug,
      locale,
      meta: JSON.parse(fs.readFileSync(path.join(dir, slug, 'meta.json'), 'utf8')),
      body: fs.readFileSync(path.join(dir, slug, 'body.html'), 'utf8'),
    }));
}
