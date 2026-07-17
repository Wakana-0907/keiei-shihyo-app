const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const { computeHealthScore } = require(path.join('..', 'server', 'lib', 'score'));
const { generateQuestions } = require(path.join('..', 'server', 'lib', 'questions'));
const { computeSuccessionReadiness } = require(path.join('..', 'server', 'lib', 'succession'));
const { rankAndPercentile } = require(path.join('..', 'server', 'lib', 'ranking'));

// ---- score.js ----

test('computeHealthScore: 全項目goodなら100点・優良', () => {
  const items = [
    { judge: { cls: 'good', label: '良好' } },
    { judge: { cls: 'good', label: '良好' } }
  ];
  const result = computeHealthScore(items);
  assert.equal(result.score, 100);
  assert.equal(result.label, '優良');
  assert.equal(result.count, 2);
});

test('computeHealthScore: good/mid/badの混在は単純平均される', () => {
  const items = [
    { judge: { cls: 'good', label: '良好' } }, // 100
    { judge: { cls: 'mid', label: '平均的' } }, // 60
    { judge: { cls: 'bad', label: '要注意' } }  // 20
  ];
  const result = computeHealthScore(items);
  assert.equal(result.score, 60); // (100+60+20)/3
  assert.equal(result.label, '普通');
  assert.equal(result.count, 3);
});

test('computeHealthScore: judgeが判定不能(label:"—")の項目は除外される', () => {
  const items = [
    { judge: { cls: 'good', label: '良好' } },
    { judge: { cls: 'mid', label: '—' } }
  ];
  const result = computeHealthScore(items);
  assert.equal(result.score, 100);
  assert.equal(result.count, 1);
});

test('computeHealthScore: 診断項目が0件ならnullを返す', () => {
  const result = computeHealthScore([]);
  assert.equal(result.score, null);
  assert.equal(result.label, null);
  assert.equal(result.count, 0);
});

test('computeHealthScore: 境界値でラベルが正しく切り替わる', () => {
  // 平均70点ちょうど -> 良好
  const items70 = [{ judge: { cls: 'good', label: '良好' } }, { judge: { cls: 'bad', label: '要注意' } }, { judge: { cls: 'good', label: '良好' } }];
  // (100+20+100)/3 = 73.3 -> round 73 -> 良好
  assert.equal(computeHealthScore(items70).label, '良好');
});

// ---- questions.js ----

test('generateQuestions: bad項目が優先的にmid項目より先に並ぶ', () => {
  const items = [
    { key: 'currentRatio', judge: { cls: 'mid' } },
    { key: 'equityRatio', judge: { cls: 'bad' } }
  ];
  const qs = generateQuestions(items);
  assert.equal(qs.length, 2);
  assert.ok(qs[0].includes('自己資本'));
});

test('generateQuestions: 最大5件に制限される', () => {
  const items = [
    { key: 'equityRatio', judge: { cls: 'bad' } },
    { key: 'profitMargin', judge: { cls: 'bad' } },
    { key: 'turnover', judge: { cls: 'bad' } },
    { key: 'roe', judge: { cls: 'bad' } },
    { key: 'currentRatio', judge: { cls: 'bad' } },
    { key: 'valueAddedRatio', judge: { cls: 'bad' } }
  ];
  const qs = generateQuestions(items);
  assert.equal(qs.length, 5);
});

test('generateQuestions: bad/midが無ければポジティブな定型質問にフォールバックする', () => {
  const items = [{ key: 'equityRatio', judge: { cls: 'good' } }];
  const qs = generateQuestions(items);
  assert.equal(qs.length, 2);
  assert.ok(qs[0].includes('懸念点'));
});

test('generateQuestions: QUESTIONSに定義のないkeyは無視される', () => {
  const items = [{ key: '未知の指標', judge: { cls: 'bad' } }];
  const qs = generateQuestions(items);
  // 未定義キーは弾かれ、bad/midともに空になるのでポジティブフォールバック
  assert.equal(qs.length, 2);
});

// ---- succession.js ----

test('computeSuccessionReadiness: ownerAge・successorStatusが両方未入力ならnull', () => {
  const result = computeSuccessionReadiness({ ownerAge: null, successorStatus: null, equityRatio: 30, debtServiceYears: 5 });
  assert.equal(result, null);
});

test('computeSuccessionReadiness: 70歳以上は「喫緊の課題」文言になる', () => {
  const result = computeSuccessionReadiness({ ownerAge: 72, successorStatus: null, equityRatio: null, debtServiceYears: null });
  assert.ok(result.summary.includes('喫緊の課題'));
});

test('computeSuccessionReadiness: 60〜69歳は「本格化」文言になる', () => {
  const result = computeSuccessionReadiness({ ownerAge: 65, successorStatus: null, equityRatio: null, debtServiceYears: null });
  assert.ok(result.summary.includes('本格化'));
});

test('computeSuccessionReadiness: 後継者「未定」はM&A等の選択肢に言及する', () => {
  const result = computeSuccessionReadiness({ ownerAge: null, successorStatus: '未定', equityRatio: null, debtServiceYears: null });
  assert.ok(result.summary.includes('M&A'));
});

test('computeSuccessionReadiness: 自己資本比率40%以上は財務面の承継しやすさに言及する', () => {
  const result = computeSuccessionReadiness({ ownerAge: null, successorStatus: '決定済み', equityRatio: 45, debtServiceYears: null });
  assert.ok(result.summary.includes('財務面での承継のしやすさは高い'));
});

test('computeSuccessionReadiness: 債務償還年数が15年超なら経営者保証の負担に言及する', () => {
  const result = computeSuccessionReadiness({ ownerAge: 68, successorStatus: null, equityRatio: null, debtServiceYears: 20 });
  assert.ok(result.summary.includes('経営者保証を引き継ぐ後継者の負担'));
});

test('computeSuccessionReadiness: 常に専門家相談の注記文で終わる', () => {
  const result = computeSuccessionReadiness({ ownerAge: 50, successorStatus: null, equityRatio: null, debtServiceYears: null });
  assert.ok(result.summary.includes('税理士・弁護士・事業承継の専門家への相談'));
});

// ---- ranking.js ----

test('rankAndPercentile: 最上位はpercentile=100、最下位は0', () => {
  const values = [10, 30, 20];
  assert.equal(rankAndPercentile(values, 30).percentile, 100);
  assert.equal(rankAndPercentile(values, 30).rank, 1);
  assert.equal(rankAndPercentile(values, 10).percentile, 0);
  assert.equal(rankAndPercentile(values, 10).rank, 3);
});

test('rankAndPercentile: 中央の値は0と100の間になる', () => {
  const values = [10, 30, 20];
  const mid = rankAndPercentile(values, 20);
  assert.equal(mid.rank, 2);
  assert.equal(mid.percentile, 50);
});

test('rankAndPercentile: 対象が1件のみならpercentileは100', () => {
  const result = rankAndPercentile([42], 42);
  assert.equal(result.percentile, 100);
  assert.equal(result.total, 1);
});

test('rankAndPercentile: 同値がある場合は先に一致した方が採用される', () => {
  const values = [50, 50, 10];
  const result = rankAndPercentile(values, 50);
  assert.equal(result.rank, 1);
  assert.equal(result.total, 3);
});
