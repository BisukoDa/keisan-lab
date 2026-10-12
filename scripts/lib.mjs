import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const DIST = path.join(ROOT, 'dist');
export const TOOLS_DIR = path.join(ROOT, 'content/tools');

export const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));

export const site = readJson('config/site.json');
export const categories = readJson('config/categories.json');
export const affiliates = readJson('config/affiliates.json');

// 独自ドメインを設定したら basePath は不要になる
export const basePath = site.customDomain ? '' : site.basePath;
export const baseUrl = site.customDomain ? `https://${site.customDomain}` : site.baseUrl;
export const href = (p) => `${basePath}${p}`;
export const abs = (p) => `${baseUrl}${p}`;

export function todayJst() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

export async function loadTools({ includeDrafts = false } = {}) {
  const tools = [];
  for (const slug of fs.readdirSync(TOOLS_DIR).sort()) {
    const dir = path.join(TOOLS_DIR, slug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
    if (meta.draft && !includeDrafts) continue;
    const article = fs.readFileSync(path.join(dir, 'article.html'), 'utf8');
    const mod = await import(pathToFileURL(path.join(dir, 'calc.js')).href);
    tools.push({ slug, dir, meta, article, mod });
  }
  return tools;
}

export function loadPages() {
  const dir = path.join(ROOT, 'content/pages');
  return fs
    .readdirSync(dir)
    .filter((slug) => fs.statSync(path.join(dir, slug)).isDirectory())
    .map((slug) => ({
      slug,
      meta: JSON.parse(fs.readFileSync(path.join(dir, slug, 'meta.json'), 'utf8')),
      body: fs.readFileSync(path.join(dir, slug, 'body.html'), 'utf8'),
    }));
}
