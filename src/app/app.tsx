import ImageConverter from './components/image-converter/image-converter'
import { ThemeProvider } from '@/components/theme/theme-provider'

import styles from '@/styles/app.module.css'
import { useEffect } from 'react'

export default function App() {
  const getRasm = async () => {
    const res = await fetch('./.netlify/functions/rasm')
    if (!res.ok) {
      console.error('Failed to fetch rasm binary:', res.statusText)
      return
    }
    const blob = await res.blob()
    console.log('blob', blob)
  }

  useEffect(() => {
    getRasm()
  }, [])

  useEffect(() => {})
  // Preload the logo image
  return (
    <ThemeProvider>
      <main className={styles.container}>
        <div className={styles.content}>
          <header className={styles.header}>
            <img src='pixsaur_logo_512.png' width='32' height='32' />
            <h1 className={styles.title}>PIXSAUR</h1>
            <p className={styles.subtitle}>
              Convertisseur d'images Amstrad CPC"
            </p>
            <div className={styles.langSwitcher}>
              {/* <LanguageSwitcher /> */}
            </div>
          </header>

          <ImageConverter />

          <footer className={styles.footer}></footer>
        </div>
      </main>
    </ThemeProvider>
  )
}
