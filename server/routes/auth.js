const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');

const router = express.Router();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/register', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email と password は必須です。' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'メールアドレスの形式が正しくありません。' });
  }
  if (String(password).length < 8) {
    return res.status(400).json({ error: 'パスワードは8文字以上にしてください。' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.status(409).json({ error: 'そのメールアドレスは既に登録されています。' });
  }

  const hash = bcrypt.hashSync(password, 10);
  const info = db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)').run(email, hash);
  const userId = Number(info.lastInsertRowid);
  req.session.userId = userId;
  res.status(201).json({ id: userId, email });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email と password は必須です。' });
  }
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'メールアドレスまたはパスワードが正しくありません。' });
  }
  req.session.userId = user.id;
  res.json({ id: user.id, email: user.email });
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ ok: true });
  });
});

router.get('/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: '未ログインです。' });
  const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(req.session.userId);
  if (!user) return res.status(401).json({ error: '未ログインです。' });
  res.json(user);
});

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.status(401).json({ error: '未ログインです。' });
  next();
}

module.exports = { router, requireAuth };
