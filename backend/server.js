require('dotenv').config()

const express = require('express')
const cors = require('cors')
const http = require('http')
const { WebSocketServer } = require('ws')
const { Ollama } = require('ollama')
const fs = require('fs')
const path = require('path')
const rateLimit = require('express-rate-limit')
const Database = require('better-sqlite3')

const app = express()
const server = http.createServer(app)
const wss = new WebSocketServer({ server })
const ollama = new Ollama({ host: process.env.OLLAMA_HOST || 'http://localhost:11434' })

// ── Constants ──────────────────────────────────────────────────────────────
const ADMIN_TOKEN = process.env.ADMIN_TOKEN
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || 'http://localhost:5173'
const MAX_MESSAGE_BYTES = 8 * 1024       // 8 KB max par message chat
const MAX_PAYLOAD_BYTES = 100 * 1024     // 100 KB max pour les requêtes REST
const MAX_HISTORY_TURNS = 20             // max 20 tours d'historique par conversation
const MAX_WS_PAYLOAD = MAX_MESSAGE_BYTES + 6 * 1024  // 8 Ko message + 6 Ko contexte page

if (!ADMIN_TOKEN) {
  console.error('FATAL: ADMIN_TOKEN manquant dans le fichier .env — arrêt du serveur.')
  process.exit(1)
}

const DATA_DIR = process.env.DATA_DIR || __dirname
const DB_FILE = path.join(DATA_DIR, 'chatsphere.db')
const BACKUP_DIR = path.join(DATA_DIR, 'backups')

