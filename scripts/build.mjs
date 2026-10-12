// content/ と config/ から dist/ に静的サイトを生成する（外部依存なし・多言語対応）
// 日本語はルート（/）、英語は /en/ 配下。対応するページ同士は hreflang でつなぐ。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { escapeHtml as esc, renderResults, resolveDefault, parseValues, isVisible } from '../static/render.js';
import { ROOT, DIST, site, LOCALES, LOCALE_CODES, siteFor, categoriesFor, affiliatesFor, href, abs, todayJst, loadTools, loadPages } from './lib.mjs';
import { UI } from './i18n.mjs';

const today = todayJst();

const assetVersion = crypto
  .createHash('sha1')
  .update(['style.css', 'app.js', 'render.js'].map((f) => fs.readFileSync(path.join(ROOT, 'static', f))).join(''))
  .digest('hex')
  .slice(0, 8);

// ---- 言語ごとのデータを読み込む ----
const L = {};
for (const code of LOCALE_CODES) {
  const tools = await loadTools({ locale: code });
  const categories = categoriesFor(code);
  L[code] = {
    code,
    cfg: LOCALES[code],
    t: UI[code],
    site: siteFor(code),
    tools,
    pages: loadPages(code),
    affiliates: affiliatesFor(code),
    categories,
    activeCategories: categories.filter((c) => tools.some((t) => t.meta.category === c.id)),
  };
}

const P = (code, p) => `${LOCALES[code].prefix}${p}`; // 言語の接頭辞つきのサイト内パス
const toolPath = (t) => P(t.locale, `/tools/${t.slug}/`);

// ---- 言語間の対応関係（hreflang）----
// ツール：meta.alternate = { ja: 'percent' } のように片側に書けば、逆向きも自動でつなぐ
const altMap = new Map(); // `${code}:${path}` → { ja: path, en: path }
function linkAlternates(pairs) {
  const group = Object.fromEntries(pairs);
  for (const [code, p] of pairs) altMap.set(`${code}:${p}`, group);
}
for (const code of LOCALE_CODES) {
  for (const t of L[code].tools) {
    for (const [other, slug] of Object.entries(t.meta.alternate ?? {})) {
      const target = L[other]?.tools.find((x) => x.slug === slug);
      if (target) linkAlternates([[code, toolPath(t)], [other, toolPath(target)]]);
    }
  }
}
linkAlternates(LOCALE_CODES.map((c) => [c, P(c, '/')]));
for (const pg of L.ja.pages) if (L.en.pages.some((x) => x.slug === pg.slug)) linkAlternates(LOCALE_CODES.map((c) => [c, P(c, `/${pg.slug}/`)]));
for (const c of L.ja.activeCategories) {
  if (L.en.activeCategories.some((x) => x.id === c.id)) linkAlternates(LOCALE_CODES.map((code) => [code, P(code, `/category/${c.id}/`)]));
}

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

