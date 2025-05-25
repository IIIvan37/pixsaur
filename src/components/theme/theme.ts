export const theme = {
  colors: {
    dark: '#000000',
    light: '#FFFFFF',
    background: '#000000',
    foreground: '#00DF3A',
    accent: '#00FF00',
    accentHover: '#00CC00',
    accentActive: '#00AA00',
    border: '#005500',
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
      lg: 'clamp(1rem, 1.5vw, 1.13rem)',
      xl: 'clamp(1.13rem, 2vw, 1.25rem)',
      heading: 'clamp(1.25rem, 3vw, 1.5rem)'
    }
  },
  spacing: {
    xs: '0.29rem',
    sm: '0.57rem',
    md: '0.86rem',
    lg: '1.14rem',
    xl: '1.71rem'
  },
  radius: {
    none: '0rem',
    sm: '0.14rem',
    md: '0.29rem'
  },
  shadow: {
    glow: '0 0 0.29rem #00FF00',
    inner: 'inset 0 0 0.14rem #00FF00'
  },
  spinner: {
    size: '1rem',
    border: '0.14rem',
    speed: '0.8s',
    color: 'var(--color-accent)'
  },
  grid: {
    gap: '0.86rem',
    col: '1fr',
    colNarrow: '5.71rem',
    colWide: 'minmax(14.29rem, 1fr)'
  },
  breakpoints: {
    xs: '320px',
    sm: '480px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    xxl: '1536px'
  }
}
