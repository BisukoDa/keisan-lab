// 電気代計算：消費電力（W）× 使用時間 × 電力量料金単価

export const inputs = [
  { id: 'watts', label: '消費電力', type: 'number', unit: 'W', default: 1000, min: 0, max: 100000, step: 1, help: '家電の本体ラベルや取扱説明書に書かれた「消費電力」の W（ワット）の値です。' },
  { id: 'hours', label: '1日の使用時間（時間）', type: 'number', unit: '時間', default: 1, min: 0, max: 24, step: 1 },
  { id: 'minutes', label: '1日の使用時間（分）', type: 'number', unit: '分', default: 0, min: 0, max: 59, step: 1, help: '例：1日10分なら「0時間」「10分」、1時間30分なら「1時間」「30分」。' },
  { id: 'days', label: '1か月の使用日数', type: 'number', unit: '日', default: 30, min: 0, max: 31, step: 1 },
  { id: 'price', label: '電力量料金の単価', type: 'number', unit: '円/kWh', default: 31, min: 0, max: 200, step: 0.01, help: '31円は全国家庭電気製品公正取引協議会の目安単価（税込）です。契約中の単価がわかればその値を入れてください。' },
];

export function calculate({ watts, hours, minutes, days, price }) {
  if (![watts, hours, minutes, days, price].every(Number.isFinite)) return { error: 'すべての項目に数値を入力してください。' };
  if (watts < 0 || watts > 100000) return { error: '消費電力は 0〜100,000W の範囲で入力してください。' };
  if (hours < 0 || minutes < 0 || minutes >= 60) return { error: '使用時間は 0 以上、分は 0〜59 で入力してください。' };
  const usedHours = hours + minutes / 60;
  if (usedHours > 24) return { error: '1日の使用時間は合計 24 時間以内で入力してください。' };
  if (days < 0 || days > 31) return { error: '1か月の使用日数は 0〜31 日で入力してください。' };
  if (price < 0 || price > 200) return { error: '単価は 0〜200 円/kWh の範囲で入力してください。' };

  const kw = watts / 1000;
  const perHour = kw * price;
  const perDay = perHour * usedHours;
  const perMonth = perDay * days;
  const kwhMonth = kw * usedHours * days;
  return {
    items: [
      { label: '1か月の電気代（目安）', value: perMonth, digits: perMonth > 0 && perMonth < 100 ? 1 : 0, unit: '円', primary: true },
      { label: '1時間あたり', value: perHour, digits: 1, unit: '円' },
      { label: '1日あたり', value: perDay, digits: 1, unit: '円' },
      { label: '1年あたり（1か月分 × 12）', value: perMonth * 12, unit: '円' },
      { label: '1か月の使用電力量', value: kwhMonth, digits: 2, unit: 'kWh' },
    ],
    notes: [
      '消費電力が一定と仮定した目安です。エアコン・冷蔵庫など、運転状況で消費電力が変わる家電は実際と差が出ます。',
      '1年あたりは1か月分の12倍です（使用日数30日なら360日分）。',
      '実際の請求額には、基本料金（最低料金）、燃料費調整額、再生可能エネルギー発電促進賦課金なども加わります。',
    ],
  };
}