const db = new Database(DB_FILE)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS bots (
    bot_id         TEXT PRIMARY KEY,
    name           TEXT NOT NULL,
    system_prompt  TEXT NOT NULL DEFAULT '',
    knowledge_base TEXT NOT NULL DEFAULT '',
    color          TEXT NOT NULL DEFAULT '#00A8CC',
    welcome_message TEXT NOT NULL DEFAULT 'Bonjour ! Comment puis-je vous aider ?',
    model          TEXT NOT NULL DEFAULT 'llama3',
    provider       TEXT NOT NULL DEFAULT 'ollama',
    openrouter_key TEXT NOT NULL DEFAULT '',
    created_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    updated_at     TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE TABLE IF NOT EXISTS ratings (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    bot_id     TEXT NOT NULL,
    rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
    comment    TEXT NOT NULL DEFAULT '',
    user_msg   TEXT NOT NULL DEFAULT '',
    bot_msg    TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_ratings_bot_id ON ratings(bot_id);
`)

// Migration : ancien schéma (rating IN (1,-1) sans comment) → nouveau (1-5 + comment)
;(function migrateRatings() {
  const info = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='ratings'").get()
  if (!info) return
  const cols = db.prepare('PRAGMA table_info(ratings)').all()
  const hasComment = cols.some(c => c.name === 'comment')
  const oldCheck = info.sql.includes('rating IN (1, -1)')
  if (hasComment && !oldCheck) return  // déjà migré

  console.log('Migration ratings : mise à jour du schéma…')
  db.exec(`
    BEGIN;
    CREATE TABLE ratings_new (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      bot_id     TEXT NOT NULL,
      rating     INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      comment    TEXT NOT NULL DEFAULT '',
      user_msg   TEXT NOT NULL DEFAULT '',
      bot_msg    TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
    );
    INSERT INTO ratings_new (id, bot_id, rating, comment, user_msg, bot_msg, created_at)
      SELECT id, bot_id,
             CASE WHEN rating = 1 THEN 5 WHEN rating = -1 THEN 1 ELSE rating END,
             ${hasComment ? 'comment' : "''"},
             user_msg, bot_msg, created_at
      FROM ratings;
    DROP TABLE ratings;
    ALTER TABLE ratings_new RENAME TO ratings;
    CREATE INDEX IF NOT EXISTS idx_ratings_bot_id ON ratings(bot_id);
    COMMIT;
  `)
  console.log('Migration ratings : OK')
})()

const LEGACY_JSON = path.join(__dirname, 'configs.json')

;(function migrateFromJson() {
  if (!fs.existsSync(LEGACY_JSON)) return
  const existing = db.prepare('SELECT COUNT(*) AS n FROM bots').get()
  if (existing.n > 0) return  // déjà migré

  let legacy
  try { legacy = JSON.parse(fs.readFileSync(LEGACY_JSON, 'utf8')) }
  catch { console.warn('Migration JSON: fichier illisible, ignoré.'); return }

  const insert = db.prepare(`
    INSERT OR IGNORE INTO bots
      (bot_id, name, system_prompt, knowledge_base, color, welcome_message, model, provider, openrouter_key)
    VALUES
      (@botId, @name, @systemPrompt, @knowledgeBase, @color, @welcomeMessage, @model, @provider, @openrouterKey)
  `)

  const migrate = db.transaction((bots) => {
    for (const cfg of Object.values(bots)) {
      insert.run({
        botId: cfg.botId,
        name: cfg.name || 'Sans nom',
        systemPrompt: cfg.systemPrompt || '',
        knowledgeBase: cfg.knowledgeBase || '',
        color: cfg.color || '#00A8CC',
        welcomeMessage: cfg.welcomeMessage || 'Bonjour ! Comment puis-je vous aider ?',
        model: cfg.model || 'llama3',
        provider: cfg.provider || 'ollama',
        openrouterKey: cfg.openrouterKey || '',
      })
    }
  })

  migrate(legacy)
  console.log(`Migration: ${Object.keys(legacy).length} bot(s) importé(s) depuis configs.json`)
  fs.renameSync(LEGACY_JSON, LEGACY_JSON + '.migrated')
})()

function rowToConfig(row) {
  if (!row) return null
  return {
    botId: row.bot_id,
    name: row.name,
    systemPrompt: row.system_prompt,
    knowledgeBase: row.knowledge_base,
    color: row.color,
    welcomeMessage: row.welcome_message,
    model: row.model,
    provider: row.provider,
    openrouterKey: row.openrouter_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function sanitizeConfig(cfg) {
  if (!cfg) return null
  const { openrouterKey, ...safe } = cfg
  return safe
}

const stmt = {
  getBot: db.prepare('SELECT * FROM bots WHERE bot_id = ?'),
  getAllBots: db.prepare('SELECT * FROM bots ORDER BY created_at ASC'),
  insertBot: db.prepare(`
    INSERT INTO bots (bot_id, name, system_prompt, knowledge_base, color, welcome_message, model, provider, openrouter_key)
    VALUES (@botId, @name, @systemPrompt, @knowledgeBase, @color, @welcomeMessage, @model, @provider, @openrouterKey)
  `),
  updateBot: db.prepare(`
    UPDATE bots SET
      name = @name,
      system_prompt = @systemPrompt,
      knowledge_base = @knowledgeBase,
      color = @color,
      welcome_message = @welcomeMessage,
      model = @model,
      provider = @provider,
      openrouter_key = @openrouterKey,
      updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
    WHERE bot_id = @botId
  `),
  deleteBot: db.prepare('DELETE FROM bots WHERE bot_id = ?'),
  insertRating: db.prepare(`
    INSERT INTO ratings (bot_id, rating, comment, user_msg, bot_msg)
    VALUES (@botId, @rating, @comment, @userMsg, @botMsg)
  `),
  getRatingStats: db.prepare(`
    SELECT
      COUNT(*) AS total,
      ROUND(AVG(rating), 2) AS average,
      SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS s1,
      SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS s2,
      SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS s3,
      SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS s4,
      SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS s5
    FROM ratings WHERE bot_id = ?
  `),
  getRatingsList: db.prepare(`
    SELECT id, rating, comment, user_msg, bot_msg, created_at
    FROM ratings WHERE bot_id = ?
    ORDER BY created_at DESC LIMIT 100
  `),
  getAllRatingsStats: db.prepare(`
    SELECT
      bot_id,
      COUNT(*) AS total,
      ROUND(AVG(rating), 2) AS average
    FROM ratings GROUP BY bot_id
  `),
}

function runBackup() {
  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true })
    const dest = path.join(BACKUP_DIR, `chatsphere-${new Date().toISOString().slice(0, 10)}.db`)
    db.backup(dest)
      .then(() => console.log(`Backup créé : ${dest}`))
      .catch(err => console.error('Backup échoué :', err.message))

    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.db'))
      .sort()
    if (files.length > 7) {
      files.slice(0, files.length - 7).forEach(f => {
        fs.unlinkSync(path.join(BACKUP_DIR, f))
        console.log(`Ancien backup supprimé : ${f}`)
      })
    }
  } catch (err) {
    console.error('Erreur backup :', err.message)
  }
}

runBackup()
setInterval(runBackup, 24 * 60 * 60 * 1000)

async function openrouterChat(messages, model, apiKey, stream, onChunk) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.PUBLIC_URL || 'http://localhost:3001',
      'X-Title': 'ClientFlow'
    },
    body: JSON.stringify({ model, messages, stream })
  })
  if (!stream) {
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    return data.choices[0].message.content
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let full = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '))
    for (const line of lines) {
      const json = line.slice(6)
      if (json === '[DONE]') continue
      try {
        const delta = JSON.parse(json).choices[0].delta.content || ''
        full += delta
        onChunk(delta)
      } catch {}
    }
  }
  return full
}

function buildMessages(config, userMessage, history = [], pageContext = '') {
  let fullSystem = config.systemPrompt || ''
  if (config.knowledgeBase)
    fullSystem += `\n\n---BASE DE CONNAISSANCES---\n${config.knowledgeBase}`
  if (pageContext && typeof pageContext === 'string' && pageContext.trim()) {
    fullSystem += `\n\n---CONTENU DE LA PAGE ACTUELLE---\n${pageContext.slice(0, 5000).trim()}\n---FIN DU CONTENU---\n\nUtilise ces informations pour répondre aux questions de l'utilisateur sur cette page.`
  }
  return [
    { role: 'system', content: fullSystem },
    ...history.slice(-MAX_HISTORY_TURNS * 2),
    { role: 'user', content: userMessage }
  ]
}

