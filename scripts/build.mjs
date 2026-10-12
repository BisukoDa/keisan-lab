// content/ と config/ から dist/ に静的サイトを生成する（外部依存なし）
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { escapeHtml as esc, renderResults, resolveDefault, parseValues, isVisible } from '../static/render.js';
import { ROOT, DIST, site, categories, affiliates, href, abs, todayJst, loadTools, loadPages } from './lib.mjs';

const today = todayJst();
const tools = await loadTools();
const pages = loadPages();

const assetVersion = crypto
  .createHash('sha1')
  .update(['style.css', 'app.js', 'render.js'].map((f) => fs.readFileSync(path.join(ROOT, 'static', f))).join(''))
  .digest('hex')
  .slice(0, 8);

const activeCategories = categories.filter((c) => tools.some((t) => t.meta.category === c.id));
const toolUrl = (t) => `/tools/${t.slug}/`;

function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function headExtras() {
  let s = '';
  if (site.searchConsoleVerification) s += `<meta name="google-site-verification" content="${esc(site.searchConsoleVerification)}">\n`;
  if (site.adsense?.client) {
    s += `<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${esc(site.adsense.client)}" crossorigin="anonymous"></script>\n`;
  }
  if (site.analytics?.ga4) {
    const id = esc(site.analytics.ga4);
    s += `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>\n`;
  }
  if (site.analytics?.cloudflareToken) {
    s += `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${esc(site.analytics.cloudflareToken)}"}'></script>\n`;
  }
  return s;
}

function layout({ title, description, path: p, body, jsonLd = [], noindex = false, ogType = 'website' }) {
  const fullTitle = p === '/' ? `${site.name}｜${site.tagline}` : `${title}｜${site.name}`;
  const ld = jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="${site.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(p)}">
${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(p)}">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:locale" content="ja_JP">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0b6e4f">
<link rel="icon" href="${href('/assets/icon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${href('/assets/style.css')}?v=${assetVersion}">
${headExtras()}${ld}
</head>
<body>
<header class="site-header"><div class="wrap">
<a class="site-name" href="${href('/')}">${esc(site.name)}</a>
<nav class="site-nav" aria-label="カテゴリ">${activeCategories.map((c) => `<a href="${href(`/category/${c.id}/`)}">${esc(c.name)}</a>`).join('')}</nav>
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer class="site-footer"><div class="wrap">
<nav aria-label="サイト情報">${pages.map((pg) => `<a href="${href(`/${pg.slug}/`)}">${esc(pg.meta.title)}</a>`).join('')}</nav>
<p>© ${today.slice(0, 4)} ${esc(site.name)}</p>
</div></footer>
<script type="module" src="${href('/assets/app.js')}?v=${assetVersion}"></script>
</body>
</html>
`;
}

function breadcrumb(items) {
  const html = `<nav class="breadcrumb" aria-label="パンくずリスト"><ol>${items
    .map((it, i) => (i === items.length - 1 ? `<li aria-current="page">${esc(it.name)}</li>` : `<li><a href="${href(it.path)}">${esc(it.name)}</a></li>`))
    .join('')}</ol></nav>`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.path) })),
  };
  return { html, ld };
}

function card(t) {
  const search = [t.meta.title, t.meta.shortTitle, ...(t.meta.keywords ?? [])].join(' ').toLowerCase();
  return `<li data-tool-card data-search="${esc(search)}"><a href="${href(toolUrl(t))}"><span class="card-title">${esc(t.meta.shortTitle)}</span><span class="card-desc">${esc(t.meta.description)}</span></a></li>`;
}

function renderField(input, value, visible) {
  const id = `f-${input.id}`;
  let control;
  if (input.type === 'select') {
    control = `<select id="${id}" name="${input.id}">${input.options
      .map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(value) ? ' selected' : ''}>${esc(o.label)}</option>`)
      .join('')}</select>`;
  } else if (input.type === 'date') {
    const lim = ['min', 'max'].filter((k) => input[k]).map((k) => ` ${k}="${esc(input[k])}"`).join('');
    control = `<input type="date" id="${id}" name="${input.id}" value="${esc(value)}"${lim}>`;
  } else {
    const lim = ['min', 'max'].filter((k) => input[k] !== undefined).map((k) => ` ${k}="${input[k]}"`).join('');
    control = `<input type="number" inputmode="decimal" id="${id}" name="${input.id}" value="${esc(value)}"${lim} step="${input.step ?? 'any'}">`;
  }
  const unit = input.unit ? `<span class="unit">${esc(input.unit)}</span>` : '';
  const help = input.help ? `<p class="help">${esc(input.help)}</p>` : '';
  return `<div class="field" data-field="${input.id}"${visible ? '' : ' hidden'}><label for="${id}">${esc(input.label)}</label><div class="control">${control}${unit}</div>${help}</div>`;
}

