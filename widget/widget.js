;(function () {
  // ── Config depuis la balise <script> ──────────────────────────────────────
  // <script src="http://localhost:3001/widget/widget.js"
  //         data-bot-id="abc123"
  //         data-server="http://localhost:3001"></script>
  const scriptTag = document.currentScript
  const BOT_ID    = scriptTag?.getAttribute('data-bot-id') || 'default'
  const SERVER    = (scriptTag?.getAttribute('data-server') || 'http://localhost:3001').replace(/\/$/, '')
  const WS_SERVER = SERVER.replace(/^http/, 'ws')

  const LS_KEY = `cs_history_${BOT_ID}`
  const MAX_STORED_MESSAGES = 40

  function extractPageContent() {
    try {
      const title = document.title || ''
      const metaDesc = document.querySelector('meta[name="description"]')?.content || ''

      const IGNORE = new Set(['SCRIPT','STYLE','NOSCRIPT','SVG','BUTTON','INPUT','TEXTAREA','IFRAME'])
      const csRoot = ['cs-bubble','cs-window']

      function walk(node, parts) {
        if (node.nodeType === Node.TEXT_NODE) {
          const t = node.textContent.trim()
          if (t.length > 1) parts.push(t)
          return
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return
        if (IGNORE.has(node.tagName)) return
        if (csRoot.some(id => node.id === id || node.closest?.('#' + id))) return
        for (const child of node.childNodes) walk(child, parts)
      }

      const parts = []
      walk(document.body, parts)
      const body = parts.join(' ').replace(/\s+/g, ' ').trim()

      const raw = [
        title       ? `Titre de la page : ${title}` : '',
        metaDesc    ? `Description : ${metaDesc}`   : '',
        body        ? `Contenu : ${body}`            : '',
      ].filter(Boolean).join('\n')

      return raw.slice(0, 6000)
    } catch {
      return ''
    }
  }

  let botConfig = { color: '#00A8CC', welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?', name: 'ClientFlow' }

  function loadConfig() {
    fetch(`${SERVER}/api/config/${BOT_ID}`)
      .then(r => r.json())
      .then(cfg => {
        const colorChanged = cfg.color !== botConfig.color
        const nameChanged  = cfg.name  !== botConfig.name
        botConfig = cfg
        if (colorChanged) applyColor(cfg.color)
        if (nameChanged) {
          const nameEl = document.getElementById('cs-header-name')
          if (nameEl) nameEl.textContent = cfg.name || 'ClientFlow'
        }
        if (document.getElementById('cs-messages').children.length === 0) {
          renderHistory()
        }
      })
      .catch(() => {})
  }

  loadConfig()
  const configPollInterval = setInterval(loadConfig, 10000)

  // Warmup silencieux : demande au backend de pré-charger le modèle
  setTimeout(() => {
    fetch(`${SERVER}/api/warmup/${BOT_ID}`, { method: 'POST' }).catch(() => {})
  }, 1500)

  const style = document.createElement('style')
  style.textContent = `
    #cs-bubble {
      position:fixed; bottom:24px; right:24px; width:56px; height:56px;
      border-radius:50%; background:var(--cs-color,#00A8CC); cursor:pointer;
      display:flex; align-items:center; justify-content:center;
      box-shadow:0 4px 16px rgba(0,0,0,.3); z-index:99999; border:none;
      transition: transform .2s;
    }
    #cs-bubble:hover { transform: scale(1.1); }
    #cs-bubble svg { width:28px; height:28px; fill:white; }

    #cs-window {
      position:fixed; bottom:92px; right:24px; width:360px; height:520px;
      background:#0A1628; border-radius:16px; display:flex; flex-direction:column;
      box-shadow:0 8px 32px rgba(0,0,0,.5); z-index:99999; overflow:hidden;
      font-family:system-ui,sans-serif; transition: opacity .2s, transform .2s;
      opacity:0; transform:translateY(16px) scale(.97); pointer-events:none;
    }
    #cs-window.cs-open { opacity:1; transform:translateY(0) scale(1); pointer-events:all; }

    #cs-header {
      background:#0D2137; padding:14px 16px; display:flex;
      align-items:center; gap:10px; flex-shrink:0;
    }
    #cs-header-dot {
      width:10px; height:10px; border-radius:50%;
      background:var(--cs-color,#00A8CC); flex-shrink:0;
    }
    #cs-header-name { color:#fff; font-weight:600; font-size:15px; flex:1; }
    #cs-header-right { display:flex; align-items:center; gap:8px; }
    #cs-clear {
      background:none; border:none; color:#4A6080; cursor:pointer;
      font-size:11px; padding:3px 7px; border-radius:5px;
      transition:color .15s;
    }
    #cs-clear:hover { color:#8899A6; }
    #cs-close {
      background:none; border:none; color:#8899A6; cursor:pointer;
      font-size:20px; line-height:1; padding:0;
    }

    #cs-messages {
      flex:1; overflow-y:auto; padding:16px; display:flex;
      flex-direction:column; gap:10px;
    }
    #cs-messages::-webkit-scrollbar { width:4px; }
    #cs-messages::-webkit-scrollbar-thumb { background:#1C3A5E; border-radius:2px; }

    .cs-msg {
      max-width:80%; padding:10px 14px; border-radius:12px;
      font-size:14px; line-height:1.6; word-break:break-word;
    }
    .cs-msg.cs-bot {
      background:#132237; color:#E8EEF4; align-self:flex-start;
      border-bottom-left-radius:4px;
    }
    .cs-msg.cs-user {
      background:var(--cs-color,#00A8CC); color:#fff;
      align-self:flex-end; border-bottom-right-radius:4px;
    }

    .cs-msg.cs-bot strong { font-weight:700; }
    .cs-msg.cs-bot em { font-style:italic; }
    .cs-msg.cs-bot code {
      background:rgba(0,168,204,0.12); border-radius:4px;
      padding:1px 5px; font-family:monospace; font-size:12px;
    }
    .cs-msg.cs-bot pre {
      background:rgba(0,0,0,0.3); border-radius:8px; padding:10px 12px;
      overflow-x:auto; margin:6px 0;
    }
    .cs-msg.cs-bot pre code {
      background:none; padding:0; font-size:12px; line-height:1.5;
    }
    .cs-msg.cs-bot ul, .cs-msg.cs-bot ol {
      padding-left:18px; margin:4px 0;
    }
    .cs-msg.cs-bot li { margin:2px 0; }
    .cs-msg.cs-bot a { color:var(--cs-color,#00A8CC); }
    .cs-msg.cs-bot hr { border:none; border-top:1px solid rgba(255,255,255,0.1); margin:8px 0; }

    /* Bouton "Évaluer" dans le header */
    #cs-rate {
      background:none; border:1px solid rgba(0,168,204,0.3);
      color:var(--cs-color,#00A8CC); cursor:pointer;
      font-size:11px; padding:4px 10px; border-radius:6px;
      transition:all .15s; font-weight:500;
    }
    #cs-rate:hover { background:rgba(0,168,204,0.1); }

    /* Modale d'évaluation */
    #cs-rating-modal {
      position:absolute; inset:0; background:rgba(6,13,26,0.85);
      display:none; align-items:center; justify-content:center;
      z-index:10; backdrop-filter:blur(4px);
    }
    #cs-rating-modal.cs-visible { display:flex; }
    .cs-rating-card {
      background:#0D2137; border:1px solid rgba(255,255,255,0.08);
      border-radius:14px; padding:22px 20px; width:88%; max-width:320px;
      box-shadow:0 8px 32px rgba(0,0,0,.4);
    }
    .cs-rating-title {
      color:#fff; font-size:15px; font-weight:600; margin:0 0 4px 0;
    }
    .cs-rating-subtitle {
      color:#8899A6; font-size:12px; margin:0 0 16px 0;
    }
    .cs-stars {
      display:flex; justify-content:center; gap:6px; margin-bottom:16px;
    }
    .cs-star {
      background:none; border:none; cursor:pointer; padding:2px;
      font-size:30px; color:#2a3f5c; transition:transform .1s, color .15s;
      line-height:1;
    }
    .cs-star:hover { transform:scale(1.15); }
    .cs-star.cs-active { color:#FFC857; }
    .cs-rating-textarea {
      width:100%; box-sizing:border-box;
      background:#132237; border:1px solid #1C3A5E; border-radius:8px;
      color:#fff; padding:8px 10px; font-size:13px; outline:none;
      font-family:inherit; resize:none; min-height:60px; margin-bottom:14px;
    }
    .cs-rating-textarea::placeholder { color:#4A6080; }
    .cs-rating-actions {
      display:flex; gap:8px; justify-content:flex-end;
    }
    .cs-rating-actions button {
      padding:7px 14px; border-radius:7px; cursor:pointer;
      font-size:12px; font-weight:500; transition:all .15s;
      border:1px solid transparent;
    }
    #cs-rating-cancel {
      background:transparent; border-color:rgba(255,255,255,0.1); color:#8899A6;
    }
    #cs-rating-cancel:hover { color:#fff; }
    #cs-rating-submit {
      background:var(--cs-color,#00A8CC); border:none; color:#fff;
    }
    #cs-rating-submit:disabled { opacity:.4; cursor:not-allowed; }
    #cs-rating-thanks {
      text-align:center; padding:8px 0; color:#00C896; font-size:14px;
    }

    .cs-typing {
      background:#132237; align-self:flex-start;
      border-bottom-left-radius:4px; padding:12px 16px; border-radius:12px;
      display:flex; align-items:center; gap:5px;
    }
    .cs-typing span {
      width:8px; height:8px; border-radius:50%;
      background:#8899A6 !important; display:inline-block !important;
      animation: cs-bounce 1.2s infinite ease-in-out !important;
      flex-shrink:0;
    }
    .cs-typing span:nth-child(1) { animation-delay: 0s !important; }
    .cs-typing span:nth-child(2) { animation-delay: 0.2s !important; }
    .cs-typing span:nth-child(3) { animation-delay: 0.4s !important; }
    @keyframes cs-bounce {
      0%, 60%, 100% { transform: translateY(0); opacity:.5; }
      30%           { transform: translateY(-6px); opacity:1; }
    }

    #cs-reconnect-banner {
      background:rgba(255,180,0,0.12); border-top:1px solid rgba(255,180,0,0.2);
      color:#f0b429; font-size:11px; text-align:center; padding:5px 12px;
      flex-shrink:0; display:none;
    }
    #cs-reconnect-banner.cs-visible { display:block; }

    #cs-input-row { display:flex; gap:8px; padding:12px; background:#0D2137; flex-shrink:0; }
    #cs-input {
      flex:1; background:#132237; border:1px solid #1C3A5E; border-radius:8px;
      color:#fff; padding:10px 12px; font-size:14px; outline:none;
      font-family:inherit; resize:none; max-height:100px;
    }
    #cs-input::placeholder { color:#8899A6; }
    #cs-send {
      background:var(--cs-color,#00A8CC); border:none; border-radius:8px;
      color:#fff; padding:10px 14px; cursor:pointer; font-size:18px;
      display:flex; align-items:center; justify-content:center;
      flex-shrink:0;
    }
    #cs-send:disabled { opacity:.5; cursor:not-allowed; }
  `
  document.head.appendChild(style)

  const bubble = document.createElement('button')
  bubble.id = 'cs-bubble'
  bubble.setAttribute('aria-label', 'Ouvrir le chat')
  bubble.innerHTML = `<svg viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg>`
  bubble.style.background = botConfig.color

  const win = document.createElement('div')
  win.id = 'cs-window'
  win.setAttribute('role', 'dialog')
  win.setAttribute('aria-label', 'Chatbot')
  win.innerHTML = `
    <div id="cs-header">
      <div id="cs-header-dot"></div>
      <span id="cs-header-name">ClientFlow</span>
      <div id="cs-header-right">
        <button id="cs-rate" title="Évaluer la conversation">★ Évaluer</button>
        <button id="cs-clear" title="Effacer la conversation">Effacer</button>
        <button id="cs-close" aria-label="Fermer">✕</button>
      </div>
    </div>
    <div id="cs-messages" role="log" aria-live="polite"></div>
    <div id="cs-reconnect-banner">Reconnexion en cours…</div>
    <div id="cs-input-row">
      <textarea id="cs-input" rows="1" placeholder="Écrivez votre message…" aria-label="Message"></textarea>
      <button id="cs-send" aria-label="Envoyer">➤</button>
    </div>
    <div id="cs-rating-modal" role="dialog" aria-label="Évaluer la conversation">
      <div class="cs-rating-card">
        <div id="cs-rating-form">
          <h3 class="cs-rating-title">Comment s'est passé ce chat ?</h3>
          <p class="cs-rating-subtitle">Votre avis nous aide à améliorer l'assistant.</p>
          <div class="cs-stars" role="radiogroup" aria-label="Note">
            ${[1,2,3,4,5].map(n => `<button type="button" class="cs-star" data-value="${n}" aria-label="${n} étoile${n>1?'s':''}">★</button>`).join('')}
          </div>
          <textarea id="cs-rating-comment" class="cs-rating-textarea" rows="3" placeholder="Un commentaire ? (facultatif)" maxlength="1000"></textarea>
          <div class="cs-rating-actions">
            <button id="cs-rating-cancel" type="button">Annuler</button>
            <button id="cs-rating-submit" type="button" disabled>Envoyer</button>
          </div>
        </div>
        <div id="cs-rating-thanks" style="display:none">✓ Merci pour votre retour !</div>
      </div>
    </div>
  `

  document.body.appendChild(bubble)
  document.body.appendChild(win)

  const msgContainer      = document.getElementById('cs-messages')
  const inputEl           = document.getElementById('cs-input')
  const sendBtn           = document.getElementById('cs-send')
  const reconnectBanner   = document.getElementById('cs-reconnect-banner')
  const headerDot         = document.getElementById('cs-header-dot')

  function mdToHtml(text) {
    text = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code>${escHtml(code.trim())}</code></pre>`)
    text = text.replace(/`([^`]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>')
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener">$1</a>')
    text = text.replace(/^---+$/gm, '<hr>')
    text = text.replace(/^[ \t]*[-*]\s+(.+)$/gm, '<li>$1</li>')
    text = text.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    text = text.replace(/^[ \t]*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    text = text.replace(/\n(?!<\/?(pre|ul|ol|li|hr))/g, '<br>')
    return text
  }

  function escHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  function applyColor(color) {
    document.documentElement.style.setProperty('--cs-color', color)
    bubble.style.background  = color
    sendBtn.style.background = color
    headerDot.style.background = color
  }

  function loadStoredMessages() {
    try {
      const raw = localStorage.getItem(LS_KEY)
      return raw ? JSON.parse(raw) : []
    } catch { return [] }
  }

  function saveStoredMessages(msgs) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(msgs.slice(-MAX_STORED_MESSAGES))) } catch {}
  }

  function clearStoredMessages() {
    try { localStorage.removeItem(LS_KEY) } catch {}
  }

  let storedMessages = loadStoredMessages()
  let history = storedMessages
    .map(m => ({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.content }))

  function renderMessage(role, content) {
    const div = document.createElement('div')
    div.className = `cs-msg cs-${role}`
    if (role === 'bot') {
      div.innerHTML = mdToHtml(content)
    } else {
      div.textContent = content
    }
    msgContainer.appendChild(div)
    msgContainer.scrollTop = msgContainer.scrollHeight
    return div
  }

  function renderHistory() {
    msgContainer.innerHTML = ''
    if (storedMessages.length === 0) {
      const welcome = botConfig.welcomeMessage
      renderMessage('bot', welcome)
      storedMessages = [{ role: 'bot', content: welcome }]
      saveStoredMessages(storedMessages)
    } else {
      storedMessages.forEach(m => renderMessage(m.role, m.content))
    }
  }

  renderHistory()

  document.getElementById('cs-clear').addEventListener('click', () => {
    storedMessages = []
    history = []
    clearStoredMessages()
    msgContainer.innerHTML = ''
    const welcome = botConfig.welcomeMessage
    renderMessage('bot', welcome)
    storedMessages = [{ role: 'bot', content: welcome }]
    saveStoredMessages(storedMessages)
  })

  // Pré-connexion WS silencieuse au chargement de la page pour éliminer
  // le délai de handshake lors du premier message
  setTimeout(() => connectWS(), 800)

  let isOpen = false
  bubble.addEventListener('click', () => {
    isOpen = !isOpen
    win.classList.toggle('cs-open', isOpen)
    bubble.setAttribute('aria-expanded', isOpen)
    if (isOpen) {
      inputEl.focus()
      // S'assure que le WS est prêt si la pré-connexion a échoué
      connectWS()
    }
  })
  document.getElementById('cs-close').addEventListener('click', () => {
    isOpen = false
    win.classList.remove('cs-open')
    bubble.setAttribute('aria-expanded', 'false')
  })

  let ws             = null
  let wsRetryCount   = 0
  let wsRetryTimer   = null
  let isSending      = false
  let currentBotDiv  = null
  let currentBotText = ''
  let pendingPayload = null

  const WS_BASE_DELAY = 500
  const WS_MAX_DELAY  = 16000
  const WS_MAX_RETRY  = 10

  function showReconnectBanner(visible) {
    reconnectBanner.classList.toggle('cs-visible', visible)
  }

  function connectWS(onReady) {
    if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) {
      if (onReady) onReady()
      return
    }

    ws = new WebSocket(WS_SERVER)

    ws.onopen = () => {
      wsRetryCount = 0
      showReconnectBanner(false)
      // Heartbeat côté client : envoie un ping toutes les 20 s pour garder la connexion active
      if (ws._pingTimer) clearInterval(ws._pingTimer)
      ws._pingTimer = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }))
        }
      }, 20000)
      if (onReady) onReady()
    }

    ws.onmessage = (e) => {
      let data
      try { data = JSON.parse(e.data) } catch { return }

      if (data.type === 'pong') return  // réponse au heartbeat, rien à faire

      if (data.type === 'chunk') {
        if (currentBotDiv) {
          currentBotText += data.text
          currentBotDiv.innerHTML = mdToHtml(currentBotText)
          msgContainer.scrollTop = msgContainer.scrollHeight
        }
      } else if (data.type === 'done') {
        if (currentBotDiv) {
          // Sauvegarde finale dans l'historique
          storedMessages.push({ role: 'bot', content: currentBotText })
          saveStoredMessages(storedMessages)
          history.push({ role: 'assistant', content: currentBotText })
        }
        currentBotDiv = null
        currentBotText = ''
        unlockInput()
      } else if (data.type === 'error') {
        if (currentBotDiv) {
          currentBotDiv.innerHTML = `<em style="color:#ff8080">⚠ ${escHtml(data.message)}</em>`
        }
        unlockInput()
      }
    }

    ws.onclose = () => {
      if (ws && ws._pingTimer) clearInterval(ws._pingTimer)
      ws = null
      if (isSending) scheduleReconnect()
    }

    ws.onerror = () => {}
  }

  function scheduleReconnect() {
    if (wsRetryCount >= WS_MAX_RETRY) {
      showReconnectBanner(false)
      if (currentBotDiv) {
        currentBotDiv.innerHTML = '<em style="color:#ff8080">⚠ Connexion impossible — réessayez plus tard</em>'
      }
      unlockInput()
      return
    }

    const delay = Math.min(WS_BASE_DELAY * Math.pow(2, wsRetryCount), WS_MAX_DELAY)
      + Math.random() * 300
    wsRetryCount++
    showReconnectBanner(true)

    clearTimeout(wsRetryTimer)
    wsRetryTimer = setTimeout(() => {
      connectWS(() => {
        if (pendingPayload && isSending) {
          ws.send(pendingPayload)
          pendingPayload = null
        }
      })
    }, delay)
  }

  function unlockInput() {
    isSending = false
    sendBtn.disabled = false
    inputEl.disabled = false
    inputEl.focus()
  }

  function sendMessage() {
    const msg = inputEl.value.trim()
    if (!msg || isSending) return

    isSending = true
    inputEl.value = ''
    inputEl.style.height = 'auto'
    sendBtn.disabled = true
    inputEl.disabled = true

    renderMessage('user', msg)
    storedMessages.push({ role: 'user', content: msg })
    saveStoredMessages(storedMessages)
    history.push({ role: 'user', content: msg })

    const typingEl = document.createElement('div')
    typingEl.className = 'cs-typing'
    typingEl.innerHTML = '<span></span><span></span><span></span>'
    msgContainer.appendChild(typingEl)
    msgContainer.scrollTop = msgContainer.scrollHeight

    currentBotDiv = document.createElement('div')
    currentBotDiv.className = 'cs-msg cs-bot'
    currentBotText = ''

    pendingPayload = JSON.stringify({
      type: 'chat',
      botId: BOT_ID,
      message: msg,
      history: history.slice(0, -1),
      pageContext: extractPageContent()
    })

    const afterConnect = () => {
      typingEl.replaceWith(currentBotDiv)
      ws.send(pendingPayload)
      pendingPayload = null
    }

    if (ws && ws.readyState === WebSocket.OPEN) {
      afterConnect()
    } else {
      connectWS(afterConnect)
    }
  }

  sendBtn.addEventListener('click', sendMessage)
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  })

  inputEl.addEventListener('input', function () {
    this.style.height = 'auto'
    this.style.height = Math.min(this.scrollHeight, 100) + 'px'
  })

  // ── Modale d'évaluation ──────────────────────────────────────────────────
  const ratingModal   = document.getElementById('cs-rating-modal')
  const ratingForm    = document.getElementById('cs-rating-form')
  const ratingThanks  = document.getElementById('cs-rating-thanks')
  const ratingComment = document.getElementById('cs-rating-comment')
  const submitBtn     = document.getElementById('cs-rating-submit')
  const cancelBtn     = document.getElementById('cs-rating-cancel')
  const rateBtn       = document.getElementById('cs-rate')
  const starBtns      = ratingModal.querySelectorAll('.cs-star')

  let selectedStars = 0

  function setStars(n) {
    selectedStars = n
    starBtns.forEach((btn, i) => btn.classList.toggle('cs-active', i < n))
    submitBtn.disabled = (n === 0)
  }

  // Survol : prévisualisation
  starBtns.forEach((btn, i) => {
    btn.addEventListener('mouseenter', () => {
      starBtns.forEach((b, j) => b.classList.toggle('cs-active', j <= i))
    })
    btn.addEventListener('mouseleave', () => setStars(selectedStars))
    btn.addEventListener('click', () => setStars(Number(btn.dataset.value)))
  })

  function openRatingModal() {
    // Réinitialise la modale
    setStars(0)
    ratingComment.value = ''
    submitBtn.disabled = true
    ratingForm.style.display = ''
    ratingThanks.style.display = 'none'
    ratingModal.classList.add('cs-visible')
  }

  function closeRatingModal() {
    ratingModal.classList.remove('cs-visible')
  }

  rateBtn.addEventListener('click', () => {
    // N'ouvre que s'il y a au moins un échange (hors message de bienvenue)
    const hasExchange = storedMessages.some(m => m.role === 'user')
    if (!hasExchange) {
      rateBtn.textContent = '★ Chattez d\'abord !'
      setTimeout(() => { rateBtn.textContent = '★ Évaluer' }, 2000)
      return
    }
    openRatingModal()
  })

  cancelBtn.addEventListener('click', closeRatingModal)

  // Fermeture en cliquant hors de la carte
  ratingModal.addEventListener('click', (e) => {
    if (e.target === ratingModal) closeRatingModal()
  })

  submitBtn.addEventListener('click', async () => {
    if (selectedStars === 0) return

    const comment = ratingComment.value.trim()
    const lastUser = storedMessages.filter(m => m.role === 'user').slice(-1)[0]
    const lastBot  = storedMessages.filter(m => m.role === 'bot').slice(-1)[0]

    submitBtn.disabled = true
    submitBtn.textContent = '…'

    try {
      const res = await fetch(`${SERVER}/api/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          botId: BOT_ID,
          rating: selectedStars,
          comment,
          userMsg: lastUser ? lastUser.content : '',
          botMsg:  lastBot  ? lastBot.content  : '',
        })
      })
      if (!res.ok) {
        const errText = await res.text().catch(() => '')
        console.error('[ClientFlow] Erreur soumission avis:', res.status, errText)
      }
    } catch (err) {
      console.error('[ClientFlow] Erreur réseau soumission avis:', err)
    }

    ratingForm.style.display = 'none'
    ratingThanks.style.display = ''
    submitBtn.disabled = false
    submitBtn.textContent = 'Envoyer'
    setTimeout(closeRatingModal, 1800)
  })
})()
