import { ThemeProvider } from '@/components/theme/theme-provider'
import styles from '@/styles/app.module.css'
import { CacheStats } from '@/components/cache-stats'
import ImageConverter from './components/image-converter/image-converter'

export default function App() {
  return (
    <ThemeProvider>
      <main className={styles.container}>
        <div className={styles.content}>
          <header className={styles.header}>
            <img
              src='pixsaur_logo_512.png'
              width='32'
              height='32'
              alt='Logo Pixsaur - Convertisseur d&apos;images Amstrad CPC'
            />

            <h1 className={styles.title}>PIXSAUR</h1>
            <p className={styles.subtitle}>
              Convertisseur d'images Amstrad CPC"
            </p>
            <div className={styles.langSwitcher}>
              {/* <LanguageSwitcher /> */}
            </div>
          </header>

          <ImageConverter />
          <CacheStats />

          <footer className={styles.footer}></footer>
        </div>
      </main>
    </ThemeProvider>
  )
}
