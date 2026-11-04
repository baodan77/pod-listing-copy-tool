'use strict';

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const { SaveStore } = require('./lib/store');
const { generateCopy } = require('./lib/openai');

const PORT = Number(process.env.PORT) || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const AUTH_USERNAME = process.env.AUTH_USERNAME || '';
const AUTH_PASSWORD = process.env.AUTH_PASSWORD || '';
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || '';

if (!process.env.SESSION_SECRET && NODE_ENV === 'production') {
  console.warn('[warn] SESSION_SECRET not set; using ephemeral secret (sessions reset on restart)');
}
if (!AUTH_USERNAME || !AUTH_PASSWORD) {
  console.warn('[warn] AUTH_USERNAME / AUTH_PASSWORD not set — login will fail until configured');
}
if (!OPENAI_API_KEY) {
  console.warn('[warn] OPENAI_API_KEY not set — /api/generate will fail until configured');
}

const store = new SaveStore(DATA_DIR);
const app = express();

app.set('trust proxy', 1);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: 'pod.sid',
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  }),
);

function timingSafeEqualStr(a, b) {
  const aa = Buffer.from(String(a || ''), 'utf8');
  const bb = Buffer.from(String(b || ''), 'utf8');
  if (aa.length !== bb.length) {
    crypto.timingSafeEqual(aa, Buffer.alloc(aa.length));
    return false;
  }
  return crypto.timingSafeEqual(aa, bb);
}

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  if (req.path.startsWith('/api/')) {
    return res.status(401).json({ ok: false, error: '未登录' });
  }
  return res.redirect('/login');
}

app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    persistent: store.persistent,
    model: OPENAI_MODEL,
  });
});

app.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) return res.redirect('/');
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/login', (req, res) => {
  const username = String(req.body?.username || '');
  const password = String(req.body?.password || '');
  const userOk = timingSafeEqualStr(username, AUTH_USERNAME);
  const passOk = timingSafeEqualStr(password, AUTH_PASSWORD);
  if (!AUTH_USERNAME || !AUTH_PASSWORD || !userOk || !passOk) {
    return res.status(401).json({ ok: false, error: '用户名或密码错误' });
  }
  req.session.authenticated = true;
  req.session.username = username;
  return res.json({ ok: true });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('pod.sid');
    res.json({ ok: true });
  });
});

app.get('/api/me', (req, res) => {
  if (!req.session?.authenticated) return res.status(401).json({ ok: false });
  res.json({
    ok: true,
    username: req.session.username || AUTH_USERNAME,
    persistent: store.persistent,
  });
});

app.post('/api/generate', requireAuth, async (req, res) => {
  try {
    const listings = Array.isArray(req.body?.listings) ? req.body.listings : [];
    const pack = await generateCopy({
      apiKey: OPENAI_API_KEY,
      model: OPENAI_MODEL,
      baseUrl: OPENAI_BASE_URL || undefined,
      listings,
    });
    res.json({ ok: true, pack });
  } catch (err) {
    console.error('[generate]', err.message || err);
    const status =
      err.code === 'BAD_INPUT' ? 400 : err.code === 'NO_KEY' ? 503 : 500;
    res.status(status).json({
      ok: false,
      error: err.message || '生成失败',
      code: err.code || 'ERROR',
    });
  }
});

app.get('/api/saves', requireAuth, (_req, res) => {
  res.json({
    ok: true,
    persistent: store.persistent,
    items: store.list(),
  });
});

app.post('/api/saves', requireAuth, (req, res) => {
  const body = req.body || {};
  if (!body.titles || !body.descriptionEn) {
    return res.status(400).json({ ok: false, error: '缺少 titles 或 descriptionEn' });
  }
  const record = store.add({
    label: body.label,
    sourceTitles: body.sourceTitles,
    titles: body.titles,
    descriptionEn: body.descriptionEn,
    descriptionZh: body.descriptionZh,
    bulletsEn: body.bulletsEn,
    bulletsZh: body.bulletsZh,
  });
  res.json({ ok: true, item: record, persistent: store.persistent });
});

app.delete('/api/saves/:id', requireAuth, (req, res) => {
  const removed = store.delete(String(req.params.id));
  if (!removed) return res.status(404).json({ ok: false, error: '未找到' });
  res.json({ ok: true, persistent: store.persistent });
});

app.use(express.static(path.join(__dirname, 'public'), { index: false }));

app.get('/', requireAuth, (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: '服务器错误' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`POD listing copy tool listening on 0.0.0.0:${PORT} (${NODE_ENV})`);
  console.log(`DATA_DIR=${DATA_DIR} persistent=${store.persistent}`);
});
