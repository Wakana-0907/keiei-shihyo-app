// ==========================================================================
// 次回ヒアリング質問リストの自動生成
//
// 要注意・平均的だった指標から、次回の訪問・面談で経営者に確認すべき
// 仮説ベースの質問をルールベースで生成する。診断を「見て終わり」ではなく
// 次のアクション（面談）につなげるための機能。
// ==========================================================================

const QUESTIONS = {
  equityRatio: '自己資本が薄い要因は何でしょうか（赤字の累積、配当や役員貸付などによる社外流出、急な借入の増加など）？',
  profitMargin: '利益率が伸び悩んでいる要因は、価格設定・原価上昇・固定費のどこにありそうですか？',
  turnover: '保有資産の中に、実質的に稼働していない遊休資産や過剰在庫はありませんか？',
  roe: '自己資本に対して利益が薄い理由は、利益そのものが少ないためですか、それとも自己資本を厚く持ちすぎているためですか？',
  currentRatio: '短期的な資金繰りは大丈夫でしょうか。資金繰り表は作成されていますか？',
  valueAddedRatio: '仕入や外注への依存度は高くありませんか。内製化・自社工程化できる余地はありますか？',
  productivity: '従業員の稼働状況（残業・手待ち時間など）や人員配置は適切だとお考えですか？',
  debtServiceYears: '借入金の使途は何でしょうか（設備投資か運転資金か）。返済計画と今後のキャッシュフロー見通しはお持ちですか？',
  debtMonths: '借入金を圧縮する計画、または追加融資のご予定はありますか？'
};

const POSITIVE_FALLBACK = [
  '現状は大きな懸念点が見当たりません。今後の成長投資（設備・採用など）のご意向はありますか？',
  '次の決算に向けて、新たに取り組みたいことや変化する予定の事業計画はありますか？'
];

/**
 * @param {Array} items - diagnoseCompany() の diagnosis 配列
 * @returns {string[]} 質問文のリスト（最大5件程度）
 */
function generateQuestions(items) {
  const bad = items.filter(it => it.judge && it.judge.cls === 'bad' && QUESTIONS[it.key]);
  const mid = items.filter(it => it.judge && it.judge.cls === 'mid' && QUESTIONS[it.key]);

  const picked = [...bad, ...mid].slice(0, 5);
  if (picked.length === 0) {
    return POSITIVE_FALLBACK;
  }
  return picked.map(it => QUESTIONS[it.key]);
}

module.exports = { generateQuestions };
