const path = require('path');
const express = require('express');
const session = require('express-session');

const { router: authRouter } = require('./routes/auth');
const { router: companiesRouter } = require('./routes/companies');
const recordsRouter = require('./routes/records');
const actionsRouter = require('./routes/actions');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-please-change-in-production';

app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7日間
    sameSite: 'lax'
  }
}));

app.use('/api/auth', authRouter);
app.use('/api/companies', companiesRouter);
app.use('/api/companies/:companyId', recordsRouter);
app.use('/api/companies/:companyId', actionsRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'サーバーエラーが発生しました。' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`経営指標診断ツール: http://localhost:${PORT}`);
  });
}

module.exports = app;
