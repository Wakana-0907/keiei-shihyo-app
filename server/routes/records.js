const express = require('express');
const db = require('../db');
const { requireAuth } = require('./auth');
const { getOwnedCompany } = require('./companies');
const { parseCSV } = require('../lib/csv');
const { diagnoseCompany } = require('../lib/indicators');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

function rowToRecord(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    periodLabel: row.period_label,
    recordType: row.record_type,
    elapsedMonths: row.elapsed_months,
    sales: row.sales,
    ordinaryProfit: row.ordinary_profit,
    totalAssets: row.total_assets,
    equity: row.equity,
    currentAssets: row.current_assets,
    currentLiabilities: row.current_liabilities,
    employees: row.employees,
    valueAdded: row.value_added,
    interestBearingDebt: row.interest_bearing_debt,
    depreciation: row.depreciation,
    createdAt: row.created_at
  };
}

function requireCompany(req, res, next) {
  const company = getOwnedCompany(req.params.companyId, req.session.userId);
  if (!company) return res.status(404).json({ error: '会社が見つかりません。' });
  req.company = company;
  next();
}
router.use(requireCompany);

const insertStmt = db.prepare(`
  INSERT INTO financial_records
    (company_id, period_label, record_type, elapsed_months, sales, ordinary_profit,
     total_assets, equity, current_assets, current_liabilities, employees, value_added,
     interest_bearing_debt, depreciation)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

function insertRecord(companyId, r) {
  const info = insertStmt.run(
    companyId, r.periodLabel, r.recordType || 'annual', r.elapsedMonths ?? null,
    r.sales, r.ordinaryProfit, r.totalAssets, r.equity, r.currentAssets,
    r.currentLiabilities, r.employees, r.valueAdded ?? null,
    r.interestBearingDebt ?? null, r.depreciation ?? null
  );
  return Number(info.lastInsertRowid);
}

router.get('/records', (req, res) => {
  const rows = db.prepare('SELECT * FROM financial_records WHERE company_id = ? ORDER BY created_at ASC').all(req.company.id);
  res.json(rows.map(rowToRecord));
});

router.post('/records', (req, res) => {
  const body = req.body || {};
  const required = ['periodLabel', 'sales', 'ordinaryProfit', 'totalAssets', 'equity', 'currentAssets', 'currentLiabilities', 'employees'];
  // interestBearingDebt / depreciation は任意項目
  const missing = required.filter(k => body[k] === undefined || body[k] === null || body[k] === '');
  if (missing.length > 0) {
    return res.status(400).json({ error: '次の項目が不足しています: ' + missing.join(', ') });
  }
  const id = insertRecord(req.company.id, body);
  const row = db.prepare('SELECT * FROM financial_records WHERE id = ?').get(id);
  res.status(201).json(rowToRecord(row));
});

router.post('/records/import', (req, res) => {
  const { csv } = req.body || {};
  if (!csv || typeof csv !== 'string') {
    return res.status(400).json({ error: 'csv（文字列）は必須です。' });
  }
  let parsed;
  try {
    parsed = parseCSV(csv);
  } catch (e) {
    return res.status(400).json({ error: e.message });
  }
  const ids = parsed.map(r => insertRecord(req.company.id, r));
  const rows = ids.map(id => rowToRecord(db.prepare('SELECT * FROM financial_records WHERE id = ?').get(id)));
  res.status(201).json({ imported: rows.length, records: rows });
});

router.delete('/records/:recordId', (req, res) => {
  const row = db.prepare('SELECT * FROM financial_records WHERE id = ? AND company_id = ?').get(req.params.recordId, req.company.id);
  if (!row) return res.status(404).json({ error: 'データが見つかりません。' });
  db.prepare('DELETE FROM financial_records WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

router.get('/diagnosis', (req, res) => {
  const rows = db.prepare('SELECT * FROM financial_records WHERE company_id = ? ORDER BY created_at ASC').all(req.company.id);
  const records = rows.map(row => ({
    id: row.id,
    periodLabel: row.period_label,
    recordType: row.record_type,
    elapsedMonths: row.elapsed_months,
    sales: row.sales,
    ordinaryProfit: row.ordinary_profit,
    totalAssets: row.total_assets,
    equity: row.equity,
    currentAssets: row.current_assets,
    currentLiabilities: row.current_liabilities,
    employees: row.employees,
    valueAdded: row.value_added,
    interestBearingDebt: row.interest_bearing_debt,
    depreciation: row.depreciation
  }));
  const result = diagnoseCompany(records, req.company.industry);
  res.json(result);
});

module.exports = router;
