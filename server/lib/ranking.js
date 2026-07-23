// ==========================================================================
// 自社クライアント内での相対順位（パーセンタイル）計算
//
// 業種平均という「外部の目安」だけでなく、自分が担当している他のクライアント
// との比較で「自分の担当先の中でどの位置にいるか」を示すための小さなヘルパー。
// 値は「高いほど良い」指標であることを前提とする（債務償還年数など逆指標は
// 呼び出し側で符号を反転してから渡すこと）。
// ==========================================================================

/**
 * @param {number[]} values - 比較対象の全ての値（対象自身の値を含む）
 * @param {number} targetValue - 順位を知りたい値
 * @returns {{rank: number, total: number, percentile: number}} rank=1が最上位。
 *   percentile=100が最上位、0が最下位（同率がある場合は先勝ち）。
 */
function rankAndPercentile(values, targetValue) {
  const sorted = [...values].sort((a, b) => b - a);
  const rank = sorted.indexOf(targetValue) + 1;
  const total = sorted.length;
  const percentile = total > 1 ? Math.round(((total - rank) / (total - 1)) * 100) : 100;
  return { rank, total, percentile };
}

module.exports = { rankAndPercentile };
