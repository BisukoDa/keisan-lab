import { renderResults, parseValues, resolveDefault, localTodayIso, isVisible } from './render.js';

const root = document.querySelector('[data-calc]');
if (root) init(root);

async function init(root) {
  const mod = await import(new URL(root.dataset.module, location.href).href);
  const form = root.querySelector('form');
  const out = root.querySelector('[data-results]');
  const params = new URLSearchParams(location.search);
  const today = localTodayIso();

  for (const input of mod.inputs) {
    const el = form.elements[input.id];
    if (!el) continue;
    if (params.has(input.id)) el.value = params.get(input.id);
    else if (input.type === 'date') el.value = resolveDefault(input, today);
  }

  const readRaw = () => Object.fromEntries(mod.inputs.map((i) => [i.id, form.elements[i.id]?.value ?? '']));

  const update = (syncUrl) => {
    const raw = readRaw();
    const values = parseValues(mod.inputs, raw);
    for (const input of mod.inputs) {
      const wrap = form.querySelector(`[data-field="${input.id}"]`);
      if (wrap) wrap.hidden = !isVisible(input, values);
    }
    let result;
    try {
      result = mod.calculate(values);
    } catch {
      result = { error: root.dataset.msgError };
    }
    out.innerHTML = renderResults(result);
    if (syncUrl) history.replaceState(null, '', `?${new URLSearchParams(raw)}`);
  };

  form.addEventListener('input', () => update(true));
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    update(true);
  });

  const copyBtn = root.querySelector('[data-copy-url]');
  const copyLabel = copyBtn?.textContent;
  copyBtn?.addEventListener('click', async () => {
    update(true);
    try {
      await navigator.clipboard.writeText(location.href);
      copyBtn.textContent = root.dataset.msgCopied;
    } catch {
      copyBtn.textContent = root.dataset.msgCopyFailed;
    }
    setTimeout(() => (copyBtn.textContent = copyLabel), 2000);
  });

  update(false);
}

// トップページの絞り込み検索
const search = document.querySelector('[data-tool-search]');
if (search) {
  const cards = [...document.querySelectorAll('[data-tool-card]')];
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    for (const card of cards) card.hidden = q !== '' && !card.dataset.search.includes(q);
  });
}
