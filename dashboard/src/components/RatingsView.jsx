import React, { useState, useEffect, useCallback } from 'react'
import { Section } from './ui.jsx'

const API = `${import.meta.env.VITE_API_URL || ''}/api`

// ── Étoiles (lecture seule) ───────────────────────────────────────────────
function Stars({ value, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span key={n} style={{ fontSize: size, color: n <= value ? '#FFC857' : '#2a3f5c', lineHeight: 1 }}>★</span>
      ))}
    </span>
  )
}

// ── Icône graphique ───────────────────────────────────────────────────────
function ChartIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="20" x2="18" y2="10"/>
      <line x1="12" y1="20" x2="12" y2="4"/>
      <line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

// ── Barre de distribution des étoiles ────────────────────────────────────
function StarDistribution({ stats }) {
  const total = stats.total || 1
  const bars = [
    { label: '5★', count: stats.s5 || 0, color: '#00C896' },
    { label: '4★', count: stats.s4 || 0, color: '#7ed956' },
    { label: '3★', count: stats.s3 || 0, color: '#f0b429' },
    { label: '2★', count: stats.s2 || 0, color: '#ff9f43' },
    { label: '1★', count: stats.s1 || 0, color: '#ff6b6b' },
  ]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {bars.map(({ label, count, color }) => {
        const pct = Math.round((count / total) * 100)
        return (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: '#8899A6', width: 22, textAlign: 'right', flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 99, height: 7, overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 99, transition: 'width .4s ease' }} />
            </div>
            <span style={{ fontSize: 11, color: '#4A6080', width: 28, textAlign: 'right', flexShrink: 0 }}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── Carte de sélection d'un bot ───────────────────────────────────────────
function BotStatsCard({ bot, stats, isSelected, onClick }) {
  const avg = stats.average ? Number(stats.average).toFixed(1) : null
  const avgColor = !avg ? '#4A6080'
    : avg >= 4 ? '#00C896'
    : avg >= 3 ? '#f0b429'
    : '#ff6b6b'

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
        border: `1px solid ${isSelected ? 'rgba(0,168,204,0.4)' : 'rgba(255,255,255,0.06)'}`,
        background: isSelected ? 'rgba(0,168,204,0.08)' : 'rgba(13,33,55,0.4)',
        width: '100%', textAlign: 'left', marginBottom: 8, transition: 'all .15s',
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: '50%', flexShrink: 0, background: bot?.color || '#00A8CC' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#E8EEF4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {bot?.name || stats.bot_id}
        </div>
        <div style={{ fontSize: 11, color: '#4A6080', marginTop: 1 }}>
          {stats.total} avis
        </div>
      </div>
      {avg && (
        <div style={{ fontSize: 13, fontWeight: 700, color: avgColor, flexShrink: 0 }}>
          {avg} ★
        </div>
      )}
    </button>
  )
}

// ── Détail d'un bot ───────────────────────────────────────────────────────
function BotRatingsDetail({ botId, botName, adminToken }) {
  const [stats, setStats]   = useState(null)
  const [list, setList]     = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  const tokenRef = React.useRef(adminToken)
  useEffect(() => { tokenRef.current = adminToken }, [adminToken])

  const load = useCallback(async () => {
    setLoading(true)
    const h = { Authorization: `Bearer ${tokenRef.current}` }
    try {
      const [sRes, lRes] = await Promise.all([
        fetch(`${API}/ratings/${botId}/stats`, { headers: h }),
        fetch(`${API}/ratings/${botId}`,       { headers: h }),
      ])
      if (!sRes.ok || !lRes.ok) throw new Error('HTTP error')
      const sData = await sRes.json()
      const lData = await lRes.json()
      setStats(sData)
      setList(Array.isArray(lData) ? lData : [])
    } catch (e) {
      console.error('BotRatingsDetail load error', e)
    }
    setLoading(false)
  }, [botId])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ color: '#4A6080', fontSize: 13, padding: 24, textAlign: 'center' }}>Chargement…</div>
  )

  const avg = stats?.average ? Number(stats.average) : 0
  const avgColor = avg >= 4 ? '#00C896' : avg >= 3 ? '#f0b429' : avg > 0 ? '#ff6b6b' : '#4A6080'

  const filtered = filter === 'all'   ? list
    : filter === 'good' ? list.filter(r => r.rating >= 4)
    : list.filter(r => r.rating <= 2)

  return (
    <>
      {/* Stats globales */}
      <Section icon={<ChartIcon />} title={`Statistiques — ${botName}`}>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          {/* Note moyenne */}
          <div style={{
            flex: '0 0 auto', textAlign: 'center',
            background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '14px 20px',
            border: `1px solid ${avgColor}33`,
          }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: avgColor, lineHeight: 1 }}>
              {avg > 0 ? avg.toFixed(1) : '—'}
            </div>
            <Stars value={Math.round(avg)} size={14} />
            <div style={{ fontSize: 11, color: '#4A6080', marginTop: 4 }}>
              {stats?.total ?? 0} avis
            </div>
          </div>

          {/* Distribution */}
          <div style={{ flex: 1, minWidth: 160, background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: '14px 16px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ fontSize: 11, color: '#6B7E94', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Répartition</div>
            <StarDistribution stats={stats || {}} />
          </div>
        </div>
      </Section>

      {/* Liste */}
      <Section icon={<ChartIcon />} title="Historique des avis">
        <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { key: 'all',  label: 'Tous' },
            { key: 'good', label: '★★★★+ Positifs' },
            { key: 'bad',  label: '★★- Négatifs' },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setFilter(key)} style={{
              padding: '5px 12px', borderRadius: 6, cursor: 'pointer', fontSize: 12,
              background: filter === key ? 'rgba(0,168,204,0.15)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${filter === key ? 'rgba(0,168,204,0.4)' : 'rgba(255,255,255,0.08)'}`,
              color: filter === key ? '#00A8CC' : '#8899A6', transition: 'all .15s',
            }}>
              {label}
            </button>
          ))}
          <button onClick={load} style={{
            marginLeft: 'auto', padding: '5px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11,
            background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#4A6080',
          }}>↻ Actualiser</button>
        </div>

        {filtered.length === 0 ? (
          <div style={{ color: '#4A6080', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>
            Aucun avis pour ce filtre
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 440, overflowY: 'auto' }}>
            {filtered.map(r => <RatingItem key={r.id} rating={r} />)}
          </div>
        )}
      </Section>
    </>
  )
}

