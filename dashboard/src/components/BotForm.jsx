import React, { useRef, useState } from 'react'
import { Section, Field, inputStyle, textareaStyle } from './ui.jsx'
import { Icon } from './icons.jsx'

export function IdentitySection({ form, onChange }) {
  return (
    <Section icon={Icon.bot} title="Identité">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, alignItems: 'end' }}>
        <Field label="Nom du bot">
          <input
            style={inputStyle}
            value={form.name}
            onChange={e => onChange('name', e.target.value)}
            placeholder="Ex: Assistant TechShop"
          />
        </Field>
        <Field label="Couleur">
          <input
            type="color"
            value={form.color}
            onChange={e => onChange('color', e.target.value)}
            style={{
              width: 44, height: 36,
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 8, background: 'none', cursor: 'pointer', padding: 2,
            }}
          />
        </Field>
      </div>
      <Field label="Message de bienvenue">
        <input
          style={inputStyle}
          value={form.welcomeMessage}
          onChange={e => onChange('welcomeMessage', e.target.value)}
        />
      </Field>
    </Section>
  )
}

export function BehaviorSection({ form, onChange }) {
  return (
    <Section icon={Icon.settings} title="Comportement">
      <Field label="Prompt système">
        <textarea
          style={{ ...textareaStyle, minHeight: 110 }}
          value={form.systemPrompt}
          onChange={e => onChange('systemPrompt', e.target.value)}
          placeholder="Tu es un assistant pour une boutique. Réponds en français, sois amical…"
        />
      </Field>
    </Section>
  )
}

export function KnowledgeBaseSection({ form, onChange }) {
  const [dragOver, setDragOver] = useState(false)
  const [kbError, setKbError] = useState('')
  const fileRef = useRef()

  function handleChange(val) {
    let invalid = false
    if (val) {
      try { JSON.parse(val); setKbError('') }
      catch { setKbError('JSON invalide'); invalid = true }
    } else {
      setKbError('')
    }
    onChange('knowledgeBase', val, invalid)
  }

  function handleFileDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer?.files[0] || e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => handleChange(ev.target.result)
    reader.readAsText(file)
  }

  return (
    <Section icon={Icon.brain} title="Base de connaissances">
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileDrop}
      />
      <div
        onClick={() => !form.knowledgeBase && fileRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleFileDrop}
        style={{
          border: `1.5px dashed ${dragOver ? '#00A8CC' : kbError ? '#ff6b6b' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 10,
          padding: form.knowledgeBase ? 0 : '20px 16px',
          background: dragOver ? 'rgba(0,168,204,0.05)' : 'transparent',
          transition: 'all .2s',
          cursor: form.knowledgeBase ? 'default' : 'pointer',
          textAlign: form.knowledgeBase ? 'left' : 'center',
        }}
      >
        {form.knowledgeBase ? (
          <div style={{ position: 'relative' }}>
            <textarea
              style={{
                ...textareaStyle, minHeight: 120,
                fontFamily: 'monospace', fontSize: 11,
                marginBottom: 0, borderRadius: 10,
              }}
              value={form.knowledgeBase}
              onChange={e => handleChange(e.target.value)}
            />
            <button
              onClick={() => handleChange('')}
              style={{
                position: 'absolute', top: 8, right: 8,
                background: 'rgba(255,107,107,0.15)',
                border: '1px solid rgba(255,107,107,0.3)',
                borderRadius: 6, color: '#ff6b6b',
                fontSize: 11, padding: '2px 8px', cursor: 'pointer',
              }}
            >
              Effacer
            </button>
          </div>
        ) : (
          <>
            <div style={{ color: '#00A8CC', marginBottom: 8 }}>{Icon.upload}</div>
            <div style={{ fontSize: 13, color: '#8899A6', marginBottom: 4 }}>
              Glisser-déposer un fichier{' '}
              <strong style={{ color: '#E8EEF4' }}>.json</strong>
            </div>
            <div style={{ fontSize: 11, color: '#4A6080' }}>ou cliquer pour parcourir</div>
          </>
        )}
      </div>
      {kbError && (
        <div style={{ color: '#ff6b6b', fontSize: 11, marginTop: 6 }}>⚠ {kbError}</div>
      )}
    </Section>
  )
}

export function ModelSection({ form, onChange, ollamaModels, ollamaError, fetchOrModels, orModels, orModelsLoading }) {
  const [orSearch, setOrSearch] = useState('')
  const [orFreeOnly, setOrFreeOnly] = useState(true)

  function handleProviderChange(p) {
    onChange('provider', p)
    onChange('model', p === 'ollama' ? (ollamaModels[0] || '') : '')
    if (p === 'openrouter' && form.openrouterKey) fetchOrModels(form.openrouterKey, orFreeOnly)
  }

  return (
    <Section icon={Icon.settings} title="Modèle IA">
      <Field label="Fournisseur">
        <select style={inputStyle} value={form.provider} onChange={e => handleProviderChange(e.target.value)}>
          <option value="ollama">🖥 Ollama — Local</option>
          <option value="openrouter">☁ OpenRouter — Cloud</option>
        </select>
      </Field>

      {form.provider === 'ollama' && (
        <Field label="Modèle Ollama" error={ollamaError}>
          {!ollamaError && (
            <select style={inputStyle} value={form.model} onChange={e => onChange('model', e.target.value)}>
              {ollamaModels.length === 0
                ? <option>Chargement…</option>
                : ollamaModels.map(m => <option key={m} value={m}>{m}</option>)
              }
            </select>
          )}
        </Field>
      )}

      {form.provider === 'openrouter' && (
        <>
          <Field label="Clé API OpenRouter">
            <input
              style={inputStyle}
              type="password"
              value={form.openrouterKey}
              onChange={e => {
                onChange('openrouterKey', e.target.value)
                fetchOrModels(e.target.value, orFreeOnly)
              }}
              placeholder="sk-or-v1-…"
            />
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
            <label style={{ fontSize: 12, color: '#6B7E94', fontWeight: 500 }}>Modèle OpenRouter</label>
            <label style={{ fontSize: 11, color: '#4A6080', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={orFreeOnly}
                onChange={e => {
                  setOrFreeOnly(e.target.checked)
                  fetchOrModels(form.openrouterKey, e.target.checked)
                }}
              />
              Gratuits uniquement
            </label>
          </div>

          <input
            style={{ ...inputStyle, marginBottom: 8 }}
            value={orSearch}
            onChange={e => setOrSearch(e.target.value)}
            placeholder="🔍 Rechercher…"
          />

          {orModelsLoading ? (
            <div style={{ fontSize: 12, color: '#4A6080', padding: '8px 0' }}>
              Chargement des modèles…
            </div>
          ) : orModels.length > 0 ? (
            <select style={inputStyle} value={form.model} onChange={e => onChange('model', e.target.value)}>
              {orModels
                .filter(m =>
                  m.id.toLowerCase().includes(orSearch.toLowerCase()) ||
                  m.name.toLowerCase().includes(orSearch.toLowerCase())
                )
                .map(m => <option key={m.id} value={m.id}>{m.name} — {m.id}</option>)
              }
            </select>
          ) : (
            <input
              style={inputStyle}
              value={form.model}
              onChange={e => onChange('model', e.target.value)}
              placeholder="Ex: openai/gpt-4o-mini"
            />
          )}
        </>
      )}
    </Section>
  )
}
