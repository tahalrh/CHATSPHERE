import React from 'react'
import { Icon } from './icons.jsx'

export default function Sidebar({ bots, selectedId, onSelect, onNew, onLogout, currentView, onViewChange }) {
  const botList = Object.values(bots)

  return (
    <aside style={{
      width: 240,
      padding: '28px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      borderRight: '1px solid rgba(255,255,255,0.05)',
      background: 'rgba(6,13,26,0.7)',
      backdropFilter: 'blur(20px)',
      position: 'sticky',
      top: 0,
      height: '100vh',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 8px', marginBottom: 28,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: 'linear-gradient(135deg, #00A8CC, #0070a8)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, boxShadow: '0 0 16px #00A8CC44',
        }}>🤖</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', letterSpacing: '-0.02em' }}>
            ClientFlow
          </div>
          <div style={{ fontSize: 11, color: '#4A6080' }}>Dashboard</div>
        </div>
      </div>

      {/* Navigation principale */}
      <button
        onClick={() => onViewChange('ratings')}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
          border: 'none', textAlign: 'left', width: '100%', marginBottom: 16,
          background: currentView === 'ratings' ? 'rgba(0,168,204,0.12)' : 'transparent',
          color: currentView === 'ratings' ? '#00A8CC' : '#8899A6',
          fontSize: 13, fontWeight: currentView === 'ratings' ? 600 : 400,
          transition: 'all .15s',
        }}
      >
        {Icon.star} Évaluations
      </button>

      <div style={{
        fontSize: 10, fontWeight: 600, color: '#4A6080',
        textTransform: 'uppercase', letterSpacing: '0.1em',
        padding: '0 8px', marginBottom: 6,
      }}>
        Mes bots ({botList.length})
      </div>

      {botList.map(b => (
        <BotItem
          key={b.botId}
          bot={b}
          isActive={b.botId === selectedId}
          onClick={() => onSelect(b.botId)}
        />
      ))}

      <button
        onClick={onNew}
        style={{
          marginTop: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
          background: 'rgba(0,168,204,0.08)',
          border: '1px dashed rgba(0,168,204,0.3)',
          color: '#00A8CC', fontSize: 13, fontWeight: 500, transition: 'all .15s',
        }}
      >
        {Icon.plus} Nouveau bot
      </button>

      <div style={{ marginTop: 'auto', padding: '10px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{
          background: 'rgba(0,168,204,0.06)',
          border: '1px solid rgba(0,168,204,0.15)',
          borderRadius: 8, padding: '8px 10px',
        }}>
          <div style={{ fontSize: 11, color: '#4A6080', marginBottom: 2 }}>Version</div>
          <div style={{ fontSize: 12, color: '#00A8CC', fontWeight: 600 }}>ClientFlow v1.0</div>
        </div>
        <button
          onClick={onLogout}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
            background: 'rgba(255,107,107,0.06)',
            border: '1px solid rgba(255,107,107,0.15)',
            color: '#ff8080', fontSize: 12, fontWeight: 500, transition: 'all .15s',
          }}
        >
          {Icon.logout} Déconnexion
        </button>
      </div>
    </aside>
  )
}

function BotItem({ bot, isActive, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
        border: 'none', textAlign: 'left', width: '100%',
        background: isActive ? 'rgba(0,168,204,0.12)' : 'transparent',
        color: isActive ? '#00A8CC' : '#8899A6',
        transition: 'all .15s',
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: bot.color || '#00A8CC',
        boxShadow: isActive ? `0 0 8px ${bot.color || '#00A8CC'}` : 'none',
      }} />
      <span style={{
        fontSize: 13,
        fontWeight: isActive ? 600 : 400,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {bot.name}
      </span>
    </button>
  )
}