function toolPage(tool) {
  const { meta, mod } = tool;
  const cat = categories.find((c) => c.id === meta.category);
  const p = toolUrl(tool);

  const raw = Object.fromEntries(mod.inputs.map((i) => [i.id, String(resolveDefault(i, today) ?? '')]));
  const values = parseValues(mod.inputs, raw);
  const fields = mod.inputs.map((i) => renderField(i, raw[i.id], isVisible(i, values))).join('\n');
  const initial = renderResults(mod.calculate(values));

  const offers = (meta.offers ?? []).map((k) => affiliates[k]).filter((a) => a?.enabled && a.html);
  const prNotice = offers.length ? '<p class="pr-notice">本ページはプロモーションを含みます</p>' : '';
  const offerHtml = offers
    .map((o) => `<aside class="offer" aria-label="広告"><h2>${esc(o.heading)}</h2><p>${esc(o.text)}</p>${o.html}</aside>`)
    .join('\n');

  const relatedSlugs = [...(meta.related ?? []), ...tools.filter((t) => t.meta.category === meta.category).map((t) => t.slug)];
  const related = [...new Set(relatedSlugs)]
    .filter((s) => s !== tool.slug)
    .map((s) => tools.find((t) => t.slug === s))
    .filter(Boolean)
    .slice(0, 6);

  const sources = meta.sources?.length
    ? `<section class="sources"><h2>参考資料</h2><ul>${meta.sources
        .map((s) => `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.title)}</a></li>`)
        .join('')}</ul></section>`
    : '';

  const bc = breadcrumb([
    { name: 'ホーム', path: '/' },
    { name: cat.name, path: `/category/${cat.id}/` },
    { name: meta.shortTitle, path: p },
  ]);

  const body = `${bc.html}
<article>
<header>
<h1>${esc(meta.title)}</h1>
<p class="lead">${esc(meta.lead)}</p>
<p class="page-meta">公開日 <time datetime="${meta.published}">${meta.published}</time>${meta.updated && meta.updated !== meta.published ? ` ／ 更新日 <time datetime="${meta.updated}">${meta.updated}</time>` : ''}</p>
${prNotice}
</header>
<section class="calc" data-calc data-module="./calc.js" aria-label="計算ツール">
<form novalidate>
${fields}
</form>
<div class="calc-results" data-results aria-live="polite">${initial}</div>
<div class="calc-actions"><button type="button" class="btn" data-copy-url>この条件のURLをコピー</button><a class="btn" href="${href(p)}">初期値に戻す</a></div>
<noscript><p class="calc-error">計算ツールを使うには JavaScript を有効にしてください。</p></noscript>
</section>
<div class="article-body">
${tool.article.trim().replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')}
</div>
${offerHtml}
${sources}
${related.length ? `<section><h2>関連する計算ツール</h2><ul class="card-list">${related.map(card).join('')}</ul></section>` : ''}
</article>`;

  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: meta.title,
    description: meta.description,
    url: abs(p),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'All',
    inLanguage: 'ja',
    datePublished: meta.published,
    dateModified: meta.updated ?? meta.published,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
  };
  return layout({ title: meta.title, description: meta.description, path: p, body, jsonLd: [app, bc.ld] });
}

