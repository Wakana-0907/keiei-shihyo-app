// ==========================================================================
// 総評コメント自動生成
//
// diagnoseCompany() が返す診断結果(items)と指標推移(series)を受け取り、
// 自然な日本語の総評文（数文のプロース）を組み立てる。
//
// 設計方針:
// ・現時点ではルールベース（テンプレート合成）で実装。無料・即時・オフラインで
//   動作し、外部API依存や利用コストが発生しない。
// ・generateCommentary() の呼び出し側（records.js）を変えずに済むよう、
//   このファイルの中身だけを差し替えれば将来 Claude API 等を使った
//   生成AI版（generateCommentaryWithLLM 的な関数）に置き換えられるように、
//   入出力インターフェースを固定している（items配列 + series配列 → 文字列）。
// ==========================================================================

// 指標ごとの「弱点だった場合の改善アングル」テンプレート
const IMPROVEMENT_HINTS = {
  equityRatio: '内部留保を積み増すなど、自己資本の強化を検討する余地があります',
  profitMargin: '価格設定や原価構造を見直し、本業の収益性を高める打ち手を検討する余地があります',
  turnover: '遊休資産の圧縮や在庫・売掛金の回転効率を高める余地があります',
  roe: '収益改善または資本構成の見直しにより、資本効率を高める余地があります',
  currentRatio: '短期的な資金繰りに注意し、運転資金の確保や支払いサイトの見直しを検討した方がよいでしょう',
  valueAddedRatio: '仕入・外注費の構造を見直し、自社で生み出す付加価値の比率を高める余地があります',
  productivity: '業務効率化や人員配置の見直しにより、従業員1人当たりの生産性を高める余地があります'
};

// 指標ごとの「強みだった場合の一言」テンプレート
const STRENGTH_HINTS = {
  equityRatio: '財務基盤が安定しており、借入への依存度が低い状態',
  profitMargin: '本業でしっかり利益を出せている状態',
  turnover: '資産を効率よく売上に変換できている状態',
  roe: '自己資本に対して高い利益を生み出せている状態',
  currentRatio: '短期的な支払い能力に余裕がある状態',
  valueAddedRatio: '外部購入品に頼らず自社で価値を生み出せている状態',
  productivity: '従業員1人当たりの稼ぐ力が高い状態'
};

function ratioOf(item) {
  if (item.value === null || item.value === undefined || !item.benchValue) return null;
  return item.value / item.benchValue;
}

function fmtNum(v, digits = 1) {
  return (v === null || v === undefined || isNaN(v)) ? '—' : Number(v).toFixed(digits);
}

/**
 * @param {Array} items - diagnoseCompany() が返す diagnosis 配列
 * @param {Array} series - diagnoseCompany() が返す series 配列（期間の昇順）
 * @param {string} industry - 業種名
 * @returns {string} 総評文（プロース、複数文）
 */
function generateCommentary(items, series, industry) {
  const scored = items
    .filter(it => it.value !== null && it.value !== undefined && !isNaN(it.value))
    .map(it => ({ ...it, ratio: ratioOf(it) }));

  if (scored.length === 0) {
    return 'データが不足しているため、総評を生成できませんでした。決算データを入力すると自動で表示されます。';
  }

  const goodItems = scored.filter(it => it.judge.cls === 'good');
  const midItems = scored.filter(it => it.judge.cls === 'mid');
  const badItems = scored.filter(it => it.judge.cls === 'bad');

  const sentences = [];

  // ---- 1. 総合評価の切り出し ----
  if (badItems.length === 0 && goodItems.length >= Math.ceil(scored.length / 2)) {
    sentences.push(`${industry}の平均的な水準と比較すると、全体的に良好な財務状態にあります。`);
  } else if (badItems.length >= Math.ceil(scored.length / 2)) {
    sentences.push(`${industry}の平均的な水準と比較すると、複数の指標で業種平均を下回っており、注意が必要な状態です。`);
  } else if (badItems.length === 0 && midItems.length > 0) {
    sentences.push(`${industry}の平均的な水準と比較すると、大きな課題は見当たらず、概ね標準的な財務状態にあります。`);
  } else {
    sentences.push(`${industry}の平均的な水準と比較すると、指標によって強みと課題が分かれている状態です。`);
  }

  // ---- 2. 強みの言及 ----
  if (goodItems.length > 0) {
    const best = goodItems.reduce((a, b) => (b.ratio > a.ratio ? b : a));
    const hint = STRENGTH_HINTS[best.key] || '';
    sentences.push(
      `中でも${best.name}は${fmtNum(best.value, best.unit === '回' ? 2 : 0)}${best.unit}で、` +
      `業種平均（${fmtNum(best.benchValue, best.unit === '回' ? 2 : 0)}${best.unit}）を上回っており、${hint}と言えます。`
    );
  }

  // ---- 3. 弱み・課題の言及 ----
  if (badItems.length > 0) {
    const worst = badItems.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    const hint = IMPROVEMENT_HINTS[worst.key] || '';
    sentences.push(
      `一方で${worst.name}は${fmtNum(worst.value, worst.unit === '回' ? 2 : 0)}${worst.unit}にとどまり、` +
      `業種平均（${fmtNum(worst.benchValue, worst.unit === '回' ? 2 : 0)}${worst.unit}）を下回っています。${hint}。`
    );
  } else if (midItems.length > 0) {
    // 明確な弱点はないが、平均的止まりの指標があれば軽く触れる
    const weakestMid = midItems.reduce((a, b) => (b.ratio < a.ratio ? b : a));
    sentences.push(`${weakestMid.name}は業種平均並みで、突出した強みにはなっていません。`);
  }

  // ---- 4. 推移（複数期間ある場合） ----
  if (series.length >= 2) {
    const first = series[0].indicators;
    const last = series[series.length - 1].indicators;
    const trendNotes = [];

    if (first.equityRatio !== null && last.equityRatio !== null) {
      const diff = last.equityRatio - first.equityRatio;
      if (Math.abs(diff) >= 2) {
        trendNotes.push(`自己資本比率は${diff > 0 ? '改善' : '低下'}傾向`);
      }
    }
    if (first.profitMargin !== null && last.profitMargin !== null) {
      const diff = last.profitMargin - first.profitMargin;
      if (Math.abs(diff) >= 1) {
        trendNotes.push(`売上高経常利益率は${diff > 0 ? '改善' : '悪化'}傾向`);
      }
    }

    if (trendNotes.length > 0) {
      sentences.push(`直近${series.length}期間の推移を見ると、${trendNotes.join('、')}にあります。`);
    } else {
      sentences.push(`直近${series.length}期間の推移では、主要な指標に大きな変化は見られません。`);
    }
  }

  // ---- 5. 締めの注記 ----
  sentences.push('なお、この総評は入力データと業種平均から機械的に生成した参考情報であり、実際の経営判断には詳細なヒアリングや専門家の助言と合わせて検討してください。');

  return sentences.join('');
}

module.exports = { generateCommentary };
