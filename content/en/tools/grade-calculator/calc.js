// Grade calculator: (1) score needed on the final exam, (2) weighted course grade from up to five categories.
// Results are shown to two decimal places; the score needed is rounded up (after removing floating-point noise), so the displayed value never understates it.
// Weights must be 0.01%-100% and grades 0%-200%. The HTML min stays 0 so the step base for whole-number weights is valid; calculate() enforces 0.01.

const SLOTS = [1, 2, 3, 4, 5];
const defaults = [
  ['Homework', 20, 92],
  ['Quizzes', 20, 85],
  ['Midterm exam', 30, 78],
];

export const inputs = [
  {
    id: 'mode',
    label: 'What do you want to calculate?',
    type: 'select',
    default: 'final',
    options: [
      { value: 'final', label: 'Score I need on my final exam' },
      { value: 'weighted', label: 'My weighted grade so far' },
    ],
  },
  { id: 'current', label: 'Current grade (before the final)', type: 'number', unit: '%', default: 82, min: 0, max: 200, step: 0.1, showIf: { mode: 'final' }, help: 'Your grade in the course right now, as a percent.' },
  { id: 'weight', label: 'Weight of the final exam', type: 'number', unit: '%', default: 30, min: 0, max: 100, step: 1, showIf: { mode: 'final' }, help: 'Find it in your syllabus. It is the share of the course grade the final is worth (0.01% to 100%).' },
  { id: 'target', label: 'Grade you want in the course', type: 'number', unit: '%', default: 85, min: 0, max: 200, step: 0.1, showIf: { mode: 'final' } },
  ...SLOTS.flatMap((n) => {
    const d = defaults[n - 1];
    return [
      { id: `w${n}`, label: `Category ${n} weight${d ? ` (${d[0]})` : ''}`, type: 'number', unit: '%', default: d ? d[1] : '', min: 0, max: 100, step: 1, showIf: { mode: 'weighted' } },
      { id: `s${n}`, label: `Category ${n} score`, type: 'number', unit: '%', default: d ? d[2] : '', min: 0, max: 200, step: 0.1, showIf: { mode: 'weighted' } },
    ];
  }),
];

const clean = (v) => Number(v.toPrecision(12));
const r2 = (v) => Math.round(clean(v) * 100) / 100;
const ceil2 = (v) => Math.ceil(Math.round(v * 100 * 1e4) / 1e4) / 100;
const MIN_WEIGHT = 0.01;
const MAX_GRADE = 200;
const letter = (p) => (p >= 90 ? 'A' : p >= 80 ? 'B' : p >= 70 ? 'C' : p >= 60 ? 'D' : 'F');

export function calculate(v) {
  if (v.mode === 'final') {
    const { current, weight, target } = v;
    if (![current, weight, target].every(Number.isFinite)) return { error: 'Please enter your current grade, the final exam weight and your target grade.' };
    if (current < 0 || target < 0) return { error: 'Grades cannot be negative.' };
    if (current > MAX_GRADE || target > MAX_GRADE) return { error: 'Grades must be 200% or less. Please check your numbers.' };
    if (weight < MIN_WEIGHT || weight > 100) return { error: 'The final exam weight must be between 0.01% and 100%.' };
    const w = weight / 100;
    // Snap away floating-point noise (e.g. 65.90000000000001) before rounding up.
    const n = Math.round(((target - current * (1 - w)) / w) * 1e6) / 1e6;
    const items = [];
    const notes = ['Enter your grade as a percent. If your teacher uses points, divide points earned by points possible so far and multiply by 100.', 'If your course has a curve, drops the lowest score, or gives extra credit, the real score you need may differ.'];
    if (n <= 0) {
      items.push({ label: 'Score needed on the final', value: 0, digits: 0, unit: '%', primary: true });
      notes.unshift('You already reach your target even with a 0 on the final.');
    } else {
      items.push({ label: 'Score needed on the final', value: ceil2(n), digits: 2, unit: '%', primary: true });
      if (n > 100) notes.unshift('The score needed is above 100%, so this target cannot be reached with the final exam alone unless extra credit is available.');
    }
    items.push({ label: 'Best possible course grade (100% on the final)', value: r2(current * (1 - w) + 100 * w), digits: 2, unit: '%' });
    items.push({ label: 'Course grade if you score 0 on the final', value: r2(current * (1 - w)), digits: 2, unit: '%' });
    if (!items.every((it) => Number.isFinite(it.value))) return { error: 'These numbers are out of range. Please check them.' };
    return { items, notes };
  }
  if (v.mode === 'weighted') {
    let sumW = 0;
    let sumWS = 0;
    const rows = [];
    for (const n of SLOTS) {
      const w = v[`w${n}`];
      const s = v[`s${n}`];
      const name = `Category ${n}${n <= defaults.length ? ` (${defaults[n - 1][0]})` : ''}`;
      const blankW = !Number.isFinite(w);
      const blankS = !Number.isFinite(s);
      if (blankW && blankS) continue;
      if (blankW || blankS) return { error: `Category ${n}: enter both a weight and a score, or leave both empty.` };
      if (w < 0 || s < 0) return { error: `Category ${n}: weights and scores cannot be negative.` };
      if (w < MIN_WEIGHT || w > 100) return { error: `Category ${n}: the weight must be between 0.01% and 100%. Leave the row empty to skip it.` };
      if (s > MAX_GRADE) return { error: `Category ${n}: the score must be 200% or less.` };
      sumW += w;
      sumWS += w * s;
      rows.push([name, `${r2(w)}%`, `${r2(s)}%`, `${r2((w * s) / 100)}`]);
    }
    if (rows.length === 0) return { error: 'Enter at least one category with a weight and a score.' };
    if (sumW > 100.0000001) return { error: 'The weights add up to more than 100%. Please check them.' };
    const grade = sumWS / sumW;
    if (!Number.isFinite(grade)) return { error: 'These numbers are out of range. Please check them.' };
    const items = [
      { label: 'Weighted grade so far', value: r2(grade), digits: 2, unit: '%', primary: true },
      { label: 'Letter grade (common 90/80/70/60 scale)', value: letter(r2(grade)) },
      { label: 'Share of the course graded so far', value: r2(sumW), digits: 2, unit: '%' },
    ];
    return {
      items,
      table: { caption: 'Points contributed by each category', headers: ['Category', 'Weight', 'Score', 'Points toward final grade'], rows },
      notes: [
        'The grade is divided by the weight graded so far, so it is your average on the work counted, not a projection of the full course.',
        'Letter cutoffs vary by school. Check your syllabus for your own scale.',
      ],
    };
  }
  return { error: 'Please choose what you want to calculate.' };
}
