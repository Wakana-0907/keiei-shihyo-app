const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { computeIndicators, judge, judgeLowerBetter, diagnoseCompany } = require(path.join('..', 'server', 'lib', 'indicators'));

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

test('judgeLowerBetter: 低いほど良い指標のしきい値（例:債務償還年数）', () => {
  assert.equal(judgeLowerBetter(8, 10, 15).cls, 'good');
  assert.equal(judgeLowerBetter(12, 10, 15).cls, 'mid');
  assert.equal(judgeLowerBetter(20, 10, 15).cls, 'bad');
  assert.equal(judgeLowerBetter(null, 10, 15).cls, 'mid');
});

test('computeIndicators: 有利子負債・減価償却費から債務償還年数と借入金月商倍率を計算', () => {
  const record = {
    sales: 120000000, ordinaryProfit: 6000000, totalAssets: 90000000, equity: 30000000,
    currentAssets: 40000000, currentLiabilities: 30000000, employees: 10, valueAdded: 30000000,
    elapsedMonths: null, interestBearingDebt: 40000000, depreciation: 4000000
  };
  const ind = computeIndicators(record);
  // 債務償還年数 = 40,000,000 / (6,000,000+4,000,000) = 4年
  assert.equal(ind.debtServiceYears, 4);
  // 借入金月商倍率 = 40,000,000 / (120,000,000/12) = 4ヶ月
  assert.equal(ind.debtMonths, 4);
});

test('computeIndicators: 有利子負債が未入力なら融資指標はnull', () => {
  const record = {
    sales: 120000000, ordinaryProfit: 6000000, totalAssets: 90000000, equity: 30000000,
    currentAssets: 40000000, currentLiabilities: 30000000, employees: 10, valueAdded: 30000000,
    elapsedMonths: null, interestBearingDebt: null, depreciation: null
  };
  const ind = computeIndicators(record);
  assert.equal(ind.debtServiceYears, null);
  assert.equal(ind.debtMonths, null);
});

test('computeIndicators: 月次試算表では減価償却費も年換算される', () => {
  const record = {
    sales: 60000000, ordinaryProfit: 3000000, totalAssets: 90000000, equity: 30000000,
    currentAssets: 40000000, currentLiabilities: 30000000, employees: 10, valueAdded: 30000000,
    elapsedMonths: 6, interestBearingDebt: 40000000, depreciation: 2000000
  };
  const ind = computeIndicators(record);
  // 売上・利益・減価償却費が2倍に年換算される: 債務償還年数 = 40,000,000/((3,000,000+2,000,000)*2) = 4年
  assert.equal(ind.debtServiceYears, 4);
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

test('diagnoseCompany: summary（総評文）が生成される', () => {
  const records = [{
    id: 1, periodLabel: '2024年3月期', recordType: 'annual', elapsedMonths: null,
    sales: 171000000, ordinaryProfit: 4800000, totalAssets: 108000000, equity: 38000000,
    currentAssets: 53000000, currentLiabilities: 44000000, employees: 13, valueAdded: 45500000
  }];
  const result = diagnoseCompany(records, '小売業');
  assert.equal(typeof result.summary, 'string');
  assert.ok(result.summary.length > 20);
  assert.ok(result.summary.includes('小売業'));
});

test('diagnoseCompany: データ不足時のsummaryはフォールバック文言', () => {
  const result = diagnoseCompany([], '小売業');
  assert.ok(result.summary.includes('総評を生成できません'));
});

test('diagnoseCompany: 有利子負債を入力すると債務償還年数・借入金月商倍率が診断項目に追加される', () => {
  const records = [{
    id: 1, periodLabel: 'テスト', recordType: 'annual', elapsedMonths: null,
    sales: 120000000, ordinaryProfit: 6000000, totalAssets: 90000000, equity: 30000000,
    currentAssets: 40000000, currentLiabilities: 30000000, employees: 10, valueAdded: 30000000,
    interestBearingDebt: 40000000, depreciation: 4000000
  }];
  const result = diagnoseCompany(records, '小売業');
  const debtYears = result.diagnosis.find(d => d.key === 'debtServiceYears');
  const debtMonths = result.diagnosis.find(d => d.key === 'debtMonths');
  assert.ok(debtYears);
  assert.equal(debtYears.value, 4);
  assert.equal(debtYears.judge.cls, 'good'); // 4年 <= 10年 → 良好
  assert.ok(debtMonths);
  assert.equal(debtMonths.value, 4);
});

test('diagnoseCompany: 逆指標(債務償還年数)が最も悪い場合、総評の弱み言及が正しい向きになる', () => {
  // 債務償還年数が極端に悪い(=良好ではない他指標より深刻)ケースで、
  // 総評が「業種平均を下回っています」のような誤った向きの文言にならないことを確認
  const records = [{
    id: 1, periodLabel: 'テスト', recordType: 'annual', elapsedMonths: null,
    sales: 120000000, ordinaryProfit: 500000, totalAssets: 90000000, equity: 30000000,
    currentAssets: 40000000, currentLiabilities: 30000000, employees: 10, valueAdded: 30000000,
    interestBearingDebt: 100000000, depreciation: 1000000
  }];
  const result = diagnoseCompany(records, '小売業');
  const debtYears = result.diagnosis.find(d => d.key === 'debtServiceYears');
  assert.equal(debtYears.judge.cls, 'bad'); // 100,000,000/(500,000+1,000,000)=66.7年 > 15年
  // 「〜を下回っています」という誤った表現が使われていないこと（上回っています、が正しい）
  if (result.summary.includes('債務償還年数')) {
    assert.ok(result.summary.includes('上回っています'));
    assert.ok(!result.summary.includes('債務償還年数は67年にとどまり'));
  }
});