function requireAdmin(req, res, next) {
  const auth = req.headers['authorization'] || ''
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
  if (!token || token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Non autorisé — token admin requis' })
  }
  next()
}

const publicCors = cors()
const adminCors = cors({
  origin: DASHBOARD_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
})

app.use(express.json({ limit: MAX_PAYLOAD_BYTES }))

app.use('/widget', express.static(path.join(__dirname, '../widget')))

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de requêtes — réessayez dans quelques minutes' },
})

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Trop de messages — attendez une minute' },
})

const wsRateMap = new Map()
const WS_MAX_PER_MIN = 30

function wsAllowed(ip) {
  const now = Date.now()
  let entry = wsRateMap.get(ip)
  if (!entry || now > entry.resetAt) {
    entry = { count: 0, resetAt: now + 60_000 }
    wsRateMap.set(ip, entry)
  }
  entry.count++
  return entry.count <= WS_MAX_PER_MIN
}

setInterval(() => {
  const now = Date.now()
  for (const [ip, entry] of wsRateMap.entries()) {
    if (now > entry.resetAt) wsRateMap.delete(ip)
  }
}, 5 * 60_000)

app.get('/api/config/:botId', publicCors, (req, res) => {
  const row = stmt.getBot.get(req.params.botId)
  if (!row) return res.status(404).json({ error: 'Bot not found' })
  res.json(sanitizeConfig(rowToConfig(row)))
})

app.post('/api/config', adminCors, adminLimiter, requireAdmin, (req, res) => {
  const { name, systemPrompt, knowledgeBase, color, welcomeMessage, model, provider, openrouterKey } = req.body
  if (!name || !systemPrompt) return res.status(400).json({ error: 'name et systemPrompt requis' })

  const botId = Date.now().toString(36)
  try {
    stmt.insertBot.run({
      botId,
      name,
      systemPrompt: systemPrompt || '',
      knowledgeBase: knowledgeBase || '',
      color: color || '#00A8CC',
      welcomeMessage: welcomeMessage || 'Bonjour ! Comment puis-je vous aider ?',
      model: model || 'llama3',
      provider: provider || 'ollama',
      openrouterKey: openrouterKey || '',
    })
  } catch (err) {
    return res.status(500).json({ error: 'Erreur base de données : ' + err.message })
  }

  const created = rowToConfig(stmt.getBot.get(botId))
  res.json(sanitizeConfig(created))
})

