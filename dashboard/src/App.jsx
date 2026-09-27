import React, { useState, useEffect } from 'react'
import LoginScreen from './components/LoginScreen.jsx'
import Sidebar from './components/Sidebar.jsx'
import { IdentitySection, BehaviorSection, KnowledgeBaseSection, ModelSection } from './components/BotForm.jsx'
import EmbedSnippet from './components/EmbedSnippet.jsx'
import RatingsView from './components/RatingsView.jsx'
import { Icon } from './components/icons.jsx'
import { useAdminApi } from './hooks/useAdminApi.js'

const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001' // utilisé uniquement pour le snippet d'embed

const defaultForm = {
  name: '',
  systemPrompt: '',
  color: '#00A8CC',
  welcomeMessage: 'Bonjour ! Comment puis-je vous aider ?',
  model: '',
  provider: 'ollama',
  openrouterKey: '',
  knowledgeBase: '',
}

// ── App ───────────────────────────────────────────────────────────────────
export default function App() {
  const [adminToken, setAdminToken] = useState(
    () => sessionStorage.getItem('cs_admin_token') || ''
  )

  if (!adminToken) {
    return <LoginScreen onLogin={setAdminToken} />
  }

  return <Dashboard adminToken={adminToken} onLogout={() => {
    sessionStorage.removeItem('cs_admin_token')
    setAdminToken('')
  }} />
}

