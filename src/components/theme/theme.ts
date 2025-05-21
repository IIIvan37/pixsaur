export const theme = {
  colors: {
    background: '#000000',
    foreground: '#00DF3A',
    accent: '#00FF00',
    accentHover: '#00CC00',
    accentActive: '#00AA00',
    border: '#00DF3A',
    error: '#FF5555',
    hover: {
      primary: '#00CC00',
      secondary: 'rgba(0, 255, 0, 0.05)'
    },

    pressed: {
      primary: '#005500',
      secondary: '#003300'
    },

    focus: {
      ring: '#00FF00',
      glow: '#00FF88'
    },
    disabled: {
      thumb: '#004400',
      border: '#007700',
      range: '#005500',
      track: '#002200',
      text: '#007700'
    }
  },

  font: {
    family: 'JetBrains Mono, Fira Code, Inconsolata, monospace',
    size: {
      xs: 'clamp(0.7rem, 0.8vw, 0.8rem)',
      sm: 'clamp(0.8rem, 1vw, 0.9rem)',
      md: 'clamp(0.9rem, 1.2vw, 1rem)',
      lg: 'clamp(1rem, 1.5vw, 1.125rem)',
      xl: 'clamp(1.125rem, 2vw, 1.25rem)',
      heading: 'clamp(1.25rem, 3vw, 1.5rem)'
    }
  },
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px'
  },
  radius: {
    none: '0px',
    sm: '2px',
    md: '4px'
  },
  shadow: {
    glow: '0 0 4px #00FF00',
    inner: 'inset 0 0 2px #00FF00'
  },
  spinner: {
    size: '14px',
    border: '2px',
    speed: '0.8s',
    color: 'var(--color-accent)'
  },
  grid: {
    gap: '12px',
    col: '1fr',
    colNarrow: '80px',
    colWide: 'minmax(200px, 1fr)'
  }
}
