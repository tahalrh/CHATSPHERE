import React, { useState } from 'react'
import { Section } from './ui.jsx'
import { Icon } from './icons.jsx'

// ── Bloc de code d'intégration avec bouton copier ─────────────────────────
export default function EmbedSnippet({ botId, serverUrl }) {
  const [copied, setCopied] = useState(false)

  if (!botId) return null

  const snippet = `<script src="${serverUrl}/widget/widget.js"\n  data-bot-id="${botId}"\n  data-server="${serverUrl}">\n</script>`

  function copySnippet() {
    navigator.clipboard.writeText(snippet)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Section icon={Icon.code} title="Intégration">
      <p style={{ fontSize: 12, color: '#4A6080', marginBottom: 12 }}>
        Colle ce code dans n'importe quel site — WordPress, HTML, React, peu importe.
      </p>
      <div style={{
        background: 'rgba(6,13,26,0.8)',
        border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 10, padding: '14px 16px', position: 'relative',
      }}>
        <pre style={{
          fontFamily: 'monospace', fontSize: 12, color: '#00C896',
          lineHeight: 1.7, whiteSpace: 'pre-wrap', margin: 0,
        }}>
          {snippet}
        </pre>
        <button
          onClick={copySnippet}
          style={{
            position: 'absolute', top: 10, right: 10,
            display: 'flex', alignItems: 'center', gap: 5,
            padding: '5px 10px',
            background: copied ? 'rgba(0,200,150,0.15)' : 'rgba(255,255,255,0.06)',
            border: `1px solid ${copied ? 'rgba(0,200,150,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 6,
            color: copied ? '#00C896' : '#8899A6',
            fontSize: 11, cursor: 'pointer', transition: 'all .2s',
          }}
        >
          {copied ? Icon.check : Icon.copy}
          {copied ? 'Copié !' : 'Copier'}
        </button>
      </div>
    </Section>
  )
}