app.put('/api/config/:botId', adminCors, adminLimiter, requireAdmin, (req, res) => {
  const existing = rowToConfig(stmt.getBot.get(req.params.botId))
  if (!existing) return res.status(404).json({ error: 'Bot not found' })

  // Fusion : on garde les valeurs existantes pour les champs non fournis
  const merged = { ...existing, ...req.body, botId: req.params.botId }

  try {
    stmt.updateBot.run({
      botId: merged.botId,
      name: merged.name,
      systemPrompt: merged.systemPrompt || '',
      knowledgeBase: merged.knowledgeBase || '',
      color: merged.color || '#00A8CC',
      welcomeMessage: merged.welcomeMessage || 'Bonjour ! Comment puis-je vous aider ?',
      model: merged.model || 'llama3',
      provider: merged.provider || 'ollama',
      openrouterKey: merged.openrouterKey || '',
    })
  } catch (err) {
    return res.status(500).json({ error: 'Erreur base de données : ' + err.message })
  }

  res.json(sanitizeConfig(rowToConfig(stmt.getBot.get(req.params.botId))))
})

app.delete('/api/config/:botId', adminCors, adminLimiter, requireAdmin, (req, res) => {
  const existing = stmt.getBot.get(req.params.botId)
  if (!existing) return res.status(404).json({ error: 'Bot not found' })
  stmt.deleteBot.run(req.params.botId)
  res.json({ success: true })
})

app.get('/api/configs', adminCors, adminLimiter, requireAdmin, (req, res) => {
  const rows = stmt.getAllBots.all()
  const result = {}
  for (const row of rows) {
    const cfg = rowToConfig(row)
    result[cfg.botId] = sanitizeConfig(cfg)
  }
  res.json(result)
})

app.get('/api/models', adminCors, adminLimiter, requireAdmin, async (req, res) => {
  try {
    const { models } = await ollama.list()
    res.json(models.map(m => m.name))
  } catch (err) {
    res.status(500).json({ error: 'Ollama non accessible : ' + err.message })
  }
})

// ── Ratings endpoints ─────────────────────────────────────────────────────