// ── Dashboard (monté seulement quand le token est valide) ─────────────────
function Dashboard({ adminToken, onLogout }) {
  const {
    bots, ollamaModels, ollamaError,
    orModels, orModelsLoading,
    fetchBots, fetchOrModels,
    saveBot, deleteBot,
  } = useAdminApi(adminToken)

  const [currentView, setCurrentView]   = useState('bots') // 'bots' | 'ratings'
  const [selectedId, setSelectedId]     = useState(null)
  const [form, setForm]                 = useState(defaultForm)
  const [kbHasError, setKbHasError]     = useState(false)
  const [savedMsg, setSavedMsg]         = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  // Sélectionne automatiquement le premier bot au chargement
  useEffect(() => {
    const ids = Object.keys(bots)
    if (!selectedId && ids.length > 0) {
      selectBot(ids[0])
    }
  }, [bots, selectedId])

  // Synchronise le modèle par défaut Ollama quand la liste est chargée
  useEffect(() => {
    if (ollamaModels.length > 0 && !form.model && form.provider === 'ollama') {
      setForm(f => ({ ...f, model: ollamaModels[0] }))
    }
  }, [ollamaModels])

  // ── Navigation ───────────────────────────────────────────────────────────
  function selectBot(id) {
    setCurrentView('bots')
    setSelectedId(id)
    setForm(bots[id])
    setSavedMsg('')
    setDeleteConfirm(null)
    if (bots[id]?.provider === 'openrouter' && bots[id]?.openrouterKey) {
      fetchOrModels(bots[id].openrouterKey)
    }
  }

  function newBot() {
    setCurrentView('bots')
    setSelectedId(null)
    setForm({ ...defaultForm, model: ollamaModels[0] || '' })
    setSavedMsg('')
    setDeleteConfirm(null)
  }

  // ── Mise à jour du formulaire ─────────────────────────────────────────────
  function handleChange(key, value, hasError = false) {
    if (key === 'knowledgeBase') setKbHasError(hasError)
    setForm(f => ({ ...f, [key]: value }))
  }

  // ── Sauvegarde ────────────────────────────────────────────────────────────
  async function handleSave() {
    if (kbHasError) return
    const data = await saveBot(form, selectedId)
    if (data.unauthorized) { onLogout(); return }
    if (data.botId) {
      setSelectedId(data.botId)
      setSavedMsg('Sauvegardé')
      fetchBots()
      setTimeout(() => setSavedMsg(''), 2500)
    }
  }

  // ── Suppression ───────────────────────────────────────────────────────────
  async function handleDelete(botId) {
    const data = await deleteBot(botId)
    if (data.unauthorized) { onLogout(); return }
    setDeleteConfirm(null)
    setSelectedId(null)
    setForm(defaultForm)
    fetchBots()
  }

  return (
    <div style={{
      display: 'flex', minHeight: '100vh',
      background: 'radial-gradient(ellipse at 20% 0%, #0d2137 0%, #060d1a 60%)',
    }}>
      <Sidebar
        bots={bots}
        selectedId={selectedId}
        onSelect={selectBot}
        onNew={newBot}
        onLogout={onLogout}
        currentView={currentView}
        onViewChange={setCurrentView}
      />

      <main style={{ flex: 1, padding: '36px 40px', overflowY: 'auto', maxWidth: currentView === 'ratings' ? 'none' : 760 }}>

        {currentView === 'ratings' ? (
          <>
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                Évaluations
              </h1>
              <p style={{ fontSize: 13, color: '#4A6080', marginTop: 4 }}>
                Retours des utilisateurs sur les réponses de vos bots IA
              </p>
            </div>
            <RatingsView bots={bots} adminToken={adminToken} />
          </>
        ) : (
          <>
            {/* En-tête */}
            <div style={{ marginBottom: 28 }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', letterSpacing: '-0.03em' }}>
                {selectedId ? `Configurer — ${form.name || '…'}` : 'Créer un nouveau bot'}
              </h1>
              <p style={{ fontSize: 13, color: '#4A6080', marginTop: 4 }}>
                {selectedId
                  ? `ID: ${selectedId}`
                  : 'Configurez votre assistant IA et intégrez-le en une ligne'}
              </p>
            </div>

            {/* Sections du formulaire */}
            <IdentitySection form={form} onChange={handleChange} />
            <BehaviorSection form={form} onChange={handleChange} />
            <KnowledgeBaseSection form={form} onChange={handleChange} />
            <ModelSection
              form={form}
              onChange={handleChange}
              ollamaModels={ollamaModels}
              ollamaError={ollamaError}
              fetchOrModels={fetchOrModels}
              orModels={orModels}
              orModelsLoading={orModelsLoading}
            />

            {/* Boutons Sauvegarder / Supprimer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <button
                onClick={handleSave}
                disabled={kbHasError}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 22px',
                  background: 'linear-gradient(135deg, #00A8CC, #0070a8)',
                  border: 'none', borderRadius: 9, color: '#fff', fontWeight: 600, fontSize: 14,
                  cursor: kbHasError ? 'not-allowed' : 'pointer',
                  opacity: kbHasError ? 0.5 : 1,
                  boxShadow: '0 4px 16px rgba(0,168,204,0.3)', transition: 'all .2s',
                }}
              >
                {Icon.save} Sauvegarder
              </button>

              {selectedId && (
                deleteConfirm === selectedId ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, color: '#ff8080' }}>Supprimer définitivement ?</span>
                    <button
                      onClick={() => handleDelete(selectedId)}
                      style={{
                        padding: '7px 14px',
                        background: 'rgba(255,60,60,0.15)',
                        border: '1px solid rgba(255,60,60,0.4)',
                        borderRadius: 8, color: '#ff6b6b', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      }}
                    >
                      Confirmer
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(null)}
                      style={{
                        padding: '7px 14px',
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 8, color: '#8899A6', fontSize: 12, cursor: 'pointer',
                      }}
                    >
                      Annuler
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteConfirm(selectedId)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '9px 16px',
                      background: 'rgba(255,107,107,0.08)',
                      border: '1px solid rgba(255,107,107,0.2)',
                      borderRadius: 9, color: '#ff8080', fontSize: 13, cursor: 'pointer', transition: 'all .2s',
                    }}
                  >
                    {Icon.trash} Supprimer
                  </button>
                )
              )}

              {savedMsg && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#00C896', fontSize: 13 }}>
                  {Icon.check} {savedMsg}
                </div>
              )}
            </div>

            {/* Snippet d'intégration */}
            <EmbedSnippet botId={selectedId} serverUrl={SERVER_URL} />
          </>
        )}
      </main>
    </div>
  )
}
