const {
  ALL_INDUSTRY_AVG, INDUSTRY_BENCH,
  DEBT_SERVICE_YEARS_GOOD, DEBT_SERVICE_YEARS_BAD, DEBT_MONTHS_GOOD, DEBT_MONTHS_BAD
} = require('./benchmarks');
const { generateCommentary } = require('./commentary');
const { computeHealthScore } = require('./score');
const { generateQuestions } = require('./questions');

/**
 * 月次試算表データを年換算する。
 * elapsedMonths が 1〜11 の場合、フロー項目（売上高・経常利益・付加価値額・減価償却費）を
 * 12ヶ月換算する。ストック項目（総資産・純資産・流動資産・流動負債・従業員数・有利子負債）は
 * 期末時点の値としてそのまま使う。
 * elapsedMonths が null/0/12以上の場合は決算実績とみなし、そのまま返す。
 */
function annualize(record) {
  const months = record.elapsedMonths;
  const isPartialYear = months !== null && months !== undefined && months > 0 && months < 12;
  const factor = isPartialYear ? 12 / months : 1;
  return {
    ...record,
    sales: record.sales * factor,
    ordinaryProfit: record.ordinaryProfit * factor,
    valueAdded: record.valueAdded != null ? record.valueAdded * factor : null,
    depreciation: record.depreciation != null ? record.depreciation * factor : null,
    annualized: isPartialYear
  };
}

function computeIndicators(rawRecord) {
  const row = annualize(rawRecord);
  const equityRatio = row.totalAssets ? (row.equity / row.totalAssets * 100) : null;
  const profitMargin = row.sales ? (row.ordinaryProfit / row.sales * 100) : null;
  const turnover = row.totalAssets ? (row.sales / row.totalAssets) : null;
  const roe = row.equity ? (row.ordinaryProfit / row.equity * 100) : null;
  const currentRatio = row.currentLiabilities ? (row.currentAssets / row.currentLiabilities * 100) : null;
  const productivity = (row.employees && row.valueAdded != null) ? (row.valueAdded / row.employees / 10000) : null; // 万円/人
  const valueAddedRatio = (row.sales && row.valueAdded != null) ? (row.valueAdded / row.sales * 100) : null;

  // ---- 銀行融資審査目線の指標（有利子負債が入力されている場合のみ計算） ----
  let debtServiceYears = null;
  let debtMonths = null;
  if (row.interestBearingDebt != null && row.interestBearingDebt > 0) {
    const depreciation = row.depreciation != null ? row.depreciation : 0;
    const cashFlowProxy = row.ordinaryProfit + depreciation; // 簡易キャッシュフロー
    if (cashFlowProxy > 0) {
      debtServiceYears = row.interestBearingDebt / cashFlowProxy;
    } // マイナスの場合は返済原資がないため計算不能(null)のまま
    if (row.sales > 0) {
      debtMonths = row.interestBearingDebt / (row.sales / 12);
    }
  }

  return {
    equityRatio, profitMargin, turnover, roe, currentRatio, productivity, valueAddedRatio,
    debtServiceYears, debtMonths,
    annualized: row.annualized
  };
}

function judge(value, bench, { thresholdGood = 1.2, thresholdBad = 0.8 } = {}) {
  if (value === null || value === undefined || bench === null || bench === undefined || isNaN(value)) {
    return { label: '—', cls: 'mid' };
  }
  const ratio = value / bench;
  if (ratio >= thresholdGood) return { label: '良好', cls: 'good' };
  if (ratio >= thresholdBad) return { label: '平均的', cls: 'mid' };
  return { label: '要注意', cls: 'bad' };
}

// 低いほど良い指標（債務償還年数・借入金月商倍率）用の判定
function judgeLowerBetter(value, goodThreshold, badThreshold) {
  if (value === null || value === undefined || isNaN(value)) return { label: '—', cls: 'mid' };
  if (value <= goodThreshold) return { label: '良好', cls: 'good' };
  if (value <= badThreshold) return { label: '平均的', cls: 'mid' };
  return { label: '要注意', cls: 'bad' };
}

/**
 * 会社の全レコードから指標を計算し、最新レコードについて業種平均との診断を行う。
 * records: DBから取得した financial_records の配列（fiscal_year の昇順を推奨）
 * industry: 業種名（INDUSTRY_BENCH のキー）
 */
