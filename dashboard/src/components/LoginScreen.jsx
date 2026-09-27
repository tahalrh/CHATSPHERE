import React, { useState } from 'react'
import { inputStyle } from './ui.jsx'
import { Icon } from './icons.jsx'

const API = `${import.meta.env.VITE_API_URL || ''}/api`

// ── Écran de connexion admin ───────────────────────────────────────────────
export default function LoginScreen({ onLogin }) {
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    if (!token.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API}/configs`, {
        headers: { 'Authorization': `Bearer ${token.trim()}` },
      })
      if (res.status === 401) {
        setError('Token incorrect — vérifiez votre fichier .env')
      } else if (!res.ok) {
        setError('Erreur serveur — le backend est-il démarré ?')
      } else {
        sessionStorage.setItem('cs_admin_token', token.trim())
        onLogin(token.trim())
      }
    } catch {
      setError(`Impossible de joindre le backend (${import.meta.env.VITE_API_URL || 'http://localhost:3001'}) — vérifiez que le backend est démarré`)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 20% 0%, #0d2137 0%, #060d1a 60%)',
    }}>
      <div style={{
        width: 380,
        background: 'rgba(13,33,55,0.8)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '36px 32px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #00A8CC, #0070a8)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 26, boxShadow: '0 0 24px #00A8CC44',
          }}>🤖</div>
          <div style={{ fontWeight: 700, fontSize: 20, color: '#fff', letterSpacing: '-0.02em' }}>
            ClientFlow
          </div>
          <div style={{ fontSize: 13, color: '#4A6080', marginTop: 4 }}>Accès administrateur</div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: 24, color: '#00A8CC' }}>
          {Icon.lock}
        </div>

        <form onSubmit={handleLogin}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: 12, color: '#6B7E94', marginBottom: 6, fontWeight: 500,
            }}>
              Token admin
            </label>
            <input
              type="password"
              value={token}
              onChange={e => setToken(e.target.value)}
              placeholder="Collez votre ADMIN_TOKEN ici..."
              style={{ ...inputStyle, letterSpacing: token ? '0.08em' : 'normal' }}
              autoFocus
            />
            <div style={{ fontSize: 11, color: '#4A6080', marginTop: 6 }}>
              Trouvez ce token dans{' '}
              <code style={{
                background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: 4,
              }}>
                backend/.env
              </code>
            </div>
          </div>

          {error && (
            <div style={{
              background: 'rgba(255,107,107,0.1)',
              border: '1px solid rgba(255,107,107,0.25)',
              borderRadius: 8, padding: '10px 12px', marginBottom: 16,
              fontSize: 12, color: '#ff8080',
            }}>
              ⚠ {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !token.trim()}
            style={{
              width: '100%', padding: '11px',
              background: 'linear-gradient(135deg, #00A8CC, #0070a8)',
              border: 'none', borderRadius: 9, color: '#fff', fontWeight: 600, fontSize: 14,
              cursor: loading || !token.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !token.trim() ? 0.6 : 1,
              boxShadow: '0 4px 16px rgba(0,168,204,0.3)', transition: 'all .2s',
            }}
          >
            {loading ? 'Vérification…' : 'Accéder au dashboard'}
          </button>
        </form>
      </div>
    </div>
  )
}
