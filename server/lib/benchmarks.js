// ==========================================================================
// 経営指標ベンチマークデータ
//
// 出典:
// ・全産業の加重平均値（equityRatio / turnover / roe / valueAddedRatio の
//   「全産業（合計）」欄）は中小企業庁「令和４年中小企業実態基本調査速報
//   （令和３年度決算実績）」の公表値をそのまま使用。
// ・業種別の売上高経常利益率（profitMargin）と労働生産性（productivity）は、
//   同調査で公表された「産業大分類別の１企業当たり売上高・経常利益・
//   従業者数・付加価値額」から本ツールが算出した参考値（公式の比率その
//   ものではない）。
// ・業種別の総資本回転率（turnover）・自己資本当期純利益率（roe）・
//   売上高付加価値率（valueAddedRatio）は、中小企業庁「令和元年中小企業
//   実態基本調査」に基づく公開資料（社長の教科書「経営指標とは」記事、
//   https://suzuki-tax.net/shacho-kyokasho/management-indicators）の
//   業種別平均値を採用。
// ・業種別の自己資本比率（equityRatio）は、同資料の「財務レバレッジ」
//   （総資本÷自己資本）から 100 / 財務レバレッジ で逆算した推計値。
// ・業種別の流動比率（currentRatio）は、中小企業庁「中小企業実態基本調査
//   令和３年確報（令和２年度決算実績）」の公表値（freee会計「流動比率は
//   高いほうがいい？」記事 https://www.freee.co.jp/kb/kb-accounting/current-ratio/
//   経由で確認）を採用。「全産業（合計）」は11業種の単純平均（公式の
//   加重平均ではない参考値）。
// ・債務償還年数／借入金月商倍率の目安は、銀行の融資審査で一般的に
//   用いられるガイドライン（債務償還年数10年以内=良好・15年超=要注意、
//   借入金月商倍率3ヶ月以内=良好・6ヶ月超=要注意）を採用した一般的な
//   目安であり、業種別の公的データではない。
//
// 年度が異なるデータを組み合わせているため、あくまで「目安・参考値」で
// あることに留意すること。正確な業種水準が必要な場合は e-Stat の
// 産業中分類別データを直接参照することを推奨する。
// ==========================================================================

const ALL_INDUSTRY_AVG = {
  roe: 8.29,             // 自己資本当期純利益率（R3年度・公式）
  profitMargin: 4.26,    // 売上高経常利益率（R3年度・公式）
  turnover: 0.98,         // 総資本回転率(回)（R3年度・公式）
  equityRatio: 40.13,    // 自己資本比率（R3年度・公式）
  valueAddedRatio: 26.93, // 付加価値比率（R3年度・公式）
  currentRatio: 184.94   // 流動比率（11業種の単純平均・参考値）
};

// 銀行融資審査目線の指標の目安（低いほど良い＝逆指標）
const DEBT_SERVICE_YEARS_GOOD = 10; // 債務償還年数(年) これ以下なら良好
const DEBT_SERVICE_YEARS_BAD = 15;  // これを超えると要注意
const DEBT_MONTHS_GOOD = 3;         // 借入金月商倍率(ヶ月) これ以下なら良好
const DEBT_MONTHS_BAD = 6;          // これを超えると要注意

const INDUSTRY_BENCH = {
  "全産業（合計）": {
    profitMargin: 4.83, productivity: 958.7,
    turnover: ALL_INDUSTRY_AVG.turnover, roe: ALL_INDUSTRY_AVG.roe,
    equityRatio: ALL_INDUSTRY_AVG.equityRatio, valueAddedRatio: ALL_INDUSTRY_AVG.valueAddedRatio,
    currentRatio: ALL_INDUSTRY_AVG.currentRatio
  },
  "建設業": {
    profitMargin: 5.45, productivity: 937.0,
    turnover: 1.25, roe: 13.66, equityRatio: 43.67, valueAddedRatio: 25.41, currentRatio: 200.05
  },
  "製造業": {
    profitMargin: 5.28, productivity: 900.0,
    turnover: 1.06, roe: 9.57, equityRatio: 45.25, valueAddedRatio: 28.31, currentRatio: 198.66
  },
  "情報通信業": {
    profitMargin: 7.81, productivity: 702.1,
    turnover: 1.04, roe: 10.27, equityRatio: 56.18, valueAddedRatio: 41.44, currentRatio: 245.49
  },
  "運輸業，郵便業": {
    profitMargin: 2.38, productivity: 680.1,
    turnover: 1.25, roe: 11.44, equityRatio: 34.13, valueAddedRatio: 36.33, currentRatio: 180.53
  },
  "卸売業": {
    profitMargin: 2.63, productivity: 812.7,
    turnover: 1.80, roe: 11.02, equityRatio: 40.49, valueAddedRatio: 10.65, currentRatio: 172.90
  },
  "小売業": {
    profitMargin: 2.77, productivity: 743.0,
    turnover: 1.84, roe: 8.00, equityRatio: 32.15, valueAddedRatio: 18.74, currentRatio: 160.73
  },
  "不動産業，物品賃貸業": {
    profitMargin: 10.27, productivity: 1756.8,
    turnover: 0.34, roe: 14.28, equityRatio: 39.06, valueAddedRatio: 37.63, currentRatio: 176.93
  },
  "学術研究，専門・技術サービス業": {
    profitMargin: 15.43, productivity: 980.4,
    turnover: 0.51, roe: 6.72, equityRatio: 56.50, valueAddedRatio: 46.82, currentRatio: 189.18
  },
  "宿泊業，飲食サービス業": {
    profitMargin: 8.86, productivity: 767.1,
    turnover: 1.07, roe: 11.44, equityRatio: 20.16, valueAddedRatio: 47.72, currentRatio: 154.89
  },
  "生活関連サービス業，娯楽業": {
    profitMargin: 4.13, productivity: 1534.0,
    turnover: 1.09, roe: 6.70, equityRatio: 34.01, valueAddedRatio: 25.26, currentRatio: 171.99
  },
  "サービス業（他に分類されないもの）": {
    profitMargin: 5.71, productivity: 553.4,
    turnover: 1.26, roe: 12.24, equityRatio: 48.31, valueAddedRatio: 47.74, currentRatio: 183.01
  }
};

const INDUSTRY_LIST = Object.keys(INDUSTRY_BENCH);

module.exports = {
  ALL_INDUSTRY_AVG, INDUSTRY_BENCH, INDUSTRY_LIST,
  DEBT_SERVICE_YEARS_GOOD, DEBT_SERVICE_YEARS_BAD, DEBT_MONTHS_GOOD, DEBT_MONTHS_BAD
};
