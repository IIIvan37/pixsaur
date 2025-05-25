import ImageConverter from '@/app/components/image-converter'
import { ThemeProvider } from '@/components/theme/theme-provider'

import styles from '@/styles/app.module.css'

export default function App() {
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
