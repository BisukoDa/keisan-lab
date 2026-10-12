// meta.json の参考資料（sources）のリンク切れを検出する（LLM コスト 0。ネットワークが必要）。
// 使い方: node scripts/check-sources.mjs [slug ...]   ※ slug 省略時は全ツール
// - リダイレクト先がエラーページ（/error/、404 を含む URL）ならリンク切れ
// - e-Gov 法令ページは常に 200 を返すため、法令 API で法令 ID の実在を確認する
// - ネットワークに出られない環境（クラウドの許可リスト外など）は「未確認」として警告に留め、Fable の審査に委ねる
import { loadAllTools } from './lib.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const only = new Set(process.argv.slice(2));
const tools = (await loadAllTools({ includeDrafts: true })).filter((t) => only.size === 0 || only.has(t.slug));

async function check(url) {
  const egov = url.match(/^https:\/\/laws\.e-gov\.go\.jp\/law\/([0-9A-Za-z_]+)/);
  if (egov) {
    const res = await fetch(`https://laws.e-gov.go.jp/api/2/law_data/${egov[1]}?response_format=json&omit_amendment_suppl_provision=true`, { headers: { 'user-agent': UA } });
    return res.status === 200 ? { ok: true } : { ok: false, why: `e-Gov 法令 API で法令 ID ${egov[1]} が見つからない（HTTP ${res.status}）` };
  }
  let current = url;
  for (let hop = 0; hop < 6; hop++) {
    const res = await fetch(current, { redirect: 'manual', headers: { 'user-agent': UA, 'accept-language': 'ja' } });
    if (res.headers.get('x-deny-reason')) return { ok: null, why: `ネットワーク制限（${res.headers.get('x-deny-reason')}）` };
    if (res.status >= 300 && res.status < 400) {
      const next = new URL(res.headers.get('location'), current).href;
      if (/\/error\b|404|not[-_]?found/i.test(next)) return { ok: false, why: `エラーページへ転送（${next}）` };
      current = next;
      continue;
    }
    if (res.status === 200) return { ok: true };
    if (res.status === 202) return { ok: null, why: 'HTTP 202（ボット対策の応答。ブラウザでは開ける場合あり）' };
    if (res.status === 403) return { ok: null, why: 'HTTP 403（ボット拒否の可能性。ブラウザでは開ける場合あり）' };
    return { ok: false, why: `HTTP ${res.status}` };
  }
  return { ok: false, why: 'リダイレクトが多すぎる' };
}

let broken = 0;
let unknown = 0;
for (const t of tools) {
  for (const s of t.meta.sources ?? []) {
    let r;
    try {
      r = await check(s.url);
    } catch (e) {
      r = { ok: null, why: `接続できない（${e.cause?.code ?? e.message}）` };
    }
    if (r.ok === false) {
      broken++;
      console.log(`✗ ${t.locale}/${t.slug}: ${s.url} — ${r.why}`);
    } else if (r.ok === null) {
      unknown++;
      console.log(`? ${t.locale}/${t.slug}: ${s.url} — 未確認: ${r.why}`);
    }
  }
}
console.log(`\ncheck-sources: ${tools.length} tools, ${broken} broken, ${unknown} unverified`);
process.exit(broken ? 1 : 0);
