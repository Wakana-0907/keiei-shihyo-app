const express = require('express');
const db = require('../db');
const { requireAuth } = require('./auth');
const { getOwnedCompany } = require('./companies');

const router = express.Router({ mergeParams: true });
router.use(requireAuth);

function requireCompany(req, res, next) {
  const company = getOwnedCompany(req.params.companyId, req.session.userId);
  if (!company) return res.status(404).json({ error: '会社が見つかりません。' });
  req.company = company;
  next();
}
router.use(requireCompany);

function rowToAction(row) {
  return {
    id: row.id,
    companyId: row.company_id,
    indicatorKey: row.indicator_key,
    title: row.title,
    description: row.description,
    dueDate: row.due_date,
    status: row.status,
    createdAt: row.created_at,
    completedAt: row.completed_at
  };
}

router.get('/actions', (req, res) => {
  const rows = db.prepare('SELECT * FROM action_items WHERE company_id = ? ORDER BY (status = \'done\'), due_date IS NULL, due_date ASC, created_at ASC').all(req.company.id);
  res.json(rows.map(rowToAction));
});

router.post('/actions', (req, res) => {
  const { title, description, indicatorKey, dueDate } = req.body || {};
  if (!title) {
    return res.status(400).json({ error: 'title は必須です。' });
  }
  const info = db.prepare(`
    INSERT INTO action_items (company_id, indicator_key, title, description, due_date, status)
    VALUES (?, ?, ?, ?, ?, 'open')
  `).run(req.company.id, indicatorKey || null, title, description || null, dueDate || null);
  const row = db.prepare('SELECT * FROM action_items WHERE id = ?').get(Number(info.lastInsertRowid));
  res.status(201).json(rowToAction(row));
});

router.put('/actions/:actionId', (req, res) => {
  const row = db.prepare('SELECT * FROM action_items WHERE id = ? AND company_id = ?').get(req.params.actionId, req.company.id);
  if (!row) return res.status(404).json({ error: 'アクションプランが見つかりません。' });
  const { title, description, dueDate, status } = req.body || {};
  const newStatus = status || row.status;
  const completedAt = newStatus === 'done'
    ? (row.status === 'done' ? row.completed_at : new Date().toISOString())
    : null;
  db.prepare(`
    UPDATE action_items SET title = ?, description = ?, due_date = ?, status = ?, completed_at = ?
    WHERE id = ?
  `).run(
    title !== undefined ? title : row.title,
    description !== undefined ? description : row.description,
    dueDate !== undefined ? dueDate : row.due_date,
    newStatus,
    completedAt,
    row.id
  );
  res.json(rowToAction(db.prepare('SELECT * FROM action_items WHERE id = ?').get(row.id)));
});

router.delete('/actions/:actionId', (req, res) => {
  const row = db.prepare('SELECT * FROM action_items WHERE id = ? AND company_id = ?').get(req.params.actionId, req.company.id);
  if (!row) return res.status(404).json({ error: 'アクションプランが見つかりません。' });
  db.prepare('DELETE FROM action_items WHERE id = ?').run(row.id);
  res.json({ ok: true });
});

module.exports = router;
