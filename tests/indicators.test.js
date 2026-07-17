const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { computeIndicators, judge, judgeCurrentRatio, diagnoseCompany } = require(path.join('..', 'server', 'lib', 'indicators'));

test('computeIndicators: 通常の決算データ（年換算なし）', () => {
  const record = {
    sales: 171000000, ordinaryProfit: 4800000, totalAssets: 108000000, equity: 38000000,
    currentAssets: 53000000, currentLiabilities: 44000000, employees: 13, valueAdded: 45500000,
    elapsedMonths: null
  };
  const ind = computeIndicators(record);
  assert.equal(ind.annualized, false);
  assert.ok(Math.abs(ind.equityRatio - 35.185) < 0.01);
  assert.ok(Math.abs(ind.profitMargin - 2.807) < 0.01);
  assert.ok(Math.abs(ind.turnover - 1.5833) < 0.001);
  assert.ok(Math.abs(ind.currentRatio - 120.4545) < 0.001);
});

test('computeIndicators: 月次試算表は年換算される（フロー項目のみ）', () => {
  const record = {
    sales: 50000000, ordinaryProfit: 3000000, totalAssets: 40000000, equity: 15000000,
    currentAssets: 25000000, currentLiabilities: 18000000, employees: 5, valueAdded: 20000000,
    elapsedMonths: 6
  };
  const ind = computeIndicators(record);
  assert.equal(ind.annualized, true);
  // 売上・利益・付加価値額は年換算(×2)、資産・負債・従業員数はそのまま
  assert.equal(ind.profitMargin, 6); // (3,000,000*2)/(50,000,000*2)*100 = 6
  assert.equal(ind.turnover, 2.5);   // (50,000,000*2)/40,000,000
  assert.equal(ind.roe, 40);         // (3,000,000*2)/15,000,000*100
  assert.equal(ind.productivity, 800); // (20,000,000*2)/5/10000
});

test('computeIndicators: 12ヶ月経過は年換算しない', () => {
  const record = {
    sales: 100000000, ordinaryProfit: 5000000, totalAssets: 50000000, equity: 20000000,
    currentAssets: 30000000, currentLiabilities: 20000000, employees: 10, valueAdded: 25000000,
    elapsedMonths: 12
  };
  const ind = computeIndicators(record);
  assert.equal(ind.annualized, false);
  assert.equal(ind.profitMargin, 5);
});

test('judge: しきい値の境界（良好/平均的/要注意）', () => {
  assert.equal(judge(120, 100).cls, 'good');   // ratio 1.2 -> good
  assert.equal(judge(100, 100).cls, 'mid');     // ratio 1.0 -> mid
  assert.equal(judge(79, 100).cls, 'bad');      // ratio 0.79 -> bad
  assert.equal(judge(null, 100).cls, 'mid');    // 欠損値は判定不能扱い
});

test('judgeCurrentRatio: 150%以上=良好, 100%未満=要注意', () => {
  assert.equal(judgeCurrentRatio(200).cls, 'good');
  assert.equal(judgeCurrentRatio(120).cls, 'mid');
  assert.equal(judgeCurrentRatio(90).cls, 'bad');
});

test('diagnoseCompany: 未対応業種は全産業平均にフォールバックする', () => {
  const records = [{
    id: 1, periodLabel: 'テスト', recordType: 'annual', elapsedMonths: null,
    sales: 100000000, ordinaryProfit: 4260000, totalAssets: 100000000, equity: 40130000,
    currentAssets: 50000000, currentLiabilities: 40000000, employees: 10, valueAdded: 26930000
  }];
  const result = diagnoseCompany(records, '存在しない業種');
  const pm = result.diagnosis.find(d => d.key === 'profitMargin');
  assert.equal(pm.benchValue, 4.83); // 全産業（合計）の参考値にフォールバック
});

test('diagnoseCompany: 業種別ベンチマークが正しく参照される', () => {
  const records = [{
    id: 1, periodLabel: 'テスト', recordType: 'annual', elapsedMonths: null,
    sales: 100000000, ordinaryProfit: 3000000, totalAssets: 80000000, equity: 30000000,
    currentAssets: 40000000, currentLiabilities: 30000000, employees: 8, valueAdded: 20000000
  }];
  const result = diagnoseCompany(records, '小売業');
  const pm = result.diagnosis.find(d => d.key === 'profitMargin');
  assert.equal(pm.benchValue, 2.77);
});
