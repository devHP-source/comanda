import Icon from './components/Icon/Icon.jsx'

const iconNames = [
  'alert', 'bell', 'bookmark', 'calendar', 'check', 'chef', 'chevron', 'clock', 'dashboard', 'dish', 'globe',
  'home', 'info', 'list', 'map', 'menu', 'people', 'search', 'settings', 'sparkle', 'table',
]

const App = () => {
  return (
    <main style={{ padding: 'var(--space-6)', display: 'grid', gap: 'var(--space-4)' }}>
      <h1 style={{ fontSize: 'var(--text-hero)' }}>Comanda</h1>
      <p style={{ color: 'var(--color-ink-muted)' }}>Base styles preview</p>
      <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)' }}>
        {iconNames.map((name) => (
          <li key={name} title={name}>
            <Icon name={name} size={24} />
          </li>
        ))}
      </ul>
      <button
        type="button"
        style={{
          justifySelf: 'start',
          minHeight: 'var(--tap-min)',
          padding: '0 var(--space-5)',
          borderRadius: 'var(--radius-pill)',
          color: 'var(--color-white)',
          background: 'var(--color-accent)',
        }}
      >
        Button
      </button>
    </main>
  )
}

export default App