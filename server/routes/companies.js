const express = require('express');
const db = require('../db');
const { requireAuth } = require('./auth');
const { INDUSTRY_BENCH } = require('../lib/benchmarks');
const { diagnoseCompany } = require('../lib/indicators');

const router = express.Router();
router.use(requireAuth);

function getOwnedCompany(companyId, userId) {
  return db.prepare('SELECT * FROM companies WHERE id = ? AND user_id = ?').get(companyId, userId);
}

function rowToRecordForDiagnosis(row) {
  return {
    id: row.id, periodLabel: row.period_label, recordType: row.record_type, elapsedMonths: row.elapsed_months,
    sales: row.sales, ordinaryProfit: row.ordinary_profit, totalAssets: row.total_assets, equity: row.equity,
    currentAssets: row.current_assets, currentLiabilities: row.current_liabilities, employees: row.employees,
    valueAdded: row.value_added,
    interestBearingDebt: row.interest_bearing_debt, depreciation: row.depreciation
  };
}

router.get('/industries', (req, res) => {
  res.json(Object.keys(INDUSTRY_BENCH));
});

// クライアント企業を横断して最新指標を比較するための一覧。
// /:id ルートより先に定義しないと "compare" が :id として解釈されてしまうので注意。
router.get('/compare', (req, res) => {
  const companies = db.prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  const result = companies.map(c => {
    const rows = db.prepare('SELECT * FROM financial_records WHERE company_id = ? ORDER BY created_at ASC').all(c.id);
    if (rows.length === 0) {
      return { id: c.id, name: c.name, industry: c.industry, hasData: false };
    }
    const records = rows.map(rowToRecordForDiagnosis);
    const diagnosis = diagnoseCompany(records, c.industry);
    const byKey = {};
    diagnosis.diagnosis.forEach(it => { byKey[it.key] = it; });
    const scoreCounts = diagnosis.diagnosis.reduce((acc, it) => {
      acc[it.judge.cls] = (acc[it.judge.cls] || 0) + 1;
      return acc;
    }, { good: 0, mid: 0, bad: 0 });

    return {
      id: c.id,
      name: c.name,
      industry: c.industry,
      hasData: true,
      latestPeriod: records[records.length - 1].periodLabel,
      equityRatio: byKey.equityRatio ? byKey.equityRatio.value : null,
      profitMargin: byKey.profitMargin ? byKey.profitMargin.value : null,
      turnover: byKey.turnover ? byKey.turnover.value : null,
      roe: byKey.roe ? byKey.roe.value : null,
      currentRatio: byKey.currentRatio ? byKey.currentRatio.value : null,
      productivity: byKey.productivity ? byKey.productivity.value : null,
      debtServiceYears: byKey.debtServiceYears ? byKey.debtServiceYears.value : null,
      goodCount: scoreCounts.good,
      midCount: scoreCounts.mid,
      badCount: scoreCounts.bad
    };
  });
  res.json(result);
});

router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM companies WHERE user_id = ? ORDER BY created_at DESC').all(req.session.userId);
  res.json(rows);
});

router.post('/', (req, res) => {
  const { name, industry, memo } = req.body || {};
  if (!name || !industry) {
    return res.status(400).json({ error: 'name と industry は必須です。' });
  }
  if (!INDUSTRY_BENCH[industry]) {
    return res.status(400).json({ error: `未対応の業種です: ${industry}` });
  }
  const info = db.prepare('INSERT INTO companies (user_id, name, industry, memo) VALUES (?, ?, ?, ?)')
    .run(req.session.userId, name, industry, memo || null);
  const company = db.prepare('SELECT * FROM companies WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(company);
});

router.get('/:id', (req, res) => {
  const company = getOwnedCompany(req.params.id, req.session.userId);
  if (!company) return res.status(404).json({ error: '会社が見つかりません。' });
  res.json(company);
});

router.put('/:id', (req, res) => {
  const company = getOwnedCompany(req.params.id, req.session.userId);
  if (!company) return res.status(404).json({ error: '会社が見つかりません。' });
  const { name, industry, memo } = req.body || {};
  if (industry && !INDUSTRY_BENCH[industry]) {
    return res.status(400).json({ error: `未対応の業種です: ${industry}` });
  }
  db.prepare('UPDATE companies SET name = ?, industry = ?, memo = ? WHERE id = ?')
    .run(name || company.name, industry || company.industry, memo !== undefined ? memo : company.memo, company.id);
  res.json(db.prepare('SELECT * FROM companies WHERE id = ?').get(company.id));
});

router.delete('/:id', (req, res) => {
  const company = getOwnedCompany(req.params.id, req.session.userId);
  if (!company) return res.status(404).json({ error: '会社が見つかりません。' });
  db.prepare('DELETE FROM companies WHERE id = ?').run(company.id);
  res.json({ ok: true });
});

module.exports = { router, getOwnedCompany };