function diagnoseCompany(records, industry) {
  const bench = INDUSTRY_BENCH[industry] || INDUSTRY_BENCH["全産業（合計）"];
  const series = records.map(r => ({ record: r, indicators: computeIndicators(r) }));
  const latest = series[series.length - 1];

  const items = [];
  if (latest) {
    const ind = latest.indicators;
    items.push({
      key: 'equityRatio', name: '自己資本比率', unit: '%', value: ind.equityRatio,
      benchValue: bench.equityRatio, benchLabel: `${industry}平均（参考） ${bench.equityRatio}%`,
      judge: judge(ind.equityRatio, bench.equityRatio),
      detail: '財務の安全性（返済不要の自己資本がどれだけあるか）を示す指標。'
    });
    items.push({
      key: 'profitMargin', name: '売上高経常利益率', unit: '%', value: ind.profitMargin,
      benchValue: bench.profitMargin, benchLabel: `${industry}平均（参考） ${bench.profitMargin}%`,
      judge: judge(ind.profitMargin, bench.profitMargin),
      detail: '本業でどれだけ効率的に利益を上げているかを示す収益性の指標。'
    });
    items.push({
      key: 'turnover', name: '総資本回転率', unit: '回', value: ind.turnover,
      benchValue: bench.turnover, benchLabel: `${industry}平均（参考） ${bench.turnover}回`,
      judge: judge(ind.turnover, bench.turnover),
      detail: '保有する総資産をどれだけ効率的に売上に変えられているかを示す指標。'
    });
    items.push({
      key: 'roe', name: '自己資本当期純利益率（簡易ROE）', unit: '%', value: ind.roe,
      benchValue: bench.roe, benchLabel: `${industry}平均（参考） ${bench.roe}%`,
      judge: judge(ind.roe, bench.roe),
      detail: '自己資本に対する利益率。経常利益で簡易計算（本来は当期純利益）。'
    });
    items.push({
      key: 'currentRatio', name: '流動比率', unit: '%', value: ind.currentRatio,
      benchValue: bench.currentRatio, benchLabel: `${industry}平均（参考） ${bench.currentRatio}%`,
      judge: judge(ind.currentRatio, bench.currentRatio),
      detail: '短期的な支払い能力（資金繰りの余裕度）を示す指標。'
    });
    if (ind.valueAddedRatio !== null) {
      items.push({
        key: 'valueAddedRatio', name: '売上高付加価値率', unit: '%', value: ind.valueAddedRatio,
        benchValue: bench.valueAddedRatio, benchLabel: `${industry}平均（参考） ${bench.valueAddedRatio}%`,
        judge: judge(ind.valueAddedRatio, bench.valueAddedRatio),
        detail: '売上高に占める付加価値額の割合。企業が新たに生み出した価値の比率。'
      });
    }
    if (ind.productivity !== null) {
      items.push({
        key: 'productivity', name: '労働生産性（従業員1人当たり付加価値額）', unit: '万円/人', value: ind.productivity,
        benchValue: bench.productivity, benchLabel: `${industry}平均（参考） ${bench.productivity}万円/人`,
        judge: judge(ind.productivity, bench.productivity),
        detail: '従業員1人がどれだけの付加価値を生み出しているかを示す生産性の指標。'
      });
    }
    if (ind.debtServiceYears !== null) {
      items.push({
        key: 'debtServiceYears', name: '債務償還年数', unit: '年', value: ind.debtServiceYears,
        benchValue: DEBT_SERVICE_YEARS_GOOD,
        benchLabel: `目安：${DEBT_SERVICE_YEARS_GOOD}年以内=良好 / ${DEBT_SERVICE_YEARS_BAD}年超=要注意（銀行融資審査目線）`,
        judge: judgeLowerBetter(ind.debtServiceYears, DEBT_SERVICE_YEARS_GOOD, DEBT_SERVICE_YEARS_BAD),
        detail: '有利子負債を何年分の利益(簡易キャッシュフロー)で返済できるかを示す、銀行が融資審査で重視する指標。'
      });
    }
    if (ind.debtMonths !== null) {
      items.push({
        key: 'debtMonths', name: '借入金月商倍率', unit: 'ヶ月', value: ind.debtMonths,
        benchValue: DEBT_MONTHS_GOOD,
        benchLabel: `目安：${DEBT_MONTHS_GOOD}ヶ月以内=良好 / ${DEBT_MONTHS_BAD}ヶ月超=要注意（銀行融資審査目線）`,
        judge: judgeLowerBetter(ind.debtMonths, DEBT_MONTHS_GOOD, DEBT_MONTHS_BAD),
        detail: '有利子負債が月商の何ヶ月分に相当するかを示す、銀行が融資審査で重視する指標。'
      });
    }
  }

  const seriesOut = series.map(s => ({ recordId: s.record.id, periodLabel: s.record.periodLabel, recordType: s.record.recordType, indicators: s.indicators }));
  const summary = generateCommentary(items, seriesOut, industry);
  const healthScore = computeHealthScore(items);
  const nextMeetingQuestions = generateQuestions(items);

  return {
    industry,
    series: seriesOut,
    diagnosis: items,
    summary,
    healthScore,
    nextMeetingQuestions
  };
}

module.exports = { annualize, computeIndicators, judge, judgeLowerBetter, diagnoseCompany, ALL_INDUSTRY_AVG, INDUSTRY_BENCH };