function layout(ctx, { title, description, path: p, body, jsonLd = [], noindex = false, ogType = 'website' }) {
  const { code, t, site: s } = ctx;
  const isHome = p === P(code, '/');
  const fullTitle = isHome ? `${s.name}${t.titleSep}${s.tagline}` : `${title}${t.titleSep}${s.name}`;
  const ld = jsonLd.map((j) => `<script type="application/ld+json">${JSON.stringify(j).replace(/</g, '\\u003c')}</script>`).join('\n');

  const alts = altMap.get(`${code}:${p}`);
  const hreflang = alts
    ? Object.entries(alts).map(([c, ap]) => `<link rel="alternate" hreflang="${c}" href="${abs(ap)}">`).join('\n') +
      `\n<link rel="alternate" hreflang="x-default" href="${abs(alts.en ?? alts.ja)}">\n`
    : '';
  const sw = t.switchTo;
  const switchHref = alts?.[sw.code] ?? P(sw.code, '/');

  return `<!doctype html>
<html lang="${code}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${abs(p)}">
${hreflang}${noindex ? '<meta name="robots" content="noindex">\n' : ''}<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${abs(p)}">
<meta property="og:site_name" content="${esc(s.name)}">
<meta property="og:locale" content="${ctx.cfg.ogLocale}">
<meta name="twitter:card" content="summary">
<meta name="theme-color" content="#0b6e4f">
<link rel="icon" href="${href('/assets/icon.svg')}" type="image/svg+xml">
<link rel="stylesheet" href="${href('/assets/style.css')}?v=${assetVersion}">
${headExtras()}${ld}
</head>
<body>
<header class="site-header"><div class="wrap">
<a class="site-name" href="${href(P(code, '/'))}">${esc(s.name)}</a>
<nav class="site-nav" aria-label="${esc(t.navCategories)}">${ctx.activeCategories.map((c) => `<a href="${href(P(code, `/category/${c.id}/`))}">${esc(c.name)}</a>`).join('')}</nav>
<a class="lang-switch" href="${href(switchHref)}" hreflang="${sw.code}" lang="${sw.code}">${esc(sw.label)}</a>
</div></header>
<main><div class="wrap">
${body}
</div></main>
<footer class="site-footer"><div class="wrap">
<nav aria-label="${esc(t.navSiteInfo)}">${ctx.pages.map((pg) => `<a href="${href(P(code, `/${pg.slug}/`))}">${esc(pg.meta.title)}</a>`).join('')}</nav>
<p>© ${today.slice(0, 4)} ${esc(s.name)}</p>
</div></footer>
<script type="module" src="${href('/assets/app.js')}?v=${assetVersion}"></script>
</body>
</html>
`;
}