function indexPage() {
  const latest = [...tools].sort((a, b) => b.meta.published.localeCompare(a.meta.published)).slice(0, 6);
  const sections = activeCategories
    .map((c) => {
      const list = tools.filter((t) => t.meta.category === c.id);
      return `<section><h2><a href="${href(`/category/${c.id}/`)}">${esc(c.name)}</a></h2><ul class="card-list">${list.map(card).join('')}</ul></section>`;
    })
    .join('\n');
  const body = `<h1>${esc(site.name)}</h1>
<p class="lead">${esc(site.description)}</p>
<p><input type="search" class="search-box" data-tool-search placeholder="ツールを探す（例：ローン、日数、パーセント）" aria-label="計算ツールを検索"></p>
<section><h2>新着の計算ツール</h2><ul class="card-list">${latest.map(card).join('')}</ul></section>
${sections}`;
  const ld = { '@context': 'https://schema.org', '@type': 'WebSite', name: site.name, url: abs('/'), inLanguage: 'ja' };
  return layout({ title: site.name, description: site.description, path: '/', body, jsonLd: [ld] });
}

function categoryPage(c) {
  const list = tools.filter((t) => t.meta.category === c.id);
  const p = `/category/${c.id}/`;
  const bc = breadcrumb([
    { name: 'ホーム', path: '/' },
    { name: c.name, path: p },
  ]);
  const body = `${bc.html}<h1>${esc(c.name)}の計算ツール</h1><p class="lead">${esc(c.description)}</p><ul class="card-list">${list.map(card).join('')}</ul>`;
  return layout({ title: `${c.name}の計算ツール一覧`, description: c.description, path: p, body, jsonLd: [bc.ld] });
}

function staticPage(pg) {
  const vars = { siteName: site.name, contactUrl: site.contactUrl, repoUrl: site.repoUrl, baseUrl: abs('/') };
  const body = pg.body.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : m));
  return layout({ title: pg.meta.title, description: pg.meta.description, path: `/${pg.slug}/`, body: `<h1>${esc(pg.meta.title)}</h1>\n${body}` });
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
}

// ---- build ----
fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(ROOT, 'static'), path.join(DIST, 'assets'));
copyDir(path.join(ROOT, 'content/lib'), path.join(DIST, 'lib'));

write('index.html', indexPage());
for (const c of activeCategories) write(`category/${c.id}/index.html`, categoryPage(c));
for (const t of tools) {
  write(`tools/${t.slug}/index.html`, toolPage(t));
  fs.copyFileSync(path.join(t.dir, 'calc.js'), path.join(DIST, 'tools', t.slug, 'calc.js'));
}
for (const pg of pages) write(`${pg.slug}/index.html`, staticPage(pg));
write(
  '404.html',
  layout({
    title: 'ページが見つかりません',
    description: 'お探しのページは見つかりませんでした。',
    path: '/404.html',
    noindex: true,
    body: `<h1>ページが見つかりません</h1><p>URLが変わったか、削除された可能性があります。<a href="${href('/')}">トップページ</a>から計算ツールをお探しください。</p>`,
  }),
);

const urls = [
  { loc: '/', lastmod: tools.reduce((m, t) => ((t.meta.updated ?? t.meta.published) > m ? t.meta.updated ?? t.meta.published : m), '') || today },
  ...activeCategories.map((c) => ({ loc: `/category/${c.id}/` })),
  ...tools.map((t) => ({ loc: toolUrl(t), lastmod: t.meta.updated ?? t.meta.published })),
  ...pages.map((pg) => ({ loc: `/${pg.slug}/`, lastmod: pg.meta.updated })),
];
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${abs(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`)
    .join('\n')}\n</urlset>\n`,
);
write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`);
if (site.adsense?.client) write('ads.txt', `google.com, ${site.adsense.client.replace(/^ca-/, '')}, DIRECT, f08c47fec0942fa0\n`);
if (site.customDomain) write('CNAME', `${site.customDomain}\n`);
write('.nojekyll', '');

console.log(`built ${tools.length} tools, ${activeCategories.length} categories, ${pages.length} pages → dist/`);
