export const inputStyle = {
  width: '100%',
  background: 'rgba(10,22,40,0.8)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  color: '#E8EEF4',
  padding: '9px 12px',
  fontSize: 13,
  outline: 'none',
  transition: 'border-color .2s',
}

export const textareaStyle = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 90,
  lineHeight: 1.6,
}

export function Section({ icon, title, children }) {
  return (
    <div style={{
      background: 'rgba(13,33,55,0.6)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 14,
      padding: '20px 22px',
      marginBottom: 16,
      backdropFilter: 'blur(12px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <span style={{ color: '#00A8CC' }}>{icon}</span>
        <span style={{
          fontSize: 13, fontWeight: 600, color: '#8899A6',
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {title}
        </span>
      </div>
      {children}
    </div>
  )
}

export function Field({ label, children, error }) {
  return (
    <div style={{ marginBottom: error ? 6 : 14 }}>
      <label style={{
        display: 'block', fontSize: 12, color: '#6B7E94',
        marginBottom: 6, fontWeight: 500,
      }}>
        {label}
      </label>
      {children}
      {error && (
        <div style={{ color: '#ff6b6b', fontSize: 11, marginTop: 4 }}>⚠ {error}</div>
      )}
    </div>
  )
}
