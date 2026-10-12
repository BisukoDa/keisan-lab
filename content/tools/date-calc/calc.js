// 日付計算：○日後・○日前 ／ 2つの日付の間の日数
import { parseIso, addDays, diffDays, formatJp, toWareki, countWeekdays } from '../../lib/dates.js';

export const inputs = [
  {
    id: 'mode',
    label: '計算する内容',
    type: 'select',
    default: 'after',
    options: [
      { value: 'after', label: '日付から○日後・○日前を求める' },
      { value: 'between', label: '2つの日付の間の日数を求める' },
    ],
  },
  { id: 'start', label: '基準日（開始日）', type: 'date', default: 'today' },
  { id: 'days', label: '日数', type: 'number', unit: '日', default: 100, min: -36500, max: 36500, step: 1, help: '○日前を求めるときはマイナスで入力します（例：-30）。', showIf: { mode: 'after' } },
  { id: 'end', label: '終了日', type: 'date', default: 'today+100', showIf: { mode: 'between' } },
  {
    id: 'countStart',
    label: '開始日を数えるか',
    type: 'select',
    default: 'no',
    showIf: { mode: 'between' },
    options: [
      { value: 'no', label: '数えない（翌日から数える）' },
      { value: 'yes', label: '数える（開始日も1日目とする）' },
    ],
  },
];

const wareki = (iso) => toWareki(iso)?.text ?? '（1873年より前は和暦に変換しません）';
const inRange = (iso) => iso >= '1000-01-01' && iso <= '9999-12-31';

export function calculate({ mode, start, days, end, countStart }) {
  if (!parseIso(start)) return { error: '基準日（開始日）を正しく入力してください。' };

  if (mode === 'after') {
    if (!Number.isInteger(days) || Math.abs(days) > 36500) return { error: '日数は -36500〜36500 の整数で入力してください。' };
    const target = addDays(start, days);
    if (!inRange(target)) return { error: '計算できる範囲を超えています。' };
    const label = days >= 0 ? `${formatJp(start)}の${days}日後` : `${formatJp(start)}の${-days}日前`;
    const items = [
      { label, value: formatJp(target), primary: true },
      { label: '和暦', value: wareki(target) },
    ];
    const notes = ['開始日の翌日を1日目として数えています（例：1月1日の1日後は1月2日）。'];
    if (days > 0) {
      items.push({ label: `開始日を1日目として数えた${days}日目`, value: formatJp(addDays(start, days - 1)) });
      notes.push('「○日目」は開始日を1日目と数えた日付です。記念日や「○日目」の数え方に使います。');
    }
    return { items, notes };
  }

  if (mode === 'between') {
    if (!parseIso(end)) return { error: '終了日を正しく入力してください。' };
    const notes = [];
    let [from, to] = [start, end];
    if (to < from) {
      [from, to] = [to, from];
      notes.push('終了日が開始日より前だったため、日付を入れ替えて計算しました。');
    }
    const include = countStart === 'yes';
    const total = diffDays(from, to) + (include ? 1 : 0);
    const rangeStart = include ? from : addDays(from, 1);
    const weekdays = total > 0 ? countWeekdays(rangeStart, to) : 0;
    notes.push(include ? '開始日と終了日の両方を含めて数えています。' : '開始日は含めず、翌日から終了日までを数えています。');
    notes.push('平日の日数は土日を除いた数で、祝日・年末年始は考慮していません。');
    return {
      items: [
        { label: `${formatJp(from)}から${formatJp(to)}まで`, value: total, unit: '日', primary: true },
        { label: '週に換算', value: `${Math.floor(total / 7)}週と${total % 7}日` },
        { label: 'うち平日（月〜金）', value: weekdays, unit: '日' },
        { label: 'うち土日', value: total - weekdays, unit: '日' },
      ],
      notes,
    };
  }
  return { error: '計算する内容を選んでください。' };
}