// ── Carte d'un avis ───────────────────────────────────────────────────────
function RatingItem({ rating }) {
  const date = new Date(rating.created_at).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
  const starColor = rating.rating >= 4 ? '#00C896' : rating.rating >= 3 ? '#f0b429' : '#ff6b6b'

  return (
    <div style={{
      background: 'rgba(0,0,0,0.2)', borderRadius: 9, padding: '11px 13px',
      border: `1px solid ${starColor}22`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Stars value={rating.rating} size={13} />
        <span style={{ fontSize: 11, color: '#4A6080', marginLeft: 'auto', flexShrink: 0 }}>{date}</span>
      </div>

      {rating.comment && (
        <div style={{
          fontSize: 13, color: '#C8D8E8', fontStyle: 'italic',
          borderLeft: `2px solid ${starColor}55`, paddingLeft: 10, marginBottom: 8,
        }}>
          "{rating.comment}"
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {rating.user_msg && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: 2 }}>Q</span>
            <span style={{ fontSize: 12, color: '#8899A6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rating.user_msg}
            </span>
          </div>
        )}
        {rating.bot_msg && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, color: '#00A8CC', textTransform: 'uppercase', letterSpacing: '0.05em', flexShrink: 0, marginTop: 2 }}>R</span>
            <span style={{ fontSize: 12, color: '#8899A6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {rating.bot_msg}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Vue principale ────────────────────────────────────────────────────────
export default function RatingsView({ bots, adminToken }) {
  const [allStats, setAllStats]      = useState([])
  const [selectedBotId, setSelected] = useState(null)
  const [loading, setLoading]        = useState(true)

  // Stable ref pour éviter les dépendances cycliques dans useCallback
  const tokenRef = React.useRef(adminToken)
  useEffect(() => { tokenRef.current = adminToken }, [adminToken])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res  = await fetch(`${API}/ratings`, {
        headers: { Authorization: `Bearer ${tokenRef.current}` }
      })
      if (!res.ok) throw new Error('HTTP ' + res.status)
      const data = await res.json()
      setAllStats(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error('RatingsView loadAll error', e)
    }
    setLoading(false)
  }, []) // pas de dépendance → stable, s'exécute une seule fois au montage

  // Chargement initial + toutes les 10 s pour rester à jour
  useEffect(() => {
    loadAll()
    const timer = setInterval(loadAll, 30000)
    return () => clearInterval(timer)
  }, [loadAll])

  // Recharge aussi la liste quand on sélectionne un bot (pour mettre à jour le compteur)
  function selectBot(id) {
    setSelected(id)
    loadAll()
  }

  const botList       = Object.values(bots)
  const botsWithStats = new Set(allStats.map(s => s.bot_id))
  const enriched      = allStats.map(s => ({ ...s, bot: bots[s.bot_id] }))
  const botsWithout   = botList.filter(b => !botsWithStats.has(b.botId))
  const selectedBot   = selectedBotId ? bots[selectedBotId] : null

  return (
    <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
      {/* Colonne gauche */}
      <div style={{ width: 210, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: '#4A6080', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Bots
          </span>
          <button onClick={loadAll} title="Actualiser" style={{
            background: 'none', border: 'none', color: '#4A6080', cursor: 'pointer', fontSize: 13, padding: '2px 4px',
          }}>↻</button>
        </div>
        {loading ? (
          <div style={{ color: '#4A6080', fontSize: 12 }}>Chargement…</div>
        ) : (
          <>
            {enriched.length === 0 && botsWithout.length === 0 && (
              <div style={{ color: '#4A6080', fontSize: 12, marginBottom: 10 }}>
                Aucun bot trouvé
              </div>
            )}
            {enriched.map(s => (
              <BotStatsCard key={s.bot_id} bot={s.bot} stats={s}
                isSelected={selectedBotId === s.bot_id}
                onClick={() => selectBot(s.bot_id)} />
            ))}
            {botsWithout.map(b => (
              <BotStatsCard key={b.botId} bot={b}
                stats={{ bot_id: b.botId, total: 0, average: null }}
                isSelected={selectedBotId === b.botId}
                onClick={() => selectBot(b.botId)} />
            ))}
          </>
        )}
      </div>

      {/* Colonne droite */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {selectedBotId ? (
          <BotRatingsDetail key={selectedBotId} botId={selectedBotId}
            botName={selectedBot?.name || selectedBotId} adminToken={adminToken} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 20px', color: '#4A6080', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⭐</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#8899A6', marginBottom: 6 }}>Évaluations IA</div>
            <div style={{ fontSize: 13 }}>Sélectionnez un bot pour voir ses avis</div>
          </div>
        )}
      </div>
    </div>
  )
}