function breadcrumb(ctx, items) {
  const html = `<nav class="breadcrumb" aria-label="${esc(ctx.t.breadcrumb)}"><ol>${items
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
  return `<li data-tool-card data-search="${esc(search)}"><a href="${href(toolPath(t))}"><span class="card-title">${esc(t.meta.shortTitle)}</span><span class="card-desc">${esc(t.meta.description)}</span></a></li>`;
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
  const prefix = input.prefix ? `<span class="unit">${esc(input.prefix)}</span>` : '';
  const unit = input.unit ? `<span class="unit">${esc(input.unit)}</span>` : '';
  const help = input.help ? `<p class="help">${esc(input.help)}</p>` : '';
  return `<div class="field" data-field="${input.id}"${visible ? '' : ' hidden'}><label for="${id}">${esc(input.label)}</label><div class="control">${prefix}${control}${unit}</div>${help}</div>`;
}

function toolPage(ctx, tool) {
  const { t } = ctx;
  const { meta, mod } = tool;
  const cat = ctx.categories.find((c) => c.id === meta.category);
  const p = toolPath(tool);

  const raw = Object.fromEntries(mod.inputs.map((i) => [i.id, String(resolveDefault(i, today) ?? '')]));
  const values = parseValues(mod.inputs, raw);
  const fields = mod.inputs.map((i) => renderField(i, raw[i.id], isVisible(i, values))).join('\n');
  const initial = renderResults(mod.calculate(values));

  const offers = (meta.offers ?? []).map((k) => ctx.affiliates[k]).filter((a) => a?.enabled && a.html);
  const prNotice = offers.length ? `<p class="pr-notice">${esc(t.prNotice)}</p>` : '';
  const offerHtml = offers
    .map((o) => `<aside class="offer" aria-label="${esc(t.adLabel)}"><h2>${esc(o.heading)}</h2><p>${esc(o.text)}</p>${o.html}</aside>`)
    .join('\n');

  const relatedSlugs = [...(meta.related ?? []), ...ctx.tools.filter((x) => x.meta.category === meta.category).map((x) => x.slug)];
  const related = [...new Set(relatedSlugs)]
    .filter((s) => s !== tool.slug)
    .map((s) => ctx.tools.find((x) => x.slug === s))
    .filter(Boolean)
    .slice(0, 6);

  const sources = meta.sources?.length
    ? `<section class="sources"><h2>${esc(t.sources)}</h2><ul>${meta.sources
        .map((s) => `<li><a href="${esc(s.url)}" rel="noopener" target="_blank">${esc(s.title)}</a></li>`)
        .join('')}</ul></section>`
    : '';

  const bc = breadcrumb(ctx, [
    { name: t.home, path: P(ctx.code, '/') },
    { name: cat.name, path: P(ctx.code, `/category/${cat.id}/`) },
    { name: meta.shortTitle, path: p },
  ]);

  const dates = `${t.published} <time datetime="${meta.published}">${meta.published}</time>${
    meta.updated && meta.updated !== meta.published ? `${t.dateSep}${t.updated} <time datetime="${meta.updated}">${meta.updated}</time>` : ''
  }`;

  const body = `${bc.html}
<article>
<header>
<h1>${esc(meta.title)}</h1>
<p class="lead">${esc(meta.lead)}</p>
<p class="page-meta">${dates}</p>
${prNotice}
</header>
<section class="calc" data-calc data-module="./calc.js" data-msg-copied="${esc(t.copied)}" data-msg-copy-failed="${esc(t.copyFailed)}" data-msg-error="${esc(t.calcError)}" aria-label="${esc(t.calcLabel)}">
<form novalidate>
${fields}
</form>
<div class="calc-results" data-results aria-live="polite">${initial}</div>
<div class="calc-actions"><button type="button" class="btn" data-copy-url>${esc(t.copyUrl)}</button><a class="btn" href="${href(p)}">${esc(t.reset)}</a></div>
<noscript><p class="calc-error">${esc(t.noscript)}</p></noscript>
</section>
<div class="article-body">
${tool.article.trim().replace(/<table>/g, '<div class="table-wrap"><table>').replace(/<\/table>/g, '</table></div>')}
</div>
${offerHtml}
${sources}
${related.length ? `<section><h2>${esc(t.related)}</h2><ul class="card-list">${related.map(card).join('')}</ul></section>` : ''}
</article>`;

  const app = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: meta.title,
    description: meta.description,
    url: abs(p),
    applicationCategory: 'UtilitiesApplication',
    operatingSystem: 'All',
    inLanguage: ctx.code,
    datePublished: meta.published,
    dateModified: meta.updated ?? meta.published,
    offers: { '@type': 'Offer', price: '0', priceCurrency: ctx.cfg.currency },
  };
  return layout(ctx, { title: meta.title, description: meta.description, path: p, body, jsonLd: [app, bc.ld] });
}

function indexPage(ctx) {
  const { t, site: s } = ctx;
  const latest = [...ctx.tools].sort((a, b) => b.meta.published.localeCompare(a.meta.published) || a.slug.localeCompare(b.slug)).slice(0, 6);
  const sections = ctx.activeCategories
    .map((c) => {
      const list = ctx.tools.filter((x) => x.meta.category === c.id);
      return `<section><h2><a href="${href(P(ctx.code, `/category/${c.id}/`))}">${esc(c.name)}</a></h2><ul class="card-list">${list.map(card).join('')}</ul></section>`;
    })
    .join('\n');
  const body = `<h1>${esc(s.name)}</h1>
<p class="lead">${esc(s.description)}</p>
<p><input type="search" class="search-box" data-tool-search placeholder="${esc(t.searchPlaceholder)}" aria-label="${esc(t.searchLabel)}"></p>
<section><h2>${esc(t.latest)}</h2><ul class="card-list">${latest.map(card).join('')}</ul></section>
${sections}`;
  const ld = { '@context': 'https://schema.org', '@type': 'WebSite', name: s.name, url: abs(P(ctx.code, '/')), inLanguage: ctx.code };
  return layout(ctx, { title: s.name, description: s.description, path: P(ctx.code, '/'), body, jsonLd: [ld] });
}

function categoryPage(ctx, c) {
  const { t } = ctx;
  const list = ctx.tools.filter((x) => x.meta.category === c.id);
  const p = P(ctx.code, `/category/${c.id}/`);
  const bc = breadcrumb(ctx, [
    { name: t.home, path: P(ctx.code, '/') },
    { name: c.name, path: p },
  ]);
  const body = `${bc.html}<h1>${esc(t.categoryH1(c.name))}</h1><p class="lead">${esc(c.description)}</p><ul class="card-list">${list.map(card).join('')}</ul>`;
  return layout(ctx, { title: t.categoryTitle(c.name), description: c.description, path: p, body, jsonLd: [bc.ld] });
}

function staticPage(ctx, pg) {
  const vars = { siteName: ctx.site.name, contactUrl: site.contactUrl, repoUrl: site.repoUrl, baseUrl: abs(P(ctx.code, '/')) };
  const body = pg.body.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? esc(vars[k]) : m));
  return layout(ctx, { title: pg.meta.title, description: pg.meta.description, path: P(ctx.code, `/${pg.slug}/`), body: `<h1>${esc(pg.meta.title)}</h1>\n${body}` });
}

function copyDir(from, to) {
  if (!fs.existsSync(from)) return;
  fs.cpSync(from, to, { recursive: true });
}

// ---- build ----
fs.rmSync(DIST, { recursive: true, force: true });
copyDir(path.join(ROOT, 'static'), path.join(DIST, 'assets'));
copyDir(path.join(ROOT, 'content/lib'), path.join(DIST, 'lib'));

const urls = [];
for (const code of LOCALE_CODES) {
  const ctx = L[code];
  const out = (p) => (p.replace(/^\//, '') + 'index.html');
  write(out(P(code, '/')), indexPage(ctx));
  const newest = ctx.tools.reduce((m, x) => ((x.meta.updated ?? x.meta.published) > m ? x.meta.updated ?? x.meta.published : m), '');
  urls.push({ loc: P(code, '/'), lastmod: newest || today });
  for (const c of ctx.activeCategories) {
    write(out(P(code, `/category/${c.id}/`)), categoryPage(ctx, c));
    urls.push({ loc: P(code, `/category/${c.id}/`) });
  }
  for (const x of ctx.tools) {
    const p = toolPath(x);
    write(out(p), toolPage(ctx, x));
    fs.copyFileSync(path.join(x.dir, 'calc.js'), path.join(DIST, p, 'calc.js'));
    urls.push({ loc: p, lastmod: x.meta.updated ?? x.meta.published });
  }
  for (const pg of ctx.pages) {
    write(out(P(code, `/${pg.slug}/`)), staticPage(ctx, pg));
    urls.push({ loc: P(code, `/${pg.slug}/`), lastmod: pg.meta.updated });
  }
}

// GitHub Pages の 404 はサイトに1つなので2言語で表示する
write(
  '404.html',
  layout(L.ja, {
    title: 'ページが見つかりません / Page not found',
    description: 'お探しのページは見つかりませんでした。 The page you are looking for was not found.',
    path: '/404.html',
    noindex: true,
    body: `<h1>ページが見つかりません</h1><p>URLが変わったか、削除された可能性があります。<a href="${href('/')}">トップページ</a>から計算ツールをお探しください。</p>
<h2 lang="en">Page not found</h2><p lang="en">The page may have moved or been removed. <a href="${href('/en/')}">Browse all calculators</a>.</p>`,
  }),
);

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

console.log(
  LOCALE_CODES.map((c) => `${c}: ${L[c].tools.length} tools, ${L[c].activeCategories.length} categories, ${L[c].pages.length} pages`).join(' / ') + ' → dist/',
);
