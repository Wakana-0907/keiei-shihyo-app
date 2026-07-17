// ==========================================================================
// 経営体力スコア（総合スコア）
//
// 各診断項目の判定(良好/平均的/要注意)を得点化し、単純平均で0〜100点の
// 総合スコアを算出する。銀行の格付けのように「一言で状態を伝えられる数字」
// を経営者に示すための指標で、詳細は個別の診断項目を参照する前提。
// ==========================================================================

const POINTS = { good: 100, mid: 60, bad: 20 };

const LABELS = [
  { min: 85, label: '優良' },
  { min: 70, label: '良好' },
  { min: 50, label: '普通' },
  { min: 30, label: '要注意' },
  { min: 0, label: '危険水準' }
];

function labelFor(score) {
  return LABELS.find(l => score >= l.min).label;
}

/**
 * @param {Array} items - diagnoseCompany() の diagnosis 配列
 * @returns {{score: number|null, label: string|null, count: number}}
 */
function computeHealthScore(items) {
  const scored = items.filter(it => it.judge && POINTS[it.judge.cls] !== undefined && it.judge.label !== '—');
  if (scored.length === 0) {
    return { score: null, label: null, count: 0 };
  }
  const total = scored.reduce((sum, it) => sum + POINTS[it.judge.cls], 0);
  const score = Math.round(total / scored.length);
  return { score, label: labelFor(score), count: scored.length };
}

module.exports = { computeHealthScore, POINTS, LABELS };
