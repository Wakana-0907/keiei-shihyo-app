const express = require('express');
const db = require('../db');
const { requireAuth } = require('./auth');
const { INDUSTRY_BENCH } = require('../lib/benchmarks');

const router = express.Router();
router.use(requireAuth);

function getOwnedCompany(companyId, userId) {
  return db.prepare('SELECT * FROM companies WHERE id = ? AND user_id = ?').get(companyId, userId);
}

router.get('/industries', (req, res) => {
  res.json(Object.keys(INDUSTRY_BENCH));
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
