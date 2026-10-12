// ブラウザ（app.js）とビルド（scripts/build.mjs）の両方で使う描画ヘルパー。
// 依存なしの ES モジュールに保つこと。

const formatters = new Map();
function numberFormat(digits) {
  if (!formatters.has(digits)) {
    formatters.set(digits, new Intl.NumberFormat('ja-JP', { minimumFractionDigits: digits, maximumFractionDigits: digits }));
  }
  return formatters.get(digits);
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

export function formatNumber(value, digits = 0) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  // -0 を「-0」と表示しない
  return numberFormat(digits).format(Object.is(value, -0) ? 0 : value);
}

function formatCell(cell) {
  if (cell && typeof cell === 'object') return formatNumber(cell.value, cell.digits ?? 0) + (cell.unit ?? '');
  if (typeof cell === 'number') return formatNumber(cell, 0);
  return String(cell);
}

export function formatItem(item) {
  const body = typeof item.value === 'number' ? formatNumber(item.value, item.digits ?? 0) : String(item.value);
  return body + (item.unit ?? '');
}

// calculate() の戻り値 { error } | { items, table, notes } を HTML にする
export function renderResults(result) {
  if (!result) return '';
  if (result.error) return `<p class="calc-error" role="alert">${escapeHtml(result.error)}</p>`;
  let html = '';
  if (result.items?.length) {
    html += '<dl class="result-list">';
    for (const it of result.items) {
      html += `<div class="result-item${it.primary ? ' is-primary' : ''}"><dt>${escapeHtml(it.label)}</dt><dd>${escapeHtml(formatItem(it))}</dd></div>`;
    }
    html += '</dl>';
  }
  if (result.table) {
    const t = result.table;
    const table =
      '<div class="table-wrap"><table>' +
      `<thead><tr>${t.headers.map((h) => `<th scope="col">${escapeHtml(h)}</th>`).join('')}</tr></thead>` +
      `<tbody>${t.rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(formatCell(c))}</td>`).join('')}</tr>`).join('')}</tbody>` +
      '</table></div>';
    html += t.collapsible
      ? `<details class="result-table"><summary>${escapeHtml(t.caption)}</summary>${table}</details>`
      : `<div class="result-table"><p class="table-caption">${escapeHtml(t.caption)}</p>${table}</div>`;
  }
  if (result.notes?.length) {
    html += `<ul class="result-notes">${result.notes.map((n) => `<li>${escapeHtml(n)}</li>`).join('')}</ul>`;
  }
  return html;
}

// 'YYYY-MM-DD' に日数を足す（タイムゾーンの影響を受けないよう UTC で計算）
export function addDaysIso(iso, days) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function localTodayIso(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

// date 入力の default は 'YYYY-MM-DD' か 'today' / 'today+30' / 'today-7' の形式
export function resolveDefault(input, todayIso) {
  if (input.type === 'date' && typeof input.default === 'string') {
    const m = input.default.match(/^today([+-]\d+)?$/);
    if (m) return addDaysIso(todayIso, m[1] ? Number(m[1]) : 0);
  }
  return input.default;
}

// フォームの生の文字列値を、入力定義に従って型変換する
export function parseValues(inputs, raw) {
  const values = {};
  for (const input of inputs) {
    const v = raw[input.id];
    if (input.type === 'number') {
      const s = String(v ?? '').replace(/[,，\s]/g, '');
      values[input.id] = s === '' ? NaN : Number(s);
    } else {
      values[input.id] = v ?? '';
    }
  }
  return values;
}

export function isVisible(input, values) {
  if (!input.showIf) return true;
  return Object.entries(input.showIf).every(([key, expected]) =>
    Array.isArray(expected) ? expected.includes(values[key]) : values[key] === expected,
  );
}
