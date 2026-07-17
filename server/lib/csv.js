// CSVインポート用パーサー。
// 列: 年度, 経過月数(任意), 売上高, 経常利益, 総資産, 純資産, 流動資産, 流動負債, 従業員数, 付加価値額
// 「経過月数」が 1〜11 の場合は月次試算表（決算前企業向け）として扱い、年換算する。
// 空欄・省略時は決算実績（年度データ）として扱う。

const REQUIRED_COLS = ["年度", "売上高", "経常利益", "総資産", "純資産", "流動資産", "流動負債", "従業員数", "付加価値額"];
const OPTIONAL_COLS = ["経過月数"];

function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r\n|\n|\r/).filter(l => l.trim().length > 0);
  if (lines.length < 2) {
    throw new Error('データ行がありません。ヘッダー行に加えて、少なくとも1行のデータが必要です。');
  }
  const headers = lines[0].split(',').map(h => h.trim());
  const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
  if (missing.length > 0) {
    throw new Error('CSVに次の列が見つかりません: ' + missing.join(', '));
  }

  const num = (v) => {
    if (v === undefined || v === '' || v === null) return null;
    const n = parseFloat(String(v).replace(/,/g, ''));
    return isNaN(n) ? null : n;
  };

  return lines.slice(1).map((line, idx) => {
    const cells = line.split(',').map(c => c.trim());
    const row = {};
    headers.forEach((h, i) => { row[h] = cells[i] !== undefined ? cells[i] : ''; });

    const elapsedMonths = OPTIONAL_COLS[0] in row ? num(row["経過月数"]) : null;
    const recordType = (elapsedMonths !== null && elapsedMonths > 0 && elapsedMonths < 12) ? 'monthly' : 'annual';

    return {
      periodLabel: row["年度"] || `データ${idx + 1}`,
      recordType,
      elapsedMonths,
      sales: num(row["売上高"]) || 0,
      ordinaryProfit: num(row["経常利益"]) || 0,
      totalAssets: num(row["総資産"]) || 0,
      equity: num(row["純資産"]) || 0,
      currentAssets: num(row["流動資産"]) || 0,
      currentLiabilities: num(row["流動負債"]) || 0,
      employees: num(row["従業員数"]) || 0,
      valueAdded: num(row["付加価値額"])
    };
  });
}

module.exports = { parseCSV, REQUIRED_COLS, OPTIONAL_COLS };