// POST /api/rating  — soumis publiquement depuis le widget (en fin de chat)
app.post('/api/rating', publicCors, chatLimiter, (req, res) => {
  const { botId, rating, comment = '', userMsg = '', botMsg = '' } = req.body
  const r = Number(rating)
  if (!botId || !Number.isInteger(r) || r < 1 || r > 5) {
    return res.status(400).json({ error: 'botId et rating (entier entre 1 et 5) requis' })
  }
  if (Buffer.byteLength(String(comment) + userMsg + botMsg, 'utf8') > MAX_MESSAGE_BYTES * 2) {
    return res.status(413).json({ error: 'Contenu trop long' })
  }
  try {
    stmt.insertRating.run({
      botId,
      rating: r,
      comment: String(comment).slice(0, 1000),
      userMsg: String(userMsg).slice(0, 500),
      botMsg: String(botMsg).slice(0, 500),
    })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/ratings/:botId/stats  — stats d'un bot (admin)
app.get('/api/ratings/:botId/stats', adminCors, adminLimiter, requireAdmin, (req, res) => {
  const stats = stmt.getRatingStats.get(req.params.botId)
  res.json(stats || { total: 0, positive: 0, negative: 0 })
})

// GET /api/ratings/:botId  — liste des évaluations d'un bot (admin)
app.get('/api/ratings/:botId', adminCors, adminLimiter, requireAdmin, (req, res) => {
  const list = stmt.getRatingsList.all(req.params.botId)
  res.json(list)
})

// GET /api/ratings  — stats globales de tous les bots (admin)
app.get('/api/ratings', adminCors, adminLimiter, requireAdmin, (req, res) => {
  const rows = stmt.getAllRatingsStats.all()
  res.json(rows)
})

app.get('/api/openrouter/models', adminCors, adminLimiter, requireAdmin, async (req, res) => {
  const apiKey = req.headers['x-openrouter-key']
  if (!apiKey) return res.status(400).json({ error: 'Clé API manquante' })
  try {
    const r = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    })
    const data = await r.json()
    let models = data.data
    if (req.query.free === 'true') {
      models = models.filter(m => m.pricing?.prompt === '0' && m.pricing?.completion === '0')
    }
    res.json(models.map(m => ({ id: m.id, name: m.name })))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/warmup/:botId  — pré-charge le modèle Ollama en mémoire (1 seul token)
app.post('/api/warmup/:botId', publicCors, chatLimiter, async (req, res) => {
  const row = stmt.getBot.get(req.params.botId)
  const config = row ? rowToConfig(row) : { model: 'llama3', provider: 'ollama' }
  if (config.provider !== 'ollama') return res.json({ ok: true, skipped: true })

  try {
    await ollama.chat({
      model: config.model,
      messages: [{ role: 'user', content: '.' }],
      options: { num_predict: 1 },
    })
    res.json({ ok: true })
  } catch (err) {
    res.json({ ok: false, error: err.message })
  }
})

app.post('/api/chat', publicCors, chatLimiter, async (req, res) => {
  const { message, botId, history = [], pageContext = '' } = req.body

  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message requis' })
  if (Buffer.byteLength(message, 'utf8') > MAX_MESSAGE_BYTES) {
    return res.status(413).json({ error: 'Message trop long (max 8 Ko)' })
  }

  const row = stmt.getBot.get(botId)
  const config = row ? rowToConfig(row) : { systemPrompt: 'You are a helpful assistant.', model: 'llama3', provider: 'ollama', knowledgeBase: '' }
  const messages = buildMessages(config, message, history, pageContext)

  try {
    if (config.provider === 'openrouter') {
      const reply = await openrouterChat(messages, config.model, config.openrouterKey, false)
      res.json({ reply })
    } else {
      const response = await ollama.chat({ model: config.model, messages })
      res.json({ reply: response.message.content })
    }
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Keepalive : ping toutes les 25 s pour éviter que les proxies ferment les WS inactifs
const WS_PING_INTERVAL = 25000
setInterval(() => {
  wss.clients.forEach(client => {
    if (client.readyState === client.OPEN) {
      client.ping()
    }
  })
}, WS_PING_INTERVAL)

wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress || 'unknown'
  ws.isAlive = true
  ws.on('pong', () => { ws.isAlive = true })

  ws.on('message', async (raw) => {
    if (raw.length > MAX_WS_PAYLOAD) {
      ws.send(JSON.stringify({ type: 'error', message: 'Payload trop volumineux (max 14 Ko)' }))
      return
    }

    if (!wsAllowed(ip)) {
      ws.send(JSON.stringify({ type: 'error', message: 'Trop de messages — attendez une minute' }))
      return
    }

    let data
    try { data = JSON.parse(raw) } catch { return }
    if (data.type === 'ping') { ws.send(JSON.stringify({ type: 'pong' })); return }
    if (data.type !== 'chat') return

    if (!data.message || typeof data.message !== 'string') return
    if (Buffer.byteLength(data.message, 'utf8') > MAX_MESSAGE_BYTES) {
      ws.send(JSON.stringify({ type: 'error', message: 'Message trop long (max 8 Ko)' }))
      return
    }

    const row = stmt.getBot.get(data.botId)
    const config = row ? rowToConfig(row) : { systemPrompt: 'You are a helpful assistant.', model: 'llama3', provider: 'ollama', knowledgeBase: '' }
    const messages = buildMessages(config, data.message, data.history || [], data.pageContext || '')

    try {
      if (config.provider === 'openrouter') {
        await openrouterChat(messages, config.model, config.openrouterKey, true, (delta) => {
          if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'chunk', text: delta }))
        })
      } else {
        const stream = await ollama.chat({ model: config.model, messages, stream: true })
        for await (const chunk of stream) {
          if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'chunk', text: chunk.message.content }))
          }
        }
      }
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'done' }))
    } catch (err) {
      if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'error', message: err.message }))
    }
  })
})

process.on('SIGINT', () => { db.close(); process.exit(0) })
process.on('SIGTERM', () => { db.close(); process.exit(0) })

const PORT = process.env.PORT || 3001
server.listen(PORT, '0.0.0.0', () => {
  console.log(`ClientFlow backend running on http://localhost:${PORT}`)

  // Warmup au démarrage : pré-charge le premier modèle configuré en mémoire
  const firstBot = stmt.getAllBots.get()
  if (firstBot) {
    const cfg = rowToConfig(firstBot)
    if (cfg.provider === 'ollama') {
      console.log(`Warmup: chargement du modèle ${cfg.model}…`)
      ollama.chat({
        model: cfg.model,
        messages: [{ role: 'user', content: '.' }],
        options: { num_predict: 1 },
      })
        .then(() => console.log(`Warmup: modèle ${cfg.model} prêt`))
        .catch(err => console.warn(`Warmup: échec (${err.message}) — le modèle sera chargé au premier message`))
    }
  }
})
