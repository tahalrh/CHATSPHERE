import { useState, useEffect, useCallback } from 'react'

const API = `${import.meta.env.VITE_API_URL || ''}/api`

// ── Hook : toute la logique d'appels API admin ────────────────────────────
// Centralise fetch + headers auth + état des bots/modèles
export function useAdminApi(adminToken) {
  const [bots, setBots] = useState({})
  const [ollamaModels, setOllamaModels] = useState([])
  const [ollamaError, setOllamaError] = useState('')
  const [orModels, setOrModels] = useState([])
  const [orModelsLoading, setOrModelsLoading] = useState(false)

  const headers = { 'Authorization': `Bearer ${adminToken}` }

  // ── Fetch utilitaire avec auth ────────────────────────────────────────────
  const apiFetch = useCallback(async (url, options = {}) => {
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...options.headers },
    })
    return res
  }, [adminToken])

  // ── Chargement de la liste des bots ──────────────────────────────────────
  const fetchBots = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/configs`)
      if (res.status === 401) return { unauthorized: true }
      const data = await res.json()
      setBots(data)
      return data
    } catch {
      return {}
    }
  }, [apiFetch])

  // ── Chargement des modèles Ollama ─────────────────────────────────────────
  const fetchOllamaModels = useCallback(async () => {
    try {
      const res = await apiFetch(`${API}/models`)
      const data = await res.json()
      if (Array.isArray(data)) {
        setOllamaModels(data)
        setOllamaError('')
        return data
      } else {
        setOllamaError(data.error || 'Ollama non disponible')
        return []
      }
    } catch {
      setOllamaError('Ollama non disponible')
      return []
    }
  }, [apiFetch])

  // ── Chargement des modèles OpenRouter ────────────────────────────────────
  const fetchOrModels = useCallback(async (apiKey, freeOnly = true) => {
    if (!apiKey) return
    setOrModelsLoading(true)
    try {
      const res = await apiFetch(`${API}/openrouter/models?free=${freeOnly}`, {
        headers: { 'x-openrouter-key': apiKey },
      })
      const data = await res.json()
      if (Array.isArray(data)) setOrModels(data)
    } catch {}
    setOrModelsLoading(false)
  }, [apiFetch])

  // ── Sauvegarde d'un bot (création ou mise à jour) ─────────────────────────
  const saveBot = useCallback(async (form, selectedId) => {
    const method = selectedId ? 'PUT' : 'POST'
    const url = selectedId ? `${API}/config/${selectedId}` : `${API}/config`
    const res = await apiFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    if (res.status === 401) return { unauthorized: true }
    return res.json()
  }, [apiFetch])

  // ── Suppression d'un bot ──────────────────────────────────────────────────
  const deleteBot = useCallback(async (botId) => {
    const res = await apiFetch(`${API}/config/${botId}`, { method: 'DELETE' })
    if (res.status === 401) return { unauthorized: true }
    return res.json()
  }, [apiFetch])

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => {
    fetchBots()
    fetchOllamaModels()
  }, [])

  return {
    bots, setBots,
    ollamaModels, ollamaError,
    orModels, orModelsLoading,
    fetchBots, fetchOllamaModels, fetchOrModels,
    saveBot, deleteBot,
  }
}
